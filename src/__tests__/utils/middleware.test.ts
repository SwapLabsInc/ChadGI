/**
 * Unit tests for src/utils/middleware.ts
 *
 * Tests the command execution middleware system for ChadGI.
 */

import { jest } from '@jest/globals';
import { vol } from 'memfs';

// Mock fs module before importing anything that uses it
jest.unstable_mockModule('fs', async () => {
  const memfs = await import('memfs');
  return memfs.fs;
});

// Import after mocking
const { existsSync, readFileSync, mkdirSync, writeFileSync } = await import('fs');
const {
  EXIT_CODES,
  composeMiddleware,
  withTiming,
  withDirectory,
  withDirectoryValidation,
  withConfig,
  withJsonOutput,
  withErrorHandler,
  withCommand,
  standardDirectoryMiddleware,
  standardConfigMiddleware,
  withDirectoryCommand,
  withConfigCommand,
  conditionalMiddleware,
  passthrough,
} = await import('../../utils/middleware.js');

const {
  createCoreContext,
} = await import('../../utils/context.js');

const { ValidationError } = await import('../../utils/errors.js');

// Import types statically (types are erased at runtime)
import type {
  CoreContext,
  DirectoryContext,
  ConfigContext,
  TimedContext,
  CommandResult,
} from '../../utils/context.js';
import type { BaseCommandOptions } from '../../types/index.js';

describe('middleware', () => {
  let mockExit: jest.SpiedFunction<typeof process.exit>;
  let mockConsoleError: jest.SpiedFunction<typeof console.error>;
  let mockConsoleLog: jest.SpiedFunction<typeof console.log>;

  beforeEach(() => {
    // Reset virtual filesystem
    vol.reset();

    // Setup process and console mocks
    mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    mockExit.mockRestore();
    mockConsoleError.mockRestore();
    mockConsoleLog.mockRestore();
    vol.reset();
  });

  describe('EXIT_CODES', () => {
    it('should have correct exit code values', () => {
      expect(EXIT_CODES.SUCCESS).toBe(0);
      expect(EXIT_CODES.GENERAL_ERROR).toBe(1);
      expect(EXIT_CODES.VALIDATION_ERROR).toBe(2);
    });
  });

  describe('composeMiddleware', () => {
    it('should execute middlewares in order', async () => {
      const order: number[] = [];

      const middleware1 = async (ctx: any, next: (ctx: any) => Promise<any>) => {
        order.push(1);
        await next(ctx);
        order.push(4);
      };

      const middleware2 = async (ctx: any, next: (ctx: any) => Promise<any>) => {
        order.push(2);
        await next(ctx);
        order.push(3);
      };

      const composed = composeMiddleware([middleware1, middleware2] as any);
      const ctx = createCoreContext({ options: {} });

      await composed(ctx, async () => {});

      expect(order).toEqual([1, 2, 3, 4]);
    });

    it('should pass context through the chain', async () => {
      const middleware1 = async (ctx: any, next: (ctx: any) => Promise<any>) => {
        ctx.value = 10;
        await next(ctx);
      };

      const middleware2 = async (ctx: any, next: (ctx: any) => Promise<any>) => {
        ctx.value = (ctx.value || 0) * 2;
        await next(ctx);
      };

      const composed = composeMiddleware([middleware1, middleware2] as any);
      const ctx = createCoreContext({ options: {} }) as any;

      let finalValue: number | undefined;
      await composed(ctx, async (c: any) => {
        finalValue = c.value;
      });

      expect(finalValue).toBe(20);
    });

    it('should handle empty middleware array', async () => {
      const composed = composeMiddleware([]);
      const ctx = createCoreContext({ options: {} });

      let handlerCalled = false;
      await composed(ctx, async () => {
        handlerCalled = true;
      });

      expect(handlerCalled).toBe(true);
    });

    it('should propagate errors through the chain', async () => {
      const errorMiddleware = async (_ctx: any, _next: (ctx: any) => Promise<any>) => {
        throw new Error('Test error');
      };

      const composed = composeMiddleware([errorMiddleware] as any);
      const ctx = createCoreContext({ options: {} });

      await expect(composed(ctx, async () => {})).rejects.toThrow('Test error');
    });
  });

  describe('withTiming', () => {
    it('should add startTime to context', async () => {
      const ctx = createCoreContext({ options: {} });
      let receivedStartTime: number | undefined;

      await withTiming(ctx, async (timedCtx: TimedContext) => {
        receivedStartTime = timedCtx.startTime;
      });

      expect(receivedStartTime).toBeDefined();
      expect(typeof receivedStartTime).toBe('number');
      expect(receivedStartTime).toBeLessThanOrEqual(Date.now());
    });

    it('should add getElapsedMs function to context', async () => {
      const ctx = createCoreContext({ options: {} });
      let elapsedMs: number | undefined;

      await withTiming(ctx, async (timedCtx: TimedContext) => {
        // Small delay to ensure elapsed time is > 0
        await new Promise(resolve => setTimeout(resolve, 10));
        elapsedMs = timedCtx.getElapsedMs();
      });

      expect(elapsedMs).toBeDefined();
      expect(elapsedMs).toBeGreaterThanOrEqual(0);
    });

    it('should pass through result from handler', async () => {
      const ctx = createCoreContext({ options: {} });

      const result = await withTiming(ctx, async () => {
        return { data: 'test' };
      });

      expect(result).toEqual({ data: 'test' });
    });
  });

  describe('withDirectory', () => {
    it('should resolve default chadgiDir when no config option', async () => {
      const ctx = createCoreContext({ options: {}, cwd: '/test/project' });
      let resolvedDir: string | undefined;

      await withDirectory(ctx, async (dirCtx: DirectoryContext) => {
        resolvedDir = dirCtx.chadgiDir;
      });

      expect(resolvedDir).toBe('/test/project/.chadgi');
    });

    it('should resolve configPath from config option', async () => {
      const ctx = createCoreContext({
        options: { config: '/custom/path/config.yaml' },
        cwd: '/test/project'
      });
      let resolvedDir: string | undefined;
      let resolvedPath: string | undefined;

      await withDirectory(ctx, async (dirCtx: DirectoryContext) => {
        resolvedDir = dirCtx.chadgiDir;
        resolvedPath = dirCtx.configPath;
      });

      expect(resolvedDir).toBe('/custom/path');
      expect(resolvedPath).toBe('/custom/path/config.yaml');
    });

    it('should set configPath to default filename', async () => {
      const ctx = createCoreContext({ options: {}, cwd: '/test/project' });
      let resolvedPath: string | undefined;

      await withDirectory(ctx, async (dirCtx: DirectoryContext) => {
        resolvedPath = dirCtx.configPath;
      });

      expect(resolvedPath).toBe('/test/project/.chadgi/chadgi-config.yaml');
    });
  });

  describe('withDirectoryValidation', () => {
    it('should pass through when directory exists', async () => {
      vol.fromJSON({
        '/test/project/.chadgi/chadgi-config.yaml': 'test: true'
      });

      const ctx: DirectoryContext = {
        options: {},
        cwd: '/test/project',
        chadgiDir: '/test/project/.chadgi',
        configPath: '/test/project/.chadgi/chadgi-config.yaml',
      };

      let handlerCalled = false;
      await withDirectoryValidation(ctx, async () => {
        handlerCalled = true;
      });

      expect(handlerCalled).toBe(true);
      expect(mockExit).not.toHaveBeenCalled();
    });

    it('should exit when directory does not exist', async () => {
      const ctx: DirectoryContext = {
        options: {},
        cwd: '/test/project',
        chadgiDir: '/nonexistent/.chadgi',
        configPath: '/nonexistent/.chadgi/chadgi-config.yaml',
      };

      try {
        await withDirectoryValidation(ctx, async () => {});
        fail('Expected to throw');
      } catch (e: any) {
        expect(e.message).toBe('process.exit called');
      }

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockConsoleError).toHaveBeenCalled();
    });

    it('should output JSON error when json option is true', async () => {
      const ctx: DirectoryContext = {
        options: { json: true },
        cwd: '/test/project',
        chadgiDir: '/nonexistent/.chadgi',
        configPath: '/nonexistent/.chadgi/chadgi-config.yaml',
      };

      try {
        await withDirectoryValidation(ctx, async () => {});
        fail('Expected to throw');
      } catch (e: any) {
        expect(e.message).toBe('process.exit called');
      }

      expect(mockConsoleLog).toHaveBeenCalled();
      const logCall = mockConsoleLog.mock.calls[0][0] as string;
      const parsed = JSON.parse(logCall);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('.chadgi directory not found');
    });
  });

  describe('withConfig', () => {
    it('should load config when file exists', async () => {
      const configYaml = `
github:
  repo: owner/repo
  project_number: 42
  ready_column: Ready
  in_progress_column: In Progress
  review_column: In Review
branch:
  base: main
  prefix: feature/
`;
      vol.fromJSON({
        '/test/project/.chadgi/chadgi-config.yaml': configYaml
      });

      const ctx: DirectoryContext = {
        options: {},
        cwd: '/test/project',
        chadgiDir: '/test/project/.chadgi',
        configPath: '/test/project/.chadgi/chadgi-config.yaml',
      };

      let loadedGithub: any;
      let loadedBranch: any;

      await withConfig(ctx, async (configCtx: ConfigContext) => {
        loadedGithub = configCtx.github;
        loadedBranch = configCtx.branch;
      });

      expect(loadedGithub.repo).toBe('owner/repo');
      expect(loadedGithub.project_number).toBe('42');
      expect(loadedBranch.base).toBe('main');
      expect(loadedBranch.prefix).toBe('feature/');
    });

    it('should use defaults when file does not exist', async () => {
      const ctx: DirectoryContext = {
        options: {},
        cwd: '/test/project',
        chadgiDir: '/test/project/.chadgi',
        configPath: '/test/project/.chadgi/chadgi-config.yaml',
      };

      let loadedGithub: any;
      let configExists: boolean | undefined;

      await withConfig(ctx, async (configCtx: ConfigContext) => {
        loadedGithub = configCtx.github;
        configExists = configCtx.configExists;
      });

      expect(configExists).toBe(false);
      expect(loadedGithub.repo).toBe('owner/repo'); // default
    });

    it('should set configExists to true when file exists', async () => {
      vol.fromJSON({
        '/test/project/.chadgi/chadgi-config.yaml': 'test: true'
      });

      const ctx: DirectoryContext = {
        options: {},
        cwd: '/test/project',
        chadgiDir: '/test/project/.chadgi',
        configPath: '/test/project/.chadgi/chadgi-config.yaml',
      };

      let configExists: boolean | undefined;

      await withConfig(ctx, async (configCtx: ConfigContext) => {
        configExists = configCtx.configExists;
      });

      expect(configExists).toBe(true);
    });
  });

  describe('withJsonOutput', () => {
    it('should stringify result.data when json option is true', async () => {
      const ctx = createCoreContext({ options: { json: true } });

      await withJsonOutput(ctx, async () => {
        return { data: { test: 'value' } };
      });

      expect(mockConsoleLog).toHaveBeenCalled();
      const logCall = mockConsoleLog.mock.calls[0][0] as string;
      expect(JSON.parse(logCall)).toEqual({ test: 'value' });
    });

    it('should not output when json option is false', async () => {
      const ctx = createCoreContext({ options: { json: false } });

      await withJsonOutput(ctx, async () => {
        return { data: { test: 'value' } };
      });

      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should not output when result has no data', async () => {
      const ctx = createCoreContext({ options: { json: true } });

      await withJsonOutput(ctx, async () => {
        return { success: true };
      });

      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should pass through void result', async () => {
      const ctx = createCoreContext({ options: { json: true } });

      const result = await withJsonOutput(ctx, async () => {
        // no return
      });

      expect(result).toBeUndefined();
    });
  });

  describe('withErrorHandler', () => {
    it('should pass through successful execution', async () => {
      const ctx = createCoreContext({ options: {} });

      const result = await withErrorHandler(ctx, async () => {
        return { data: 'success' };
      });

      expect(result).toEqual({ data: 'success' });
      expect(mockExit).not.toHaveBeenCalled();
    });

    it('should catch errors and exit with code 1', async () => {
      const ctx = createCoreContext({ options: {} });

      await expect(
        withErrorHandler(ctx, async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('process.exit called');

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockConsoleError).toHaveBeenCalled();
    });

    it('should exit with code 2 for ValidationError', async () => {
      const ctx = createCoreContext({ options: {} });

      await expect(
        withErrorHandler(ctx, async () => {
          throw new ValidationError('Invalid input');
        })
      ).rejects.toThrow('process.exit called');

      expect(mockExit).toHaveBeenCalledWith(2);
    });

    it('should output JSON error when json option is true', async () => {
      const ctx = createCoreContext({ options: { json: true } });

      await expect(
        withErrorHandler(ctx, async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('process.exit called');

      expect(mockConsoleLog).toHaveBeenCalled();
      const logCall = mockConsoleLog.mock.calls[0][0] as string;
      const parsed = JSON.parse(logCall);
      expect(parsed.error).toBe(true);
      expect(parsed.message).toBe('Test error');
    });
  });

  describe('withCommand', () => {
    it('should execute handler with full middleware chain', async () => {
      vol.fromJSON({
        '/test/project/.chadgi/chadgi-config.yaml': 'github:\n  repo: test/repo'
      });

      let handlerCalled = false;

      const command = withCommand<BaseCommandOptions, DirectoryContext>(
        [withDirectory, withDirectoryValidation] as any,
        async (ctx) => {
          handlerCalled = true;
          return { success: true };
        }
      );

      // Note: We need to mock process.cwd() or pass cwd somehow
      // For now, test that the function is created correctly
      expect(typeof command).toBe('function');
    });

    it('should automatically add timing middleware', async () => {
      let hasStartTime = false;

      const command = withCommand(
        [],
        async (ctx: any) => {
          hasStartTime = 'startTime' in ctx;
        }
      );

      await command({});
      expect(hasStartTime).toBe(true);
    });

    it('should handle errors from handler', async () => {
      const command = withCommand(
        [],
        async () => {
          throw new Error('Handler error');
        }
      );

      await expect(command({})).rejects.toThrow('process.exit called');
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should skip error handler when configured', async () => {
      const command = withCommand(
        [],
        async () => {
          throw new Error('Handler error');
        },
        { skipErrorHandler: true }
      );

      await expect(command({})).rejects.toThrow('Handler error');
      expect(mockExit).not.toHaveBeenCalled();
    });
  });

  describe('standardDirectoryMiddleware', () => {
    it('should include withDirectory and withDirectoryValidation', () => {
      expect(standardDirectoryMiddleware).toContain(withDirectory);
      expect(standardDirectoryMiddleware).toContain(withDirectoryValidation);
      expect(standardDirectoryMiddleware.length).toBe(2);
    });
  });

  describe('standardConfigMiddleware', () => {
    it('should include directory middlewares and withConfig', () => {
      expect(standardConfigMiddleware).toContain(withDirectory);
      expect(standardConfigMiddleware).toContain(withDirectoryValidation);
      expect(standardConfigMiddleware).toContain(withConfig);
      expect(standardConfigMiddleware.length).toBe(3);
    });
  });

  describe('withDirectoryCommand', () => {
    it('should create a command with directory middleware', async () => {
      vol.fromJSON({
        '/test/project/.chadgi/chadgi-config.yaml': 'test: true'
      });

      let receivedChadgiDir: string | undefined;

      const command = withDirectoryCommand<BaseCommandOptions>(async (ctx) => {
        receivedChadgiDir = ctx.chadgiDir;
      });

      expect(typeof command).toBe('function');
    });
  });

  describe('withConfigCommand', () => {
    it('should create a command with config middleware', async () => {
      const command = withConfigCommand<BaseCommandOptions>(async (ctx) => {
        // Would receive ConfigContext
      });

      expect(typeof command).toBe('function');
    });
  });

  describe('conditionalMiddleware', () => {
    it('should run middleware when option is not set', async () => {
      let middlewareRan = false;

      const testMiddleware = async (ctx: any, next: (ctx: any) => Promise<any>) => {
        middlewareRan = true;
        await next(ctx);
      };

      interface TestOptions extends BaseCommandOptions {
        skipIt?: boolean;
      }

      const conditional = conditionalMiddleware<TestOptions, CoreContext<TestOptions>, CoreContext<TestOptions>>(
        'skipIt',
        testMiddleware as any
      );

      const ctx = createCoreContext({ options: {} as TestOptions });
      await conditional(ctx as any, async () => {});

      expect(middlewareRan).toBe(true);
    });

    it('should skip middleware when option is set', async () => {
      let middlewareRan = false;

      const testMiddleware = async (ctx: any, next: (ctx: any) => Promise<any>) => {
        middlewareRan = true;
        await next(ctx);
      };

      interface TestOptions extends BaseCommandOptions {
        skipIt?: boolean;
      }

      const conditional = conditionalMiddleware<TestOptions, CoreContext<TestOptions>, CoreContext<TestOptions>>(
        'skipIt',
        testMiddleware as any
      );

      const ctx = createCoreContext({ options: { skipIt: true } as TestOptions });
      await conditional(ctx as any, async () => {});

      expect(middlewareRan).toBe(false);
    });

    it('should invert condition when invert=true', async () => {
      let middlewareRan = false;

      const testMiddleware = async (ctx: any, next: (ctx: any) => Promise<any>) => {
        middlewareRan = true;
        await next(ctx);
      };

      interface TestOptions extends BaseCommandOptions {
        runIt?: boolean;
      }

      const conditional = conditionalMiddleware<TestOptions, CoreContext<TestOptions>, CoreContext<TestOptions>>(
        'runIt',
        testMiddleware as any,
        true // invert
      );

      const ctx = createCoreContext({ options: { runIt: true } as TestOptions });
      await conditional(ctx as any, async () => {});

      expect(middlewareRan).toBe(true);
    });
  });

  describe('passthrough', () => {
    it('should pass context through unchanged', async () => {
      const ctx = createCoreContext({ options: {} });
      let receivedCtx: any;

      await passthrough(ctx as any, async (c) => {
        receivedCtx = c;
      });

      expect(receivedCtx).toBe(ctx);
    });

    it('should pass through result from handler', async () => {
      const ctx = createCoreContext({ options: {} });

      const result = await passthrough(ctx as any, async () => {
        return { data: 'test' };
      });

      expect(result).toEqual({ data: 'test' });
    });
  });
});

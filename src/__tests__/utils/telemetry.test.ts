/**
 * Unit tests for src/utils/telemetry.ts
 *
 * Tests OpenTelemetry integration for distributed tracing and metrics.
 */

import { jest } from '@jest/globals';

// Mock OpenTelemetry modules to avoid actual SDK initialization
jest.unstable_mockModule('@opentelemetry/api', () => ({
  trace: {
    getTracer: jest.fn(() => ({
      startSpan: jest.fn(() => ({
        setStatus: jest.fn(),
        setAttributes: jest.fn(),
        recordException: jest.fn(),
        end: jest.fn(),
        spanContext: jest.fn(() => ({
          traceId: 'mock-trace-id-12345678',
          spanId: 'mock-span-id',
        })),
      })),
      startActiveSpan: jest.fn((_name: string, _options: any, fn: any) => {
        const mockSpan = {
          setStatus: jest.fn(),
          setAttributes: jest.fn(),
          recordException: jest.fn(),
          end: jest.fn(),
        };
        return fn(mockSpan);
      }),
    })),
    getActiveSpan: jest.fn(() => null),
  },
  metrics: {
    getMeter: jest.fn(() => ({
      createCounter: jest.fn(() => ({
        add: jest.fn(),
      })),
      createHistogram: jest.fn(() => ({
        record: jest.fn(),
      })),
    })),
  },
  context: {},
  SpanKind: {
    INTERNAL: 0,
    CLIENT: 2,
  },
  SpanStatusCode: {
    OK: 1,
    ERROR: 2,
  },
}));

jest.unstable_mockModule('@opentelemetry/sdk-node', () => ({
  NodeSDK: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    shutdown: jest.fn(() => Promise.resolve()),
  })),
}));

jest.unstable_mockModule('@opentelemetry/resources', () => ({
  Resource: jest.fn().mockImplementation(() => ({})),
}));

jest.unstable_mockModule('@opentelemetry/semantic-conventions', () => ({
  ATTR_SERVICE_NAME: 'service.name',
  ATTR_SERVICE_VERSION: 'service.version',
}));

jest.unstable_mockModule('@opentelemetry/sdk-trace-base', () => ({
  ConsoleSpanExporter: jest.fn(),
}));

jest.unstable_mockModule('@opentelemetry/exporter-trace-otlp-http', () => ({
  OTLPTraceExporter: jest.fn(),
}));

jest.unstable_mockModule('@opentelemetry/exporter-metrics-otlp-http', () => ({
  OTLPMetricExporter: jest.fn(),
}));

jest.unstable_mockModule('@opentelemetry/exporter-prometheus', () => ({
  PrometheusExporter: jest.fn(),
}));

jest.unstable_mockModule('@opentelemetry/sdk-metrics', () => ({
  PeriodicExportingMetricReader: jest.fn(),
  ConsoleMetricExporter: jest.fn(),
}));

// Import after mocking
const {
  initTelemetry,
  shutdownTelemetry,
  isTelemetryEnabled,
  getTelemetryConfig,
  getTracer,
  getMeter,
  getCurrentTraceId,
  getCurrentSpanId,
  startTaskSpan,
  startGitHubSpan,
  startClaudeSpan,
  endSpanSuccess,
  endSpanError,
  withSpan,
  withSpanAsync,
  recordTaskCompletion,
  recordClaudeInvocation,
  recordGitHubOperation,
  checkTelemetryHealth,
  getPrometheusEndpoint,
} = await import('../../utils/telemetry.js');

describe('telemetry module', () => {
  const originalEnv = process.env;

  beforeEach(async () => {
    // Reset environment
    process.env = { ...originalEnv };
    // Shutdown any previous telemetry
    await shutdownTelemetry();
  });

  afterEach(async () => {
    process.env = originalEnv;
    await shutdownTelemetry();
  });

  describe('initTelemetry', () => {
    it('should return false when telemetry is disabled', () => {
      const result = initTelemetry({ enabled: false });
      expect(result).toBe(false);
      expect(isTelemetryEnabled()).toBe(false);
    });

    it('should return false when no config is provided and env vars are not set', () => {
      delete process.env.CHADGI_TELEMETRY_ENABLED;
      const result = initTelemetry();
      expect(result).toBe(false);
    });

    it('should initialize telemetry when enabled via config', () => {
      const result = initTelemetry({
        enabled: true,
        trace_exporter: 'console',
        metrics_exporter: 'console',
      });
      expect(result).toBe(true);
      expect(isTelemetryEnabled()).toBe(true);
    });

    it('should initialize telemetry when enabled via environment variable', () => {
      process.env.CHADGI_TELEMETRY_ENABLED = 'true';
      process.env.CHADGI_TELEMETRY_TRACE_EXPORTER = 'console';
      const result = initTelemetry();
      expect(result).toBe(true);
    });

    it('should return true if already initialized', () => {
      initTelemetry({ enabled: true, trace_exporter: 'console' });
      const result = initTelemetry({ enabled: true });
      expect(result).toBe(true);
    });
  });

  describe('getTelemetryConfig', () => {
    it('should return default config when not initialized', async () => {
      await shutdownTelemetry();
      const config = getTelemetryConfig();
      expect(config.enabled).toBe(false);
      expect(config.service_name).toBe('chadgi');
      expect(config.otlp_endpoint).toBe('http://localhost:4318');
      expect(config.prometheus_port).toBe(9464);
      expect(config.sampling_ratio).toBe(1.0);
    });

    it('should return merged config after initialization', () => {
      initTelemetry({
        enabled: true,
        trace_exporter: 'otlp',
        service_name: 'my-chadgi',
      });
      const config = getTelemetryConfig();
      expect(config.enabled).toBe(true);
      expect(config.trace_exporter).toBe('otlp');
      expect(config.service_name).toBe('my-chadgi');
    });

    it('should override config with environment variables', () => {
      process.env.OTEL_SERVICE_NAME = 'env-service';
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://otel-collector:4318';
      initTelemetry({ enabled: true, service_name: 'config-service' });
      const config = getTelemetryConfig();
      expect(config.service_name).toBe('env-service');
      expect(config.otlp_endpoint).toBe('http://otel-collector:4318');
    });
  });

  describe('isTelemetryEnabled', () => {
    it('should return false when not initialized', async () => {
      await shutdownTelemetry();
      expect(isTelemetryEnabled()).toBe(false);
    });

    it('should return true when initialized with enabled=true', () => {
      initTelemetry({ enabled: true, trace_exporter: 'console' });
      expect(isTelemetryEnabled()).toBe(true);
    });
  });

  describe('getTracer', () => {
    it('should return a tracer', () => {
      const tracer = getTracer();
      expect(tracer).toBeDefined();
      expect(typeof tracer.startSpan).toBe('function');
    });
  });

  describe('getMeter', () => {
    it('should return a meter', () => {
      const meter = getMeter();
      expect(meter).toBeDefined();
    });
  });

  describe('getCurrentTraceId', () => {
    it('should return undefined when telemetry is disabled', async () => {
      await shutdownTelemetry();
      expect(getCurrentTraceId()).toBeUndefined();
    });
  });

  describe('getCurrentSpanId', () => {
    it('should return undefined when telemetry is disabled', async () => {
      await shutdownTelemetry();
      expect(getCurrentSpanId()).toBeUndefined();
    });
  });

  describe('span creation helpers', () => {
    beforeEach(() => {
      initTelemetry({ enabled: true, trace_exporter: 'console' });
    });

    describe('startTaskSpan', () => {
      it('should create a task span', () => {
        const span = startTaskSpan('test-task', {
          'chadgi.task.issue_number': 123,
        });
        expect(span).toBeDefined();
        expect(typeof span.end).toBe('function');
      });
    });

    describe('startGitHubSpan', () => {
      it('should create a GitHub operation span', () => {
        const span = startGitHubSpan('move_issue', {
          'chadgi.github.repo': 'owner/repo',
        });
        expect(span).toBeDefined();
      });
    });

    describe('startClaudeSpan', () => {
      it('should create a Claude invocation span', () => {
        const span = startClaudeSpan('phase1', {
          'chadgi.claude.iteration': 1,
        });
        expect(span).toBeDefined();
      });
    });

    describe('endSpanSuccess', () => {
      it('should end span with OK status', () => {
        const span = startTaskSpan('test');
        endSpanSuccess(span, { 'chadgi.duration_ms': 100 });
        expect(span.setStatus).toHaveBeenCalled();
        expect(span.end).toHaveBeenCalled();
      });
    });

    describe('endSpanError', () => {
      it('should end span with ERROR status', () => {
        const span = startTaskSpan('test');
        endSpanError(span, new Error('test error'));
        expect(span.setStatus).toHaveBeenCalled();
        expect(span.recordException).toHaveBeenCalled();
        expect(span.end).toHaveBeenCalled();
      });

      it('should handle string errors', () => {
        const span = startTaskSpan('test');
        endSpanError(span, 'string error');
        expect(span.setStatus).toHaveBeenCalled();
        expect(span.end).toHaveBeenCalled();
      });
    });
  });

  describe('withSpan', () => {
    beforeEach(() => {
      initTelemetry({ enabled: true, trace_exporter: 'console' });
    });

    it('should execute function within span context', () => {
      const result = withSpan('test-operation', (span) => {
        expect(span).toBeDefined();
        return 'result';
      });
      expect(result).toBe('result');
    });

    it('should handle errors', () => {
      expect(() => {
        withSpan('failing-operation', () => {
          throw new Error('test error');
        });
      }).toThrow('test error');
    });
  });

  describe('withSpanAsync', () => {
    beforeEach(() => {
      initTelemetry({ enabled: true, trace_exporter: 'console' });
    });

    it('should execute async function within span context', async () => {
      const result = await withSpanAsync('async-operation', async (span) => {
        expect(span).toBeDefined();
        return Promise.resolve('async result');
      });
      expect(result).toBe('async result');
    });

    it('should handle async errors', async () => {
      await expect(
        withSpanAsync('failing-async', async () => {
          throw new Error('async error');
        })
      ).rejects.toThrow('async error');
    });
  });

  describe('metrics recording', () => {
    beforeEach(() => {
      initTelemetry({ enabled: true, metrics_exporter: 'console' });
    });

    describe('recordTaskCompletion', () => {
      it('should record task completion metric', () => {
        // Should not throw when telemetry is enabled
        expect(() => {
          recordTaskCompletion('completed', 120, 0.05);
        }).not.toThrow();
      });

      it('should not throw when telemetry is disabled', async () => {
        await shutdownTelemetry();
        expect(() => {
          recordTaskCompletion('completed', 120, 0.05);
        }).not.toThrow();
      });
    });

    describe('recordClaudeInvocation', () => {
      it('should record Claude invocation metric', () => {
        expect(() => {
          recordClaudeInvocation('phase1', 1);
        }).not.toThrow();
      });
    });

    describe('recordGitHubOperation', () => {
      it('should record GitHub operation metric', () => {
        expect(() => {
          recordGitHubOperation('move_issue', true);
        }).not.toThrow();
      });
    });
  });

  describe('checkTelemetryHealth', () => {
    it('should return disabled status when telemetry is not enabled', async () => {
      await shutdownTelemetry();
      const health = await checkTelemetryHealth();
      expect(health.enabled).toBe(false);
      expect(health.trace_exporter_status).toBe('disabled');
      expect(health.metrics_exporter_status).toBe('disabled');
    });

    it('should return ok status when telemetry is initialized', async () => {
      initTelemetry({
        enabled: true,
        trace_exporter: 'console',
        metrics_exporter: 'console',
      });
      const health = await checkTelemetryHealth();
      expect(health.enabled).toBe(true);
      expect(health.trace_exporter_status).toBe('ok');
      expect(health.metrics_exporter_status).toBe('ok');
    });
  });

  describe('getPrometheusEndpoint', () => {
    it('should return null when prometheus is not configured', async () => {
      await shutdownTelemetry();
      const endpoint = getPrometheusEndpoint();
      expect(endpoint).toBeNull();
    });
  });

  describe('environment variable parsing', () => {
    it('should parse OTEL_EXPORTER_OTLP_HEADERS', () => {
      process.env.OTEL_EXPORTER_OTLP_HEADERS = 'Authorization=Bearer token,X-Custom=value';
      initTelemetry({ enabled: true });
      const config = getTelemetryConfig();
      expect(config.otlp_headers).toEqual({
        'Authorization': 'Bearer token',
        'X-Custom': 'value',
      });
    });

    it('should parse OTEL_TRACES_SAMPLER_ARG', () => {
      process.env.OTEL_TRACES_SAMPLER_ARG = '0.5';
      initTelemetry({ enabled: true });
      const config = getTelemetryConfig();
      expect(config.sampling_ratio).toBe(0.5);
    });

    it('should parse CHADGI_TELEMETRY_PROMETHEUS_PORT', () => {
      process.env.CHADGI_TELEMETRY_PROMETHEUS_PORT = '9999';
      initTelemetry({ enabled: true });
      const config = getTelemetryConfig();
      expect(config.prometheus_port).toBe(9999);
    });

    it('should parse CHADGI_TELEMETRY_LOG_CORRELATION', () => {
      process.env.CHADGI_TELEMETRY_LOG_CORRELATION = 'true';
      initTelemetry({ enabled: true });
      const config = getTelemetryConfig();
      expect(config.log_correlation).toBe(true);
    });

    it('should ignore invalid sampling ratio', () => {
      process.env.OTEL_TRACES_SAMPLER_ARG = 'invalid';
      initTelemetry({ enabled: true });
      const config = getTelemetryConfig();
      expect(config.sampling_ratio).toBe(1.0); // default
    });

    it('should ignore out-of-range sampling ratio', () => {
      process.env.OTEL_TRACES_SAMPLER_ARG = '1.5';
      initTelemetry({ enabled: true });
      const config = getTelemetryConfig();
      expect(config.sampling_ratio).toBe(1.0); // default
    });
  });

  describe('shutdownTelemetry', () => {
    it('should shutdown cleanly when not initialized', async () => {
      await expect(shutdownTelemetry()).resolves.toBeUndefined();
    });

    it('should shutdown cleanly when initialized', async () => {
      initTelemetry({ enabled: true, trace_exporter: 'console' });
      await expect(shutdownTelemetry()).resolves.toBeUndefined();
      expect(isTelemetryEnabled()).toBe(false);
    });
  });
});

/**
 * Unit tests for src/utils/json-output.ts
 *
 * Tests the unified JSON response wrapper for consistent machine-readable output.
 */

import { jest, beforeEach, afterEach } from '@jest/globals';
import {
  createJsonResponse,
  createJsonError,
  createResponseMeta,
  ErrorCodes,
  isJsonResponse,
  isJsonErrorResponse,
  isJsonSuccessResponse,
  wrapLegacyResponse,
  outputJsonResponse,
  outputJsonData,
  type JsonResponse,
  type ResponseMeta,
  type ResponseError,
  type ResponsePagination,
} from '../../utils/json-output.js';

describe('json-output', () => {
  // Mock console.log for output functions
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    // Mock Date.now for consistent timestamps in tests
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-15T10:30:00Z'));
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    jest.useRealTimers();
  });

  describe('createResponseMeta', () => {
    it('should create metadata with timestamp and version', () => {
      const meta = createResponseMeta({});

      expect(meta.timestamp).toBe('2026-01-15T10:30:00.000Z');
      expect(meta.version).toBeDefined();
      expect(typeof meta.version).toBe('string');
    });

    it('should include command when provided', () => {
      const meta = createResponseMeta({ command: 'queue' });

      expect(meta.command).toBe('queue');
    });

    it('should calculate runtime_ms when startTime is provided', () => {
      // Set start time to 100ms ago
      const startTime = Date.now() - 100;
      const meta = createResponseMeta({ startTime });

      expect(meta.runtime_ms).toBe(100);
    });

    it('should apply overrides', () => {
      const meta = createResponseMeta({
        command: 'test',
        overrides: {
          version: 'custom-version',
        },
      });

      expect(meta.command).toBe('test');
      expect(meta.version).toBe('custom-version');
    });
  });

  describe('createJsonResponse', () => {
    it('should create a successful response with data', () => {
      const data = { tasks: [{ id: 1, title: 'Test' }] };
      const response = createJsonResponse({ data });

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.error).toBeUndefined();
      expect(response.meta).toBeDefined();
      expect(response.meta?.timestamp).toBe('2026-01-15T10:30:00.000Z');
    });

    it('should include command in metadata', () => {
      const response = createJsonResponse({
        data: { value: 1 },
        command: 'history',
      });

      expect(response.meta?.command).toBe('history');
    });

    it('should calculate runtime from startTime', () => {
      const startTime = Date.now() - 250;
      const response = createJsonResponse({
        data: { value: 1 },
        startTime,
      });

      expect(response.meta?.runtime_ms).toBe(250);
    });

    it('should include pagination when provided', () => {
      const pagination: ResponsePagination = {
        total: 100,
        filtered: 50,
        limit: 10,
        offset: 0,
      };
      const response = createJsonResponse({
        data: { items: [] },
        pagination,
      });

      expect(response.pagination).toEqual(pagination);
    });

    it('should not include pagination when not provided', () => {
      const response = createJsonResponse({ data: { value: 1 } });

      expect(response.pagination).toBeUndefined();
    });

    it('should allow custom metadata overrides', () => {
      const response = createJsonResponse({
        data: { value: 1 },
        command: 'test',
        meta: { version: '2.0.0' },
      });

      expect(response.meta?.version).toBe('2.0.0');
      expect(response.meta?.command).toBe('test');
    });
  });

  describe('createJsonError', () => {
    it('should create an error response', () => {
      const response = createJsonError({
        code: 'CONFIG_NOT_FOUND',
        message: 'Configuration file not found',
      });

      expect(response.success).toBe(false);
      expect(response.data).toBeUndefined();
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe('CONFIG_NOT_FOUND');
      expect(response.error?.message).toBe('Configuration file not found');
      expect(response.meta).toBeDefined();
    });

    it('should include details when provided', () => {
      const response = createJsonError({
        code: 'VALIDATION_ERROR',
        message: 'Multiple validation errors',
        details: { errors: ['error1', 'error2'] },
      });

      expect(response.error?.details).toEqual({ errors: ['error1', 'error2'] });
    });

    it('should not include details when not provided', () => {
      const response = createJsonError({
        code: 'UNKNOWN_ERROR',
        message: 'Something went wrong',
      });

      expect(response.error?.details).toBeUndefined();
    });

    it('should include command in metadata', () => {
      const response = createJsonError({
        code: 'GITHUB_AUTH_ERROR',
        message: 'Not authenticated',
        command: 'validate',
      });

      expect(response.meta?.command).toBe('validate');
    });

    it('should calculate runtime from startTime', () => {
      const startTime = Date.now() - 500;
      const response = createJsonError({
        code: 'TIMEOUT',
        message: 'Request timed out',
        startTime,
      });

      expect(response.meta?.runtime_ms).toBe(500);
    });
  });

  describe('ErrorCodes', () => {
    it('should define standard error codes', () => {
      expect(ErrorCodes.CONFIG_NOT_FOUND).toBe('CONFIG_NOT_FOUND');
      expect(ErrorCodes.CONFIG_INVALID).toBe('CONFIG_INVALID');
      expect(ErrorCodes.NOT_INITIALIZED).toBe('NOT_INITIALIZED');
      expect(ErrorCodes.GITHUB_AUTH_ERROR).toBe('GITHUB_AUTH_ERROR');
      expect(ErrorCodes.GITHUB_API_ERROR).toBe('GITHUB_API_ERROR');
      expect(ErrorCodes.PROJECT_NOT_FOUND).toBe('PROJECT_NOT_FOUND');
      expect(ErrorCodes.ISSUE_NOT_FOUND).toBe('ISSUE_NOT_FOUND');
      expect(ErrorCodes.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
      expect(ErrorCodes.INVALID_ARGUMENT).toBe('INVALID_ARGUMENT');
      expect(ErrorCodes.COMMAND_FAILED).toBe('COMMAND_FAILED');
      expect(ErrorCodes.TIMEOUT).toBe('TIMEOUT');
      expect(ErrorCodes.BUDGET_EXCEEDED).toBe('BUDGET_EXCEEDED');
      expect(ErrorCodes.FILE_NOT_FOUND).toBe('FILE_NOT_FOUND');
      expect(ErrorCodes.LOCK_HELD).toBe('LOCK_HELD');
      expect(ErrorCodes.UNKNOWN_ERROR).toBe('UNKNOWN_ERROR');
    });
  });

  describe('isJsonResponse', () => {
    it('should return true for valid JsonResponse', () => {
      const response: JsonResponse = { success: true, data: {} };
      expect(isJsonResponse(response)).toBe(true);
    });

    it('should return true for error response', () => {
      const response: JsonResponse = {
        success: false,
        error: { code: 'ERROR', message: 'test' },
      };
      expect(isJsonResponse(response)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isJsonResponse(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isJsonResponse(undefined)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isJsonResponse('string')).toBe(false);
      expect(isJsonResponse(123)).toBe(false);
    });

    it('should return false for object without success property', () => {
      expect(isJsonResponse({ data: {} })).toBe(false);
    });

    it('should return false for object with non-boolean success', () => {
      expect(isJsonResponse({ success: 'true' })).toBe(false);
    });
  });

  describe('isJsonErrorResponse', () => {
    it('should return true for error response', () => {
      const response = createJsonError({
        code: 'ERROR',
        message: 'test',
      });
      expect(isJsonErrorResponse(response)).toBe(true);
    });

    it('should return false for success response', () => {
      const response = createJsonResponse({ data: {} });
      expect(isJsonErrorResponse(response)).toBe(false);
    });
  });

  describe('isJsonSuccessResponse', () => {
    it('should return true for success response with data', () => {
      const response = createJsonResponse({ data: { value: 1 } });
      expect(isJsonSuccessResponse(response)).toBe(true);
    });

    it('should return false for error response', () => {
      const response = createJsonError({
        code: 'ERROR',
        message: 'test',
      });
      expect(isJsonSuccessResponse(response)).toBe(false);
    });

    it('should return false for success response without data', () => {
      const response: JsonResponse = { success: true };
      expect(isJsonSuccessResponse(response)).toBe(false);
    });
  });

  describe('wrapLegacyResponse', () => {
    it('should wrap legacy data in unified format', () => {
      const legacyData = { tasks: [], count: 0 };
      const response = wrapLegacyResponse(legacyData);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(legacyData);
      expect(response.meta).toBeDefined();
    });

    it('should accept additional options', () => {
      const legacyData = { items: [] };
      const response = wrapLegacyResponse(legacyData, {
        command: 'legacy-command',
        pagination: { total: 10, limit: 5 },
      });

      expect(response.meta?.command).toBe('legacy-command');
      expect(response.pagination).toEqual({ total: 10, limit: 5 });
    });
  });

  describe('outputJsonResponse', () => {
    it('should output pretty-printed JSON by default', () => {
      const response = createJsonResponse({ data: { test: 'value' } });
      outputJsonResponse(response);

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const output = consoleLogSpy.mock.calls[0][0] as string;
      expect(output).toContain('\n'); // Pretty-printed has newlines
      expect(JSON.parse(output)).toEqual(response);
    });

    it('should output compact JSON when pretty=false', () => {
      const response = createJsonResponse({ data: { test: 'value' } });
      outputJsonResponse(response, false);

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const output = consoleLogSpy.mock.calls[0][0] as string;
      expect(output).not.toContain('\n'); // Compact has no newlines
      expect(JSON.parse(output)).toEqual(response);
    });
  });

  describe('outputJsonData', () => {
    it('should wrap data and output it', () => {
      outputJsonData({ items: [1, 2, 3] });

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.success).toBe(true);
      expect(output.data).toEqual({ items: [1, 2, 3] });
    });

    it('should accept options for the response', () => {
      outputJsonData({ value: 1 }, { command: 'test-cmd' });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.meta?.command).toBe('test-cmd');
    });
  });

  describe('response structure consistency', () => {
    it('should always have success field', () => {
      const successResponse = createJsonResponse({ data: {} });
      const errorResponse = createJsonError({ code: 'E', message: 'm' });

      expect(successResponse).toHaveProperty('success');
      expect(errorResponse).toHaveProperty('success');
    });

    it('should always have meta field', () => {
      const successResponse = createJsonResponse({ data: {} });
      const errorResponse = createJsonError({ code: 'E', message: 'm' });

      expect(successResponse).toHaveProperty('meta');
      expect(errorResponse).toHaveProperty('meta');
      expect(successResponse.meta).toHaveProperty('timestamp');
      expect(successResponse.meta).toHaveProperty('version');
      expect(errorResponse.meta).toHaveProperty('timestamp');
      expect(errorResponse.meta).toHaveProperty('version');
    });

    it('success response should have data, not error', () => {
      const response = createJsonResponse({ data: { test: 1 } });

      expect(response).toHaveProperty('data');
      expect(response).not.toHaveProperty('error');
    });

    it('error response should have error, not data', () => {
      const response = createJsonError({ code: 'E', message: 'm' });

      expect(response).toHaveProperty('error');
      expect(response).not.toHaveProperty('data');
    });
  });

  describe('backwards compatibility and opt-in behavior', () => {
    it('unified format is opt-in via jsonUnified option or CHADGI_JSON_UNIFIED env', () => {
      // This documents the opt-in behavior:
      // - Commands check options.jsonUnified || process.env.CHADGI_JSON_UNIFIED === '1'
      // - When not enabled, commands return legacy format directly
      // - When enabled, commands wrap response with createJsonResponse()

      // Legacy format example (returned when NOT opted-in):
      const legacyFormat = { tasks: [], count: 0 };

      // Unified format (returned when opted-in):
      const unifiedFormat = createJsonResponse({ data: legacyFormat, command: 'test' });

      // Verify unified format has wrapper structure
      expect(unifiedFormat).toHaveProperty('success', true);
      expect(unifiedFormat).toHaveProperty('data');
      expect(unifiedFormat).toHaveProperty('meta');
      expect(unifiedFormat.data).toEqual(legacyFormat);
    });

    it('wrapLegacyResponse can convert existing responses', () => {
      // Useful for migrating scripts that already consume legacy format
      const legacyData = { state: 'running', currentTask: { id: '42' } };
      const wrapped = wrapLegacyResponse(legacyData, { command: 'status' });

      expect(wrapped.success).toBe(true);
      expect(wrapped.data).toEqual(legacyData);
      expect(wrapped.meta?.command).toBe('status');
    });
  });

  describe('real-world usage scenarios', () => {
    it('should work for queue command response', () => {
      const response = createJsonResponse({
        data: {
          readyColumn: 'Ready',
          taskCount: 3,
          tasks: [
            { number: 1, title: 'Task 1' },
            { number: 2, title: 'Task 2' },
            { number: 3, title: 'Task 3' },
          ],
        },
        command: 'queue',
        startTime: Date.now() - 150,
        pagination: { total: 3 },
      });

      expect(response.success).toBe(true);
      expect(response.data?.taskCount).toBe(3);
      expect(response.meta?.command).toBe('queue');
      expect(response.meta?.runtime_ms).toBe(150);
      expect(response.pagination?.total).toBe(3);
    });

    it('should work for history command response', () => {
      const response = createJsonResponse({
        data: {
          entries: [
            { issueNumber: 42, outcome: 'success', elapsedTime: 300 },
          ],
          total: 10,
          filtered: 1,
        },
        command: 'history',
        pagination: {
          total: 10,
          filtered: 1,
          limit: 1,
        },
      });

      expect(response.success).toBe(true);
      expect(response.data?.entries).toHaveLength(1);
      expect(response.pagination?.total).toBe(10);
      expect(response.pagination?.filtered).toBe(1);
    });

    it('should work for validation error response', () => {
      const response = createJsonError({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Configuration validation failed',
        details: {
          errors: [
            'github.repo is required',
            'github.project_number must be a number',
          ],
        },
        command: 'validate',
      });

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('VALIDATION_ERROR');
      expect(response.error?.details?.errors).toHaveLength(2);
    });

    it('should work for GitHub auth error response', () => {
      const response = createJsonError({
        code: ErrorCodes.GITHUB_AUTH_ERROR,
        message: 'GitHub CLI not authenticated. Run: gh auth login',
        command: 'validate',
      });

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('GITHUB_AUTH_ERROR');
      expect(response.error?.message).toContain('gh auth login');
    });
  });
});

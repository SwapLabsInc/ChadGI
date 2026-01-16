/**
 * Debug and trace logging utilities for ChadGI.
 *
 * Provides functions for verbose and trace output to help with troubleshooting.
 * Output goes to stderr so stdout remains parseable for --json mode.
 *
 * Usage:
 * - Verbose mode shows: config resolution, file operations, decision points
 * - Trace mode adds: full API request/response bodies, timing for each operation
 *
 * Control via:
 * - CLI flags: --verbose / -v, --trace
 * - Environment variables: CHADGI_VERBOSE=1, CHADGI_TRACE=1
 *
 * OpenTelemetry Integration:
 * - When telemetry is enabled, timing functions create spans
 * - Spans provide distributed tracing across task execution
 * - Log correlation adds trace/span IDs to log output
 */
/**
 * Verbosity levels for debug output
 */
export type VerbosityLevel = 'silent' | 'normal' | 'verbose' | 'trace';
/**
 * Debug logging configuration
 */
export interface DebugConfig {
    /** Current verbosity level */
    level: VerbosityLevel;
    /** Whether to include timestamps in output */
    timestamps: boolean;
    /** Whether to mask sensitive data */
    maskSecrets: boolean;
}
/**
 * Environment variable names for controlling verbosity
 */
export declare const ENV_VERBOSE = "CHADGI_VERBOSE";
export declare const ENV_TRACE = "CHADGI_TRACE";
/**
 * Debug output prefixes
 */
export declare const PREFIX_DEBUG = "[DEBUG]";
export declare const PREFIX_TRACE = "[TRACE]";
/**
 * Initialize debug configuration from environment variables.
 * Should be called early in CLI startup.
 *
 * Environment variables:
 * - CHADGI_VERBOSE=1 enables verbose mode
 * - CHADGI_TRACE=1 enables trace mode (includes verbose)
 */
export declare function initDebugFromEnv(): void;
/**
 * Get the current debug configuration
 */
export declare function getDebugConfig(): Readonly<DebugConfig>;
/**
 * Set the verbosity level
 *
 * @param level - The verbosity level to set
 */
export declare function setVerbosityLevel(level: VerbosityLevel): void;
/**
 * Enable verbose mode (--verbose / -v flag)
 */
export declare function enableVerbose(): void;
/**
 * Enable trace mode (--trace flag)
 */
export declare function enableTrace(): void;
/**
 * Disable all debug output
 */
export declare function disableDebug(): void;
/**
 * Reset debug configuration to defaults
 */
export declare function resetDebugConfig(): void;
/**
 * Configure whether to show timestamps
 *
 * @param enabled - Whether to show timestamps
 */
export declare function setTimestamps(enabled: boolean): void;
/**
 * Configure whether to mask secrets in debug output
 *
 * @param enabled - Whether to mask secrets
 */
export declare function setMaskSecretsInDebug(enabled: boolean): void;
/**
 * Check if verbose logging is enabled
 */
export declare function isVerbose(): boolean;
/**
 * Check if trace logging is enabled
 */
export declare function isTrace(): boolean;
/**
 * Log a verbose debug message to stderr.
 *
 * Only outputs when verbose or trace mode is enabled.
 * Automatically masks sensitive data.
 *
 * @param message - The debug message
 * @param data - Optional additional data to log
 *
 * @example
 * ```ts
 * debugLog('Loading config from', configPath);
 * debugLog('Config resolved', { github: config.github, branch: config.branch });
 * ```
 */
export declare function debugLog(message: string, data?: unknown): void;
/**
 * Log a trace message to stderr.
 *
 * Only outputs when trace mode is enabled.
 * Automatically masks sensitive data.
 * Use for detailed information like API payloads.
 *
 * @param message - The trace message
 * @param data - Optional additional data to log
 *
 * @example
 * ```ts
 * traceLog('API request', { method: 'GET', url: '/issues' });
 * traceLog('API response', responseBody);
 * ```
 */
export declare function traceLog(message: string, data?: unknown): void;
/**
 * Log the start of a timed operation for performance analysis.
 * Returns a function to call when the operation completes.
 *
 * When telemetry is enabled, also creates an OpenTelemetry span for distributed tracing.
 * Only outputs to console when verbose or trace mode is enabled.
 *
 * @param operationName - Name of the operation being timed
 * @param attributes - Optional attributes to add to the span
 * @returns A function to call when the operation completes
 *
 * @example
 * ```ts
 * const endTiming = startTiming('fetch issues');
 * const issues = await fetchIssues();
 * endTiming(); // Logs: "[DEBUG] fetch issues completed in 123ms"
 * ```
 */
export declare function startTiming(operationName: string, attributes?: Record<string, string | number | boolean>): (error?: Error | string) => void;
/**
 * Log the start of a timed operation at trace level.
 * Returns a function to call when the operation completes.
 *
 * When telemetry is enabled, also creates an OpenTelemetry span for distributed tracing.
 * Only outputs to console when trace mode is enabled.
 *
 * @param operationName - Name of the operation being timed
 * @param attributes - Optional attributes to add to the span
 * @returns A function to call when the operation completes
 *
 * @example
 * ```ts
 * const endTiming = startTraceTiming('gh api call');
 * const result = await ghApiCall();
 * endTiming(result); // Logs timing and result at trace level
 * ```
 */
export declare function startTraceTiming(operationName: string, attributes?: Record<string, string | number | boolean>): (result?: unknown, error?: Error | string) => void;
/**
 * Debug log for decision points in the code.
 * Helps understand why certain paths were taken.
 *
 * @param decision - Description of the decision
 * @param reason - Why this decision was made
 * @param context - Optional additional context
 *
 * @example
 * ```ts
 * debugDecision('Skipping task', 'budget exceeded', { taskCost: 5.00, limit: 2.00 });
 * ```
 */
export declare function debugDecision(decision: string, reason: string, context?: unknown): void;
/**
 * Debug log for file operations.
 *
 * @param operation - The operation (read, write, delete, etc.)
 * @param path - The file path
 * @param details - Optional details about the operation
 *
 * @example
 * ```ts
 * debugFileOp('read', '/path/to/config.yaml');
 * debugFileOp('write', '/path/to/progress.json', { size: 1234 });
 * ```
 */
export declare function debugFileOp(operation: string, path: string, details?: unknown): void;
/**
 * Trace log for API calls.
 * Logs request details and optionally response.
 *
 * @param method - HTTP method or command
 * @param endpoint - API endpoint or command
 * @param requestData - Optional request payload
 *
 * @example
 * ```ts
 * traceApi('gh', 'issue view 123 --repo owner/repo --json title,body');
 * ```
 */
export declare function traceApi(method: string, endpoint: string, requestData?: unknown): void;
/**
 * Trace log for API responses.
 *
 * @param endpoint - API endpoint or command
 * @param responseData - Response data
 * @param durationMs - Optional duration in milliseconds
 *
 * @example
 * ```ts
 * traceApiResponse('issue view', issueData, 150);
 * ```
 */
export declare function traceApiResponse(endpoint: string, responseData: unknown, durationMs?: number): void;
//# sourceMappingURL=debug.d.ts.map
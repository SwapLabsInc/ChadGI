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
 */
import { maskSecrets } from './secrets.js';
import { colors } from './colors.js';
/**
 * Global debug configuration state
 */
let debugConfig = {
    level: 'normal',
    timestamps: true,
    maskSecrets: true,
};
/**
 * Environment variable names for controlling verbosity
 */
export const ENV_VERBOSE = 'CHADGI_VERBOSE';
export const ENV_TRACE = 'CHADGI_TRACE';
/**
 * Debug output prefixes
 */
export const PREFIX_DEBUG = '[DEBUG]';
export const PREFIX_TRACE = '[TRACE]';
/**
 * Initialize debug configuration from environment variables.
 * Should be called early in CLI startup.
 *
 * Environment variables:
 * - CHADGI_VERBOSE=1 enables verbose mode
 * - CHADGI_TRACE=1 enables trace mode (includes verbose)
 */
export function initDebugFromEnv() {
    const trace = process.env[ENV_TRACE];
    const verbose = process.env[ENV_VERBOSE];
    if (trace === '1' || trace === 'true') {
        debugConfig.level = 'trace';
    }
    else if (verbose === '1' || verbose === 'true') {
        debugConfig.level = 'verbose';
    }
}
/**
 * Get the current debug configuration
 */
export function getDebugConfig() {
    return { ...debugConfig };
}
/**
 * Set the verbosity level
 *
 * @param level - The verbosity level to set
 */
export function setVerbosityLevel(level) {
    debugConfig.level = level;
}
/**
 * Enable verbose mode (--verbose / -v flag)
 */
export function enableVerbose() {
    if (debugConfig.level !== 'trace') {
        debugConfig.level = 'verbose';
    }
}
/**
 * Enable trace mode (--trace flag)
 */
export function enableTrace() {
    debugConfig.level = 'trace';
}
/**
 * Disable all debug output
 */
export function disableDebug() {
    debugConfig.level = 'silent';
}
/**
 * Reset debug configuration to defaults
 */
export function resetDebugConfig() {
    debugConfig = {
        level: 'normal',
        timestamps: true,
        maskSecrets: true,
    };
}
/**
 * Configure whether to show timestamps
 *
 * @param enabled - Whether to show timestamps
 */
export function setTimestamps(enabled) {
    debugConfig.timestamps = enabled;
}
/**
 * Configure whether to mask secrets in debug output
 *
 * @param enabled - Whether to mask secrets
 */
export function setMaskSecretsInDebug(enabled) {
    debugConfig.maskSecrets = enabled;
}
/**
 * Check if verbose logging is enabled
 */
export function isVerbose() {
    return debugConfig.level === 'verbose' || debugConfig.level === 'trace';
}
/**
 * Check if trace logging is enabled
 */
export function isTrace() {
    return debugConfig.level === 'trace';
}
/**
 * Format a timestamp for debug output
 */
function formatTimestamp() {
    if (!debugConfig.timestamps) {
        return '';
    }
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${ms} `;
}
/**
 * Format and optionally mask a message for output
 */
function formatMessage(message) {
    if (debugConfig.maskSecrets) {
        return maskSecrets(message);
    }
    return message;
}
/**
 * Format data for output, handling objects and sensitive data
 */
function formatData(data) {
    if (data === undefined) {
        return '';
    }
    let stringified;
    if (typeof data === 'string') {
        stringified = data;
    }
    else if (typeof data === 'object' && data !== null) {
        try {
            stringified = JSON.stringify(data, null, 2);
        }
        catch {
            stringified = String(data);
        }
    }
    else {
        stringified = String(data);
    }
    return formatMessage(stringified);
}
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
export function debugLog(message, data) {
    if (!isVerbose()) {
        return;
    }
    const timestamp = formatTimestamp();
    const prefix = `${colors.cyan}${PREFIX_DEBUG}${colors.reset}`;
    const formattedMessage = formatMessage(message);
    if (data !== undefined) {
        const formattedData = formatData(data);
        process.stderr.write(`${prefix} ${timestamp}${formattedMessage} ${formattedData}\n`);
    }
    else {
        process.stderr.write(`${prefix} ${timestamp}${formattedMessage}\n`);
    }
}
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
export function traceLog(message, data) {
    if (!isTrace()) {
        return;
    }
    const timestamp = formatTimestamp();
    const prefix = `${colors.magenta}${PREFIX_TRACE}${colors.reset}`;
    const formattedMessage = formatMessage(message);
    if (data !== undefined) {
        const formattedData = formatData(data);
        process.stderr.write(`${prefix} ${timestamp}${formattedMessage} ${formattedData}\n`);
    }
    else {
        process.stderr.write(`${prefix} ${timestamp}${formattedMessage}\n`);
    }
}
/**
 * Log the start of a timed operation for performance analysis.
 * Returns a function to call when the operation completes.
 *
 * Only outputs when verbose or trace mode is enabled.
 *
 * @param operationName - Name of the operation being timed
 * @returns A function to call when the operation completes
 *
 * @example
 * ```ts
 * const endTiming = startTiming('fetch issues');
 * const issues = await fetchIssues();
 * endTiming(); // Logs: "[DEBUG] fetch issues completed in 123ms"
 * ```
 */
export function startTiming(operationName) {
    if (!isVerbose()) {
        return () => { };
    }
    const startTime = performance.now();
    debugLog(`${operationName} started`);
    return () => {
        const duration = performance.now() - startTime;
        debugLog(`${operationName} completed in ${duration.toFixed(1)}ms`);
    };
}
/**
 * Log the start of a timed operation at trace level.
 * Returns a function to call when the operation completes.
 *
 * Only outputs when trace mode is enabled.
 *
 * @param operationName - Name of the operation being timed
 * @returns A function to call when the operation completes
 *
 * @example
 * ```ts
 * const endTiming = startTraceTiming('gh api call');
 * const result = await ghApiCall();
 * endTiming(result); // Logs timing and result at trace level
 * ```
 */
export function startTraceTiming(operationName) {
    if (!isTrace()) {
        return () => { };
    }
    const startTime = performance.now();
    traceLog(`${operationName} started`);
    return (result) => {
        const duration = performance.now() - startTime;
        if (result !== undefined) {
            traceLog(`${operationName} completed in ${duration.toFixed(1)}ms`, result);
        }
        else {
            traceLog(`${operationName} completed in ${duration.toFixed(1)}ms`);
        }
    };
}
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
export function debugDecision(decision, reason, context) {
    if (!isVerbose()) {
        return;
    }
    if (context !== undefined) {
        debugLog(`Decision: ${decision} - ${reason}`, context);
    }
    else {
        debugLog(`Decision: ${decision} - ${reason}`);
    }
}
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
export function debugFileOp(operation, path, details) {
    if (!isVerbose()) {
        return;
    }
    if (details !== undefined) {
        debugLog(`File ${operation}: ${path}`, details);
    }
    else {
        debugLog(`File ${operation}: ${path}`);
    }
}
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
export function traceApi(method, endpoint, requestData) {
    if (!isTrace()) {
        return;
    }
    const message = `API ${method}: ${endpoint}`;
    if (requestData !== undefined) {
        traceLog(message, requestData);
    }
    else {
        traceLog(message);
    }
}
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
export function traceApiResponse(endpoint, responseData, durationMs) {
    if (!isTrace()) {
        return;
    }
    const timing = durationMs !== undefined ? ` (${durationMs.toFixed(1)}ms)` : '';
    traceLog(`API response: ${endpoint}${timing}`, responseData);
}
//# sourceMappingURL=debug.js.map
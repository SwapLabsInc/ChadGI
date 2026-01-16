/**
 * Shared utilities index for ChadGI.
 *
 * Re-exports all utility modules for convenient importing.
 */
// Colors
export { colors } from './colors.js';
// Configuration
export { parseYamlValue, parseYamlNested, parseYamlBoolean, parseYamlNumber, resolveConfigPath, resolveChadgiDir, loadConfig, chadgiDirExists, ensureChadgiDirExists, getRepoOwner, getRepoName, } from './config.js';
// Errors
export { 
// Error classes
ChadGIError, ConfigError, ConfigNotFoundError, NotInitializedError, GitHubError, GitHubAuthError, ProjectNotFoundError, GitError, ValidationError, FileError, BudgetExceededError, TaskTimeoutError, MaxIterationsError, 
// Error utilities
isChadGIError, getErrorCode, getErrorMessage, 
// Error context functions
createErrorContext, attachContext, hasErrorContext, getErrorContext, withContext, withContextAsync, serializeError, } from './errors.js';
// Formatting
export { formatDuration, formatDurationMs, formatDate, formatShortDate, formatRelativeTime, formatCost, formatBytes, formatPercent, formatNumber, truncate, pad, parseSince, horizontalLine, toISOString, parseDuration, } from './formatting.js';
// GitHub
export { 
// Retry configuration
RETRY_DEFAULTS, sleep, calculateBackoffDelay, classifyError, isRecoverableError, 
// Basic execution
execGh, execGhJson, safeExecGh, safeExecGhJson, 
// Retry-aware execution
execGhWithRetry, execGhJsonWithRetry, safeExecGhWithRetry, safeExecGhJsonWithRetry, 
// Issue operations
fetchIssue, fetchIssueTitle, fetchIssueBody, fetchIssueLabels, issueExists, addIssueLabel, 
// PR operations
fetchPrUrl, listOpenPrs, 
// Project operations
fetchProjectItems, fetchProjectFields, fetchProjects, moveProjectItem, addIssueToProject, 
// Rate limit
fetchRateLimit, } from './github.js';
// Data
export { loadSessionStats, getMostRecentSession, loadTaskMetrics, loadMetricsData, getFailedTaskMetrics, getCompletedTaskMetrics, loadProgressData, loadPauseLock, isPaused, findPendingApproval, listApprovalLocks, loadJsonFile, fileExists, readTextFile, loadTaskLock, loadAllTaskLocks, loadStaleLocks, isTaskLockStale, } from './data.js';
// Secrets
export { SECRET_PATTERNS, REDACTED_PLACEHOLDER, SENSITIVE_KEYS, setMaskingDisabled, isMaskingDisabled, maskSecrets, maskObject, maskJsonString, isSensitiveKey, maskSensitiveKeys, createMaskedLogger, } from './secrets.js';
// Validation
export { NUMERIC_CONSTRAINTS, validateNumeric, createNumericParser, validateNumericOptions, formatConstraintBounds, } from './validation.js';
// File Operations (atomic writes and safe parsing)
export { 
// Atomic write functions
atomicWriteFile, atomicWriteJson, 
// Safe write functions with retry
safeWriteFile, safeWriteJson, 
// Safe parsing functions
safeParseJson, safeParseAndValidate, 
// Context-aware file operations
readFileWithContext, writeFileWithContext, writeJsonWithContext, safeWriteFileWithContext, safeWriteJsonWithContext, existsWithContext, deleteFileWithContext, } from './fileOps.js';
// Data Schema (JSON validation and bounds checking)
export { 
// Constants
DATA_BOUNDS, 
// Schemas
SESSION_STATS_SCHEMA, TASK_METRICS_SCHEMA, METRICS_DATA_SCHEMA, TASK_LOCK_DATA_SCHEMA, PROGRESS_DATA_SCHEMA, PAUSE_LOCK_DATA_SCHEMA, APPROVAL_LOCK_DATA_SCHEMA, 
// Functions
validateSchema, validateArray, getSchema, } from './data-schema.js';
// Progress (progress bars and spinners)
export { ProgressBar, Spinner, createProgressBar, createSpinner, } from './progress.js';
// Locks (task lock utilities)
export { DEFAULT_LOCK_TIMEOUT_MINUTES, HEARTBEAT_INTERVAL_MS, LOCKS_DIRECTORY, generateSessionId, getLocksDir, getLockFilePath, ensureLocksDir, readTaskLock, isLockStale, isProcessRunning, acquireTaskLock, releaseTaskLock, forceReleaseTaskLock, updateLockHeartbeat, listTaskLocks, findStaleLocks, cleanupStaleLocks, isIssueLocked, isLockedByOther, startHeartbeat, releaseAllSessionLocks, } from './locks.js';
// Debug (verbose and trace logging)
export { 
// Configuration
ENV_VERBOSE, ENV_TRACE, PREFIX_DEBUG, PREFIX_TRACE, initDebugFromEnv, getDebugConfig, setVerbosityLevel, enableVerbose, enableTrace, disableDebug, resetDebugConfig, setTimestamps, setMaskSecretsInDebug, isVerbose, isTrace, 
// Logging functions
debugLog, traceLog, startTiming, startTraceTiming, debugDecision, debugFileOp, traceApi, traceApiResponse, } from './debug.js';
// Command Context
export { createCoreContext, hasDirectoryContext, hasConfigContext, hasTimingContext, hasFullContext, } from './context.js';
// Middleware
export { 
// Exit codes
EXIT_CODES, 
// Middleware composition
composeMiddleware, 
// Built-in middlewares
withTiming, withDirectory, withDirectoryValidation, withConfig, withJsonOutput, withErrorHandler, 
// Higher-order command wrapper
withCommand, 
// Convenience presets
standardDirectoryMiddleware, standardConfigMiddleware, withDirectoryCommand, withConfigCommand, 
// Opt-out helpers
conditionalMiddleware, passthrough, } from './middleware.js';
// High-level GitHub Client
export { 
// Main client (use gh.issue, gh.pr, gh.project, gh.api)
gh, 
// Error types
GhClientError, } from './gh-client.js';
// Text UI (CLI output formatting components)
export { 
// Terminal utilities
getTerminalWidth, 
// Table component
Table, 
// Section component
Section, 
// Badge utilities
Badge, BracketedBadge, BadgeStyles, 
// Status icons
StatusIcon, StatusIcons, 
// InfoBox component
InfoBox, 
// Convenience functions
printSectionHeader, printTable, printInfoBox, keyValue, divider, } from './textui.js';
// JSON Output (unified response wrapper)
export { 
// Factory functions
createResponseMeta, createJsonResponse, createJsonError, createJsonErrorFromError, 
// Error codes
ErrorCodes, 
// Type guards
isJsonResponse, isJsonErrorResponse, isJsonSuccessResponse, 
// Utilities
wrapLegacyResponse, outputJsonResponse, outputJsonData, } from './json-output.js';
// CLI Options (centralized option definitions)
export { 
// Constants
STANDARD_OPTION_NAMES, OPTION_DEFINITIONS, DEFAULT_CONFIG_PATH, 
// Helper functions
addStandardOption, addStandardOptions, getOptionDefinition, isStandardOption, hasOption, } from './cli-options.js';
// Diagnostics (silent error logging)
export { 
// Types
ErrorCategory, 
// Core functions
logSilentError, 
// Registry functions
getSilentErrorSummary, getAllSilentErrors, clearSilentErrors, getSilentErrorCount, hasUnknownErrors, formatErrorSummary, } from './diagnostics.js';
//# sourceMappingURL=index.js.map
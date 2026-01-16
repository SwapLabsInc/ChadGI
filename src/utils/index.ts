/**
 * Shared utilities index for ChadGI.
 *
 * Re-exports all utility modules for convenient importing.
 */

// Colors
export { colors, type ColorName } from './colors.js';

// Configuration
export {
  parseYamlValue,
  parseYamlNested,
  parseYamlBoolean,
  parseYamlNumber,
  resolveConfigPath,
  resolveChadgiDir,
  loadConfig,
  chadgiDirExists,
  ensureChadgiDirExists,
  getRepoOwner,
  getRepoName,
  type EnsureChadgiDirOptions,
} from './config.js';

// Errors
export {
  ChadGIError,
  ConfigError,
  ConfigNotFoundError,
  NotInitializedError,
  GitHubError,
  GitHubAuthError,
  ProjectNotFoundError,
  GitError,
  ValidationError,
  FileError,
  BudgetExceededError,
  TaskTimeoutError,
  MaxIterationsError,
  isChadGIError,
  getErrorCode,
  getErrorMessage,
} from './errors.js';

// Formatting
export {
  formatDuration,
  formatDurationMs,
  formatDate,
  formatShortDate,
  formatRelativeTime,
  formatCost,
  formatBytes,
  formatPercent,
  formatNumber,
  truncate,
  pad,
  parseSince,
  horizontalLine,
  toISOString,
  parseDuration,
} from './formatting.js';

// GitHub
export {
  // Retry configuration
  RETRY_DEFAULTS,
  sleep,
  calculateBackoffDelay,
  classifyError,
  isRecoverableError,
  // Basic execution
  execGh,
  execGhJson,
  safeExecGh,
  safeExecGhJson,
  // Retry-aware execution
  execGhWithRetry,
  execGhJsonWithRetry,
  safeExecGhWithRetry,
  safeExecGhJsonWithRetry,
  // Issue operations
  fetchIssue,
  fetchIssueTitle,
  fetchIssueBody,
  fetchIssueLabels,
  issueExists,
  addIssueLabel,
  // PR operations
  fetchPrUrl,
  listOpenPrs,
  // Project operations
  fetchProjectItems,
  fetchProjectFields,
  fetchProjects,
  moveProjectItem,
  addIssueToProject,
  // Rate limit
  fetchRateLimit,
  // Types
  type RetryOptions,
  type ErrorClassification,
  type ExecOptions,
  type ExecWithRetryOptions,
  type IssueData,
  type PullRequestData,
  type ProjectItem,
  type ProjectItemsResponse,
  type ProjectField,
  type ProjectData,
  type RateLimitResponse,
} from './github.js';

// Data
export {
  loadSessionStats,
  getMostRecentSession,
  loadTaskMetrics,
  loadMetricsData,
  getFailedTaskMetrics,
  getCompletedTaskMetrics,
  loadProgressData,
  loadPauseLock,
  isPaused,
  findPendingApproval,
  listApprovalLocks,
  loadJsonFile,
  fileExists,
  readTextFile,
  loadTaskLock,
  loadAllTaskLocks,
  loadStaleLocks,
  isTaskLockStale,
} from './data.js';

// Secrets
export {
  SECRET_PATTERNS,
  REDACTED_PLACEHOLDER,
  SENSITIVE_KEYS,
  setMaskingDisabled,
  isMaskingDisabled,
  maskSecrets,
  maskObject,
  maskJsonString,
  isSensitiveKey,
  maskSensitiveKeys,
  createMaskedLogger,
} from './secrets.js';

// Validation
export {
  NUMERIC_CONSTRAINTS,
  validateNumeric,
  createNumericParser,
  validateNumericOptions,
  formatConstraintBounds,
  type NumericConstraint,
  type ConstraintName,
  type ValidationResult,
} from './validation.js';

// File Operations (atomic writes)
export {
  atomicWriteFile,
  atomicWriteJson,
  safeWriteFile,
  safeWriteJson,
  type SafeWriteOptions,
} from './fileOps.js';

// Progress (progress bars and spinners)
export {
  ProgressBar,
  Spinner,
  createProgressBar,
  createSpinner,
  type ProgressBarOptions,
} from './progress.js';

// Locks (task lock utilities)
export {
  DEFAULT_LOCK_TIMEOUT_MINUTES,
  HEARTBEAT_INTERVAL_MS,
  LOCKS_DIRECTORY,
  generateSessionId,
  getLocksDir,
  getLockFilePath,
  ensureLocksDir,
  readTaskLock,
  isLockStale,
  isProcessRunning,
  acquireTaskLock,
  releaseTaskLock,
  forceReleaseTaskLock,
  updateLockHeartbeat,
  listTaskLocks,
  findStaleLocks,
  cleanupStaleLocks,
  isIssueLocked,
  isLockedByOther,
  startHeartbeat,
  releaseAllSessionLocks,
} from './locks.js';

// Debug (verbose and trace logging)
export {
  // Configuration
  ENV_VERBOSE,
  ENV_TRACE,
  PREFIX_DEBUG,
  PREFIX_TRACE,
  initDebugFromEnv,
  getDebugConfig,
  setVerbosityLevel,
  enableVerbose,
  enableTrace,
  disableDebug,
  resetDebugConfig,
  setTimestamps,
  setMaskSecretsInDebug,
  isVerbose,
  isTrace,
  // Logging functions
  debugLog,
  traceLog,
  startTiming,
  startTraceTiming,
  debugDecision,
  debugFileOp,
  traceApi,
  traceApiResponse,
  // Types
  type VerbosityLevel,
  type DebugConfig,
} from './debug.js';

// Command Context
export {
  createCoreContext,
  hasDirectoryContext,
  hasConfigContext,
  hasTimingContext,
  hasFullContext,
  type CoreContext,
  type DirectoryContext,
  type ConfigContext,
  type TimedContext,
  type CommandContext,
  type PartialContext,
  type CommandResult,
  type CreateContextOptions,
} from './context.js';

// Middleware
export {
  // Core middleware types
  type Middleware,
  type CommandHandler,
  type WithCommandOptions,
  // Exit codes
  EXIT_CODES,
  type ExitCode,
  // Middleware composition
  composeMiddleware,
  // Built-in middlewares
  withTiming,
  withDirectory,
  withDirectoryValidation,
  withConfig,
  withJsonOutput,
  withErrorHandler,
  // Higher-order command wrapper
  withCommand,
  // Convenience presets
  standardDirectoryMiddleware,
  standardConfigMiddleware,
  withDirectoryCommand,
  withConfigCommand,
  // Opt-out helpers
  conditionalMiddleware,
  passthrough,
} from './middleware.js';

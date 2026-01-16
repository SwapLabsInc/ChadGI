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

// File Operations (atomic writes and safe parsing)
export {
  atomicWriteFile,
  atomicWriteJson,
  safeWriteFile,
  safeWriteJson,
  safeParseJson,
  safeParseAndValidate,
  type SafeWriteOptions,
  type SafeParseSuccess,
  type SafeParseFailure,
  type SafeParseResult,
  type SafeParseJsonOptions,
} from './fileOps.js';

// Data Schema (JSON validation and bounds checking)
export {
  // Types
  type FieldType,
  type FieldConstraint,
  type DataSchema,
  type ValidationError as SchemaValidationError,
  type ValidationResult as SchemaValidationResult,
  // Constants
  DATA_BOUNDS,
  // Schemas
  SESSION_STATS_SCHEMA,
  TASK_METRICS_SCHEMA,
  METRICS_DATA_SCHEMA,
  TASK_LOCK_DATA_SCHEMA,
  PROGRESS_DATA_SCHEMA,
  PAUSE_LOCK_DATA_SCHEMA,
  APPROVAL_LOCK_DATA_SCHEMA,
  // Functions
  validateSchema,
  validateArray,
  getSchema,
} from './data-schema.js';

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

// High-level GitHub Client
export {
  // Main client (use gh.issue, gh.pr, gh.project, gh.api)
  gh,
  // Error types
  GhClientError,
  type GhClientErrorCode,
  type GhClientOptions,
  // Issue types
  type Issue,
  type CreateIssueOptions,
  type UpdateIssueOptions,
  type ListIssuesOptions,
  // PR types
  type PullRequest,
  type CreatePullRequestOptions,
  type MergeStrategy,
  type MergePullRequestOptions,
  // Project types
  type ProjectItem as GhProjectItem,
  type ProjectItemContent,
  type ProjectItemFilter,
  type ProjectField as GhProjectField,
  type Project,
  // API types
  type RateLimitInfo,
  // Common types
  type GitHubActor,
  type GitHubLabel,
} from './gh-client.js';

// Text UI (CLI output formatting components)
export {
  // Terminal utilities
  getTerminalWidth,
  // Table component
  Table,
  type TableColumn,
  type TableOptions,
  // Section component
  Section,
  type SectionOptions,
  // Badge utilities
  Badge,
  BracketedBadge,
  BadgeStyles,
  type BadgeStyle,
  // Status icons
  StatusIcon,
  StatusIcons,
  type StatusIconType,
  // InfoBox component
  InfoBox,
  type InfoBoxOptions,
  // Convenience functions
  printSectionHeader,
  printTable,
  printInfoBox,
  keyValue,
  divider,
} from './textui.js';

// JSON Output (unified response wrapper)
export {
  // Types
  type ResponseMeta,
  type ResponseError,
  type ResponsePagination,
  type JsonResponse,
  type CreateJsonResponseOptions,
  type CreateJsonErrorOptions,
  type ErrorCode,
  // Factory functions
  createResponseMeta,
  createJsonResponse,
  createJsonError,
  // Error codes
  ErrorCodes,
  // Type guards
  isJsonResponse,
  isJsonErrorResponse,
  isJsonSuccessResponse,
  // Utilities
  wrapLegacyResponse,
  outputJsonResponse,
  outputJsonData,
} from './json-output.js';

// CLI Options (centralized option definitions)
export {
  // Constants
  STANDARD_OPTION_NAMES,
  OPTION_DEFINITIONS,
  DEFAULT_CONFIG_PATH,
  // Types
  type StandardOptionName,
  type OptionDefinition,
  // Helper functions
  addStandardOption,
  addStandardOptions,
  getOptionDefinition,
  isStandardOption,
  hasOption,
} from './cli-options.js';

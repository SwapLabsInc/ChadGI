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
  loadConfig,
  chadgiDirExists,
  getRepoOwner,
  getRepoName,
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

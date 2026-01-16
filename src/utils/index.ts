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
  execGh,
  execGhJson,
  safeExecGh,
  safeExecGhJson,
  fetchIssue,
  fetchIssueTitle,
  fetchIssueBody,
  fetchIssueLabels,
  issueExists,
  addIssueLabel,
  fetchPrUrl,
  listOpenPrs,
  fetchProjectItems,
  fetchProjectFields,
  fetchProjects,
  moveProjectItem,
  addIssueToProject,
  fetchRateLimit,
  type ExecOptions,
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

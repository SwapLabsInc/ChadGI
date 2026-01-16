/**
 * Secret masking utilities for ChadGI.
 *
 * This module provides functions to redact sensitive information from
 * logs and diagnostic outputs, preventing accidental exposure of:
 * - Webhook URLs (Slack, Discord)
 * - GitHub tokens (PATs, OAuth tokens)
 * - API keys and authorization headers
 * - Environment variable values for sensitive keys
 */

/**
 * Patterns that match sensitive data in text.
 * Each pattern will have matches replaced with [REDACTED].
 */
export const SECRET_PATTERNS: RegExp[] = [
  // Webhook URLs
  /https:\/\/hooks\.slack\.com\/[^\s'"<>)}\]]+/gi,
  /https:\/\/discord(app)?\.com\/api\/webhooks\/[^\s'"<>)}\]]+/gi,

  // GitHub tokens (various formats)
  /gh[pousr]_[A-Za-z0-9_]{36,}/g,
  /github_pat_[A-Za-z0-9_]{22,}/g,
  /gho_[A-Za-z0-9_]{36,}/g,
  /ghu_[A-Za-z0-9_]{36,}/g,

  // Generic Bearer tokens in headers
  /Bearer\s+[A-Za-z0-9\-_.~+\/]+=*/gi,

  // Authorization headers (full header value)
  /Authorization:\s*[^\s'"<>)}\],]+/gi,

  // API keys and tokens in common formats
  /(?:api[_-]?key|api[_-]?secret|access[_-]?token|secret[_-]?key)\s*[:=]\s*['"]?[A-Za-z0-9\-_.~+\/]{16,}['"]?/gi,

  // Environment variable assignments for sensitive keys
  /(?:API_KEY|API_SECRET|SECRET_KEY|SECRET_TOKEN|AUTH_TOKEN|ACCESS_TOKEN|PRIVATE_KEY|PASSWORD|WEBHOOK_URL|SLACK_WEBHOOK|DISCORD_WEBHOOK)=[^\s'"<>)}\]]+/gi,

  // npm tokens
  /npm_[A-Za-z0-9]{36,}/g,

  // AWS-style keys
  /(?:AKIA|ASIA)[A-Z0-9]{16}/g,
  /(?:aws[_-]?secret[_-]?access[_-]?key\s*[:=]\s*['"]?)[A-Za-z0-9\/+=]{40}['"]?/gi,

  // Generic long hex/base64 strings that look like secrets (64+ chars)
  // This is more aggressive - only enable if needed
  // /(?<![A-Za-z0-9])[A-Fa-f0-9]{64,}(?![A-Za-z0-9])/g,
];

/**
 * The placeholder text used when masking secrets.
 */
export const REDACTED_PLACEHOLDER = '[REDACTED]';

/**
 * Global flag to disable secret masking.
 * Set to true to show secrets in output (e.g., with --no-mask flag).
 */
let maskingDisabled = false;

/**
 * Enable or disable secret masking globally.
 *
 * @param disabled - true to disable masking (show secrets), false to enable
 */
export function setMaskingDisabled(disabled: boolean): void {
  maskingDisabled = disabled;
}

/**
 * Check if secret masking is currently disabled.
 *
 * @returns true if masking is disabled, false if enabled
 */
export function isMaskingDisabled(): boolean {
  return maskingDisabled;
}

/**
 * Mask secrets in a string by replacing sensitive patterns with [REDACTED].
 *
 * @param text - The text to mask
 * @returns The text with secrets replaced by [REDACTED]
 */
export function maskSecrets(text: string): string {
  if (maskingDisabled || !text) {
    return text;
  }

  let masked = text;
  for (const pattern of SECRET_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    masked = masked.replace(pattern, REDACTED_PLACEHOLDER);
  }
  return masked;
}

/**
 * Deep clone an object and mask all string values that match secret patterns.
 * Handles nested objects and arrays.
 *
 * @param obj - The object to mask
 * @returns A new object with secrets masked in all string values
 */
export function maskObject<T>(obj: T): T {
  if (maskingDisabled) {
    return obj;
  }

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return maskSecrets(obj) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => maskObject(item)) as unknown as T;
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = maskObject(value);
    }
    return result as T;
  }

  return obj;
}

/**
 * Mask secrets in a JSON string by parsing, masking the object, and re-stringifying.
 *
 * @param jsonString - The JSON string to mask
 * @param indent - Optional indentation for output (default: 2)
 * @returns The JSON string with secrets masked
 */
export function maskJsonString(jsonString: string, indent: number = 2): string {
  if (maskingDisabled || !jsonString) {
    return jsonString;
  }

  try {
    const obj = JSON.parse(jsonString);
    const masked = maskObject(obj);
    return JSON.stringify(masked, null, indent);
  } catch {
    // If parsing fails, fall back to simple string masking
    return maskSecrets(jsonString);
  }
}

/**
 * List of keys that commonly contain sensitive values.
 * Used for targeted masking in configuration objects.
 */
export const SENSITIVE_KEYS = [
  'webhook_url',
  'api_key',
  'api_secret',
  'token',
  'password',
  'secret',
  'authorization',
  'access_token',
  'private_key',
  'slack_webhook',
  'discord_webhook',
];

/**
 * Check if a key name indicates a sensitive value.
 *
 * @param key - The key name to check
 * @returns true if the key likely contains sensitive data
 */
export function isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return SENSITIVE_KEYS.some((pattern) => lowerKey.includes(pattern));
}

/**
 * Mask values in an object based on key names.
 * Keys matching SENSITIVE_KEYS patterns will have their values replaced.
 * This is more targeted than maskObject which masks based on value patterns.
 *
 * @param obj - The object to mask
 * @param replacement - The replacement value (default: empty string)
 * @returns A new object with sensitive key values masked
 */
export function maskSensitiveKeys<T extends Record<string, unknown>>(
  obj: T,
  replacement: string = ''
): T {
  if (maskingDisabled || !obj || typeof obj !== 'object') {
    return obj;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveKey(key)) {
      result[key] = replacement;
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = maskSensitiveKeys(value as Record<string, unknown>, replacement);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

/**
 * Create a console logger that automatically masks secrets in output.
 *
 * @returns An object with log, warn, error, and debug methods that mask secrets
 */
export function createMaskedLogger() {
  return {
    log: (...args: unknown[]) => {
      console.log(...args.map((arg) => (typeof arg === 'string' ? maskSecrets(arg) : arg)));
    },
    warn: (...args: unknown[]) => {
      console.warn(...args.map((arg) => (typeof arg === 'string' ? maskSecrets(arg) : arg)));
    },
    error: (...args: unknown[]) => {
      console.error(...args.map((arg) => (typeof arg === 'string' ? maskSecrets(arg) : arg)));
    },
    debug: (...args: unknown[]) => {
      console.debug(...args.map((arg) => (typeof arg === 'string' ? maskSecrets(arg) : arg)));
    },
  };
}

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
export declare const SECRET_PATTERNS: RegExp[];
/**
 * The placeholder text used when masking secrets.
 */
export declare const REDACTED_PLACEHOLDER = "[REDACTED]";
/**
 * Enable or disable secret masking globally.
 *
 * @param disabled - true to disable masking (show secrets), false to enable
 */
export declare function setMaskingDisabled(disabled: boolean): void;
/**
 * Check if secret masking is currently disabled.
 *
 * @returns true if masking is disabled, false if enabled
 */
export declare function isMaskingDisabled(): boolean;
/**
 * Mask secrets in a string by replacing sensitive patterns with [REDACTED].
 *
 * @param text - The text to mask
 * @returns The text with secrets replaced by [REDACTED]
 */
export declare function maskSecrets(text: string): string;
/**
 * Deep clone an object and mask all string values that match secret patterns.
 * Handles nested objects and arrays.
 *
 * @param obj - The object to mask
 * @returns A new object with secrets masked in all string values
 */
export declare function maskObject<T>(obj: T): T;
/**
 * Mask secrets in a JSON string by parsing, masking the object, and re-stringifying.
 *
 * @param jsonString - The JSON string to mask
 * @param indent - Optional indentation for output (default: 2)
 * @returns The JSON string with secrets masked
 */
export declare function maskJsonString(jsonString: string, indent?: number): string;
/**
 * List of keys that commonly contain sensitive values.
 * Used for targeted masking in configuration objects.
 */
export declare const SENSITIVE_KEYS: string[];
/**
 * Check if a key name indicates a sensitive value.
 *
 * @param key - The key name to check
 * @returns true if the key likely contains sensitive data
 */
export declare function isSensitiveKey(key: string): boolean;
/**
 * Mask values in an object based on key names.
 * Keys matching SENSITIVE_KEYS patterns will have their values replaced.
 * This is more targeted than maskObject which masks based on value patterns.
 *
 * @param obj - The object to mask
 * @param replacement - The replacement value (default: empty string)
 * @returns A new object with sensitive key values masked
 */
export declare function maskSensitiveKeys<T extends Record<string, unknown>>(obj: T, replacement?: string): T;
/**
 * Create a console logger that automatically masks secrets in output.
 *
 * @returns An object with log, warn, error, and debug methods that mask secrets
 */
export declare function createMaskedLogger(): {
    log: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
    debug: (...args: unknown[]) => void;
};
//# sourceMappingURL=secrets.d.ts.map
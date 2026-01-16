/**
 * JSON schema validation and bounds checking for persisted data structures.
 *
 * Provides runtime validation for critical JSON structures that are persisted to disk,
 * ensuring data integrity and early failure with clear messages for corrupted files.
 *
 * @module utils/data-schema
 */
/**
 * Supported field types for schema validation
 */
export type FieldType = 'string' | 'number' | 'boolean' | 'array' | 'object';
/**
 * Field constraint configuration
 */
export interface FieldConstraint {
    /** Expected type for the field */
    type: FieldType;
    /** Whether the field is required */
    required?: boolean;
    /** Minimum value for numbers */
    min?: number;
    /** Maximum value for numbers */
    max?: number;
    /** Whether number must be an integer */
    integer?: boolean;
    /** Minimum string length */
    minLength?: number;
    /** Maximum string length */
    maxLength?: number;
    /** Regex pattern for string validation */
    pattern?: RegExp;
    /** Allowed string values (enum) */
    enum?: string[];
    /** Default value to use if field is missing (enables recovery) */
    default?: unknown;
    /** Nested schema for object fields */
    properties?: Record<string, FieldConstraint>;
    /** Schema for array items */
    items?: FieldConstraint;
}
/**
 * Schema definition for a data structure
 */
export interface DataSchema {
    /** Human-readable name for error messages */
    name: string;
    /** Field constraints indexed by field name */
    fields: Record<string, FieldConstraint>;
    /** Allow additional properties not defined in schema */
    additionalProperties?: boolean;
}
/**
 * Validation error details
 */
export interface ValidationError {
    /** Path to the invalid field (e.g., "session.tasks_completed") */
    path: string;
    /** Error message */
    message: string;
    /** Actual value that failed validation */
    value?: unknown;
    /** Whether this error was recovered from using a default value */
    recovered?: boolean;
}
/**
 * Result of schema validation
 */
export interface ValidationResult<T> {
    /** Whether validation passed (or passed with recovery) */
    valid: boolean;
    /** Validated and potentially recovered data */
    data?: T;
    /** List of validation errors */
    errors: ValidationError[];
    /** Whether any fields were recovered using defaults */
    hasRecoveries: boolean;
}
/**
 * Maximum reasonable values for bounds checking
 */
export declare const DATA_BOUNDS: {
    /** Maximum cost per task in USD (to catch obviously wrong values) */
    readonly maxCostUsd: 1000;
    /** Maximum session duration in seconds (1 week) */
    readonly maxDurationSecs: number;
    /** Maximum number of tasks in a session */
    readonly maxTasks: 10000;
    /** Maximum number of iterations per task */
    readonly maxIterations: 100;
    /** Maximum age of a timestamp (10 years in ms) */
    readonly maxTimestampAge: number;
    /** Minimum valid timestamp (2020-01-01) */
    readonly minTimestamp: number;
};
/**
 * Schema for SessionStats data structure
 */
export declare const SESSION_STATS_SCHEMA: DataSchema;
/**
 * Schema for TaskMetrics data structure
 */
export declare const TASK_METRICS_SCHEMA: DataSchema;
/**
 * Schema for MetricsData container
 */
export declare const METRICS_DATA_SCHEMA: DataSchema;
/**
 * Schema for TaskLockData data structure
 */
export declare const TASK_LOCK_DATA_SCHEMA: DataSchema;
/**
 * Schema for ProgressData data structure
 */
export declare const PROGRESS_DATA_SCHEMA: DataSchema;
/**
 * Schema for PauseLockData data structure
 */
export declare const PAUSE_LOCK_DATA_SCHEMA: DataSchema;
/**
 * Schema for ApprovalLockData data structure
 */
export declare const APPROVAL_LOCK_DATA_SCHEMA: DataSchema;
/**
 * Validate data against a schema with optional recovery.
 *
 * @param data - The data to validate
 * @param schema - The schema to validate against
 * @param options - Validation options
 * @returns Validation result with errors and optional recovered data
 */
export declare function validateSchema<T>(data: unknown, schema: DataSchema, options?: {
    /** Allow recovery using default values for invalid fields */
    recover?: boolean;
    /** File path for error context */
    filePath?: string;
}): ValidationResult<T>;
/**
 * Validate an array of items against a schema.
 *
 * @param data - The array to validate
 * @param itemSchema - The schema for each item
 * @param options - Validation options
 * @returns Array of validated items (invalid items are filtered out if recover is enabled)
 */
export declare function validateArray<T>(data: unknown, itemSchema: DataSchema, options?: {
    recover?: boolean;
    filePath?: string;
}): {
    valid: boolean;
    data: T[];
    errors: ValidationError[];
};
/**
 * Get a schema by name
 */
export declare function getSchema(name: string): DataSchema | undefined;
//# sourceMappingURL=data-schema.d.ts.map
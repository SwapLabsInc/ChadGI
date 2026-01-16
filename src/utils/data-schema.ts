/**
 * JSON schema validation and bounds checking for persisted data structures.
 *
 * Provides runtime validation for critical JSON structures that are persisted to disk,
 * ensuring data integrity and early failure with clear messages for corrupted files.
 *
 * @module utils/data-schema
 */

import { isVerbose } from './debug.js';

// ============================================================================
// Schema Types
// ============================================================================

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

// ============================================================================
// Schema Definitions
// ============================================================================

/**
 * Maximum reasonable values for bounds checking
 */
export const DATA_BOUNDS = {
  /** Maximum cost per task in USD (to catch obviously wrong values) */
  maxCostUsd: 1000,
  /** Maximum session duration in seconds (1 week) */
  maxDurationSecs: 7 * 24 * 60 * 60,
  /** Maximum number of tasks in a session */
  maxTasks: 10000,
  /** Maximum number of iterations per task */
  maxIterations: 100,
  /** Maximum age of a timestamp (10 years in ms) */
  maxTimestampAge: 10 * 365 * 24 * 60 * 60 * 1000,
  /** Minimum valid timestamp (2020-01-01) */
  minTimestamp: new Date('2020-01-01').getTime(),
} as const;

/**
 * Schema for SessionStats data structure
 */
export const SESSION_STATS_SCHEMA: DataSchema = {
  name: 'SessionStats',
  additionalProperties: true,
  fields: {
    session_id: {
      type: 'string',
      required: true,
      minLength: 1,
      maxLength: 256,
    },
    started_at: {
      type: 'string',
      required: true,
      pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    },
    ended_at: {
      type: 'string',
      required: true,
      pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    },
    duration_secs: {
      type: 'number',
      required: true,
      min: 0,
      max: DATA_BOUNDS.maxDurationSecs,
      integer: true,
      default: 0,
    },
    tasks_attempted: {
      type: 'number',
      required: true,
      min: 0,
      max: DATA_BOUNDS.maxTasks,
      integer: true,
      default: 0,
    },
    tasks_completed: {
      type: 'number',
      required: true,
      min: 0,
      max: DATA_BOUNDS.maxTasks,
      integer: true,
      default: 0,
    },
    successful_tasks: {
      type: 'array',
      required: true,
      default: [],
    },
    failed_tasks: {
      type: 'array',
      required: true,
      default: [],
    },
    total_cost_usd: {
      type: 'number',
      required: true,
      min: 0,
      max: DATA_BOUNDS.maxCostUsd,
      default: 0,
    },
    gigachad_mode: {
      type: 'boolean',
      required: true,
      default: false,
    },
    gigachad_merges: {
      type: 'number',
      required: true,
      min: 0,
      max: DATA_BOUNDS.maxTasks,
      integer: true,
      default: 0,
    },
    repo: {
      type: 'string',
      required: true,
      minLength: 1,
      default: 'unknown/unknown',
    },
  },
};

/**
 * Schema for TaskMetrics data structure
 */
export const TASK_METRICS_SCHEMA: DataSchema = {
  name: 'TaskMetrics',
  additionalProperties: true,
  fields: {
    issue_number: {
      type: 'number',
      required: true,
      min: 1,
      integer: true,
    },
    started_at: {
      type: 'string',
      required: true,
      pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    },
    completed_at: {
      type: 'string',
      required: false,
      pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    },
    duration_secs: {
      type: 'number',
      required: true,
      min: 0,
      max: DATA_BOUNDS.maxDurationSecs,
      integer: true,
      default: 0,
    },
    status: {
      type: 'string',
      required: true,
      enum: ['completed', 'failed'],
    },
    iterations: {
      type: 'number',
      required: true,
      min: 0,
      max: DATA_BOUNDS.maxIterations,
      integer: true,
      default: 1,
    },
    cost_usd: {
      type: 'number',
      required: true,
      min: 0,
      max: DATA_BOUNDS.maxCostUsd,
      default: 0,
    },
    failure_reason: {
      type: 'string',
      required: false,
    },
    failure_phase: {
      type: 'string',
      required: false,
    },
    category: {
      type: 'string',
      required: false,
    },
    retry_count: {
      type: 'number',
      required: false,
      min: 0,
      integer: true,
      default: 0,
    },
    phases: {
      type: 'object',
      required: false,
    },
    tokens: {
      type: 'object',
      required: false,
    },
    error_recovery_time_secs: {
      type: 'number',
      required: false,
      min: 0,
      max: DATA_BOUNDS.maxDurationSecs,
      integer: true,
    },
    files_modified: {
      type: 'number',
      required: false,
      min: 0,
      integer: true,
    },
    lines_changed: {
      type: 'number',
      required: false,
      min: 0,
      integer: true,
    },
  },
};

/**
 * Schema for MetricsData container
 */
export const METRICS_DATA_SCHEMA: DataSchema = {
  name: 'MetricsData',
  additionalProperties: true,
  fields: {
    version: {
      type: 'string',
      required: true,
      minLength: 1,
      default: '1.0',
    },
    last_updated: {
      type: 'string',
      required: true,
      pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    },
    retention_days: {
      type: 'number',
      required: true,
      min: 1,
      max: 3650,
      integer: true,
      default: 30,
    },
    tasks: {
      type: 'array',
      required: true,
      default: [],
    },
  },
};

/**
 * Schema for TaskLockData data structure
 */
export const TASK_LOCK_DATA_SCHEMA: DataSchema = {
  name: 'TaskLockData',
  additionalProperties: true,
  fields: {
    issue_number: {
      type: 'number',
      required: true,
      min: 1,
      integer: true,
    },
    session_id: {
      type: 'string',
      required: true,
      minLength: 1,
      maxLength: 256,
    },
    pid: {
      type: 'number',
      required: true,
      min: 1,
      integer: true,
    },
    hostname: {
      type: 'string',
      required: true,
      minLength: 1,
      maxLength: 256,
    },
    locked_at: {
      type: 'string',
      required: true,
      pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    },
    last_heartbeat: {
      type: 'string',
      required: true,
      pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    },
    worker_id: {
      type: 'number',
      required: false,
      min: 0,
      integer: true,
    },
    repo_name: {
      type: 'string',
      required: false,
      minLength: 1,
    },
  },
};

/**
 * Schema for ProgressData data structure
 */
export const PROGRESS_DATA_SCHEMA: DataSchema = {
  name: 'ProgressData',
  additionalProperties: true,
  fields: {
    status: {
      type: 'string',
      required: true,
      enum: ['idle', 'in_progress', 'paused', 'stopped', 'error', 'awaiting_approval'],
    },
    current_task: {
      type: 'object',
      required: false,
      properties: {
        id: {
          type: 'string',
          required: true,
          minLength: 1,
        },
        title: {
          type: 'string',
          required: true,
        },
        branch: {
          type: 'string',
          required: true,
        },
        started_at: {
          type: 'string',
          required: true,
          pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
        },
      },
    },
    session: {
      type: 'object',
      required: false,
      properties: {
        started_at: {
          type: 'string',
          required: true,
          pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
        },
        tasks_completed: {
          type: 'number',
          required: true,
          min: 0,
          max: DATA_BOUNDS.maxTasks,
          integer: true,
        },
        total_cost_usd: {
          type: 'number',
          required: true,
          min: 0,
          max: DATA_BOUNDS.maxCostUsd,
        },
      },
    },
    last_updated: {
      type: 'string',
      required: true,
      pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    },
    phase: {
      type: 'string',
      required: false,
    },
    iteration: {
      type: 'object',
      required: false,
      properties: {
        current: {
          type: 'number',
          required: true,
          min: 0,
          max: DATA_BOUNDS.maxIterations,
          integer: true,
        },
        max: {
          type: 'number',
          required: true,
          min: 1,
          max: DATA_BOUNDS.maxIterations,
          integer: true,
        },
      },
    },
    recent_tools: {
      type: 'array',
      required: false,
    },
    approval_history: {
      type: 'array',
      required: false,
    },
    parallel_mode: {
      type: 'boolean',
      required: false,
    },
    parallel_workers: {
      type: 'array',
      required: false,
    },
    parallel_session: {
      type: 'object',
      required: false,
    },
  },
};

/**
 * Schema for PauseLockData data structure
 */
export const PAUSE_LOCK_DATA_SCHEMA: DataSchema = {
  name: 'PauseLockData',
  additionalProperties: true,
  fields: {
    paused_at: {
      type: 'string',
      required: true,
      pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    },
    reason: {
      type: 'string',
      required: false,
    },
    resume_at: {
      type: 'string',
      required: false,
      pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    },
  },
};

/**
 * Schema for ApprovalLockData data structure
 */
export const APPROVAL_LOCK_DATA_SCHEMA: DataSchema = {
  name: 'ApprovalLockData',
  additionalProperties: true,
  fields: {
    status: {
      type: 'string',
      required: true,
      enum: ['pending', 'approved', 'rejected'],
    },
    created_at: {
      type: 'string',
      required: true,
      pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    },
    issue_number: {
      type: 'number',
      required: true,
      min: 1,
      integer: true,
    },
    issue_title: {
      type: 'string',
      required: false,
    },
    branch: {
      type: 'string',
      required: false,
    },
    phase: {
      type: 'string',
      required: true,
      enum: ['pre_task', 'phase1', 'phase2'],
    },
    files_changed: {
      type: 'number',
      required: false,
      min: 0,
      integer: true,
    },
    insertions: {
      type: 'number',
      required: false,
      min: 0,
      integer: true,
    },
    deletions: {
      type: 'number',
      required: false,
      min: 0,
      integer: true,
    },
    approver: {
      type: 'string',
      required: false,
    },
    approved_at: {
      type: 'string',
      required: false,
      pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    },
    rejected_at: {
      type: 'string',
      required: false,
      pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    },
    comment: {
      type: 'string',
      required: false,
    },
    feedback: {
      type: 'string',
      required: false,
    },
  },
};

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Get the JavaScript type of a value
 */
function getValueType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * Validate a single field against its constraint
 */
function validateField(
  value: unknown,
  constraint: FieldConstraint,
  path: string,
  errors: ValidationError[],
  recover: boolean
): { value: unknown; recovered: boolean } {
  let recovered = false;

  // Check if value is missing
  if (value === undefined || value === null) {
    if (constraint.required) {
      if (recover && constraint.default !== undefined) {
        errors.push({
          path,
          message: `Missing required field, using default`,
          value: constraint.default,
          recovered: true,
        });
        return { value: constraint.default, recovered: true };
      }
      errors.push({
        path,
        message: `Required field is missing`,
        value,
      });
    }
    return { value, recovered: false };
  }

  // Check type
  const actualType = getValueType(value);
  if (actualType !== constraint.type) {
    if (recover && constraint.default !== undefined) {
      errors.push({
        path,
        message: `Expected ${constraint.type}, got ${actualType}, using default`,
        value: constraint.default,
        recovered: true,
      });
      return { value: constraint.default, recovered: true };
    }
    errors.push({
      path,
      message: `Expected ${constraint.type}, got ${actualType}`,
      value,
    });
    return { value, recovered: false };
  }

  // Type-specific validations
  if (constraint.type === 'number') {
    const numValue = value as number;

    // Check integer constraint
    if (constraint.integer && !Number.isInteger(numValue)) {
      if (recover && constraint.default !== undefined) {
        errors.push({
          path,
          message: `Expected integer, using default`,
          value: constraint.default,
          recovered: true,
        });
        return { value: constraint.default, recovered: true };
      }
      errors.push({
        path,
        message: `Expected integer, got float`,
        value,
      });
    }

    // Check bounds
    if (constraint.min !== undefined && numValue < constraint.min) {
      if (recover) {
        const recoveredValue = constraint.default !== undefined ? constraint.default : constraint.min;
        errors.push({
          path,
          message: `Value ${numValue} is below minimum ${constraint.min}, using ${recoveredValue}`,
          value: recoveredValue,
          recovered: true,
        });
        return { value: recoveredValue, recovered: true };
      }
      errors.push({
        path,
        message: `Value ${numValue} is below minimum ${constraint.min}`,
        value,
      });
    }

    if (constraint.max !== undefined && numValue > constraint.max) {
      if (recover) {
        const recoveredValue = constraint.default !== undefined ? constraint.default : constraint.max;
        errors.push({
          path,
          message: `Value ${numValue} exceeds maximum ${constraint.max}, using ${recoveredValue}`,
          value: recoveredValue,
          recovered: true,
        });
        return { value: recoveredValue, recovered: true };
      }
      errors.push({
        path,
        message: `Value ${numValue} exceeds maximum ${constraint.max}`,
        value,
      });
    }
  }

  if (constraint.type === 'string') {
    const strValue = value as string;

    // Check length constraints
    if (constraint.minLength !== undefined && strValue.length < constraint.minLength) {
      errors.push({
        path,
        message: `String length ${strValue.length} is below minimum ${constraint.minLength}`,
        value,
      });
    }

    if (constraint.maxLength !== undefined && strValue.length > constraint.maxLength) {
      errors.push({
        path,
        message: `String length ${strValue.length} exceeds maximum ${constraint.maxLength}`,
        value: strValue.substring(0, 50) + '...',
      });
    }

    // Check pattern
    if (constraint.pattern && !constraint.pattern.test(strValue)) {
      errors.push({
        path,
        message: `String does not match expected pattern`,
        value: strValue.substring(0, 50),
      });
    }

    // Check enum
    if (constraint.enum && !constraint.enum.includes(strValue)) {
      if (recover && constraint.default !== undefined) {
        errors.push({
          path,
          message: `Invalid enum value "${strValue}", expected one of: ${constraint.enum.join(', ')}, using default`,
          value: constraint.default,
          recovered: true,
        });
        return { value: constraint.default, recovered: true };
      }
      errors.push({
        path,
        message: `Invalid enum value "${strValue}", expected one of: ${constraint.enum.join(', ')}`,
        value,
      });
    }
  }

  // Validate nested object properties
  if (constraint.type === 'object' && constraint.properties && typeof value === 'object' && value !== null) {
    const objValue = value as Record<string, unknown>;
    const validatedObj: Record<string, unknown> = { ...objValue };

    for (const [propName, propConstraint] of Object.entries(constraint.properties)) {
      const propPath = path ? `${path}.${propName}` : propName;
      const result = validateField(objValue[propName], propConstraint, propPath, errors, recover);
      if (result.recovered) {
        validatedObj[propName] = result.value;
        recovered = true;
      }
    }

    if (recovered) {
      return { value: validatedObj, recovered: true };
    }
  }

  // Validate array items
  if (constraint.type === 'array' && constraint.items && Array.isArray(value)) {
    const arrValue = value as unknown[];
    const validatedArr: unknown[] = [];
    let arrayRecovered = false;

    for (let i = 0; i < arrValue.length; i++) {
      const itemPath = `${path}[${i}]`;
      const result = validateField(arrValue[i], constraint.items, itemPath, errors, recover);
      if (result.recovered) {
        arrayRecovered = true;
      }
      validatedArr.push(result.value);
    }

    if (arrayRecovered) {
      return { value: validatedArr, recovered: true };
    }
  }

  return { value, recovered };
}

/**
 * Validate data against a schema with optional recovery.
 *
 * @param data - The data to validate
 * @param schema - The schema to validate against
 * @param options - Validation options
 * @returns Validation result with errors and optional recovered data
 */
export function validateSchema<T>(
  data: unknown,
  schema: DataSchema,
  options: {
    /** Allow recovery using default values for invalid fields */
    recover?: boolean;
    /** File path for error context */
    filePath?: string;
  } = {}
): ValidationResult<T> {
  const { recover = true, filePath } = options;
  const errors: ValidationError[] = [];
  let hasRecoveries = false;

  // Check that data is an object
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return {
      valid: false,
      errors: [{
        path: '',
        message: `Expected object for ${schema.name}, got ${getValueType(data)}`,
        value: data,
      }],
      hasRecoveries: false,
    };
  }

  const objData = data as Record<string, unknown>;
  const validatedData: Record<string, unknown> = { ...objData };

  // Validate each field defined in the schema
  for (const [fieldName, constraint] of Object.entries(schema.fields)) {
    const result = validateField(objData[fieldName], constraint, fieldName, errors, recover);
    if (result.recovered) {
      validatedData[fieldName] = result.value;
      hasRecoveries = true;
    }
  }

  // Log validation failures in verbose mode
  if (errors.length > 0 && isVerbose()) {
    const fileContext = filePath ? ` in ${filePath}` : '';
    const nonRecoveredErrors = errors.filter(e => !e.recovered);
    if (nonRecoveredErrors.length > 0) {
      process.stderr.write(`[DEBUG] Schema validation errors for ${schema.name}${fileContext}:\n`);
      for (const error of nonRecoveredErrors.slice(0, 5)) {
        process.stderr.write(`[DEBUG]   - ${error.path}: ${error.message}\n`);
      }
      if (nonRecoveredErrors.length > 5) {
        process.stderr.write(`[DEBUG]   ... and ${nonRecoveredErrors.length - 5} more errors\n`);
      }
    }
    const recoveredErrors = errors.filter(e => e.recovered);
    if (recoveredErrors.length > 0) {
      process.stderr.write(`[DEBUG] Recovered ${recoveredErrors.length} field(s) using defaults\n`);
    }
  }

  // Determine overall validity
  const nonRecoveredErrors = errors.filter(e => !e.recovered);
  const valid = nonRecoveredErrors.length === 0;

  return {
    valid,
    data: valid || hasRecoveries ? validatedData as T : undefined,
    errors,
    hasRecoveries,
  };
}

/**
 * Validate an array of items against a schema.
 *
 * @param data - The array to validate
 * @param itemSchema - The schema for each item
 * @param options - Validation options
 * @returns Array of validated items (invalid items are filtered out if recover is enabled)
 */
export function validateArray<T>(
  data: unknown,
  itemSchema: DataSchema,
  options: {
    recover?: boolean;
    filePath?: string;
  } = {}
): { valid: boolean; data: T[]; errors: ValidationError[] } {
  const { recover = true, filePath } = options;
  const errors: ValidationError[] = [];

  if (!Array.isArray(data)) {
    return {
      valid: false,
      data: [],
      errors: [{
        path: '',
        message: `Expected array, got ${getValueType(data)}`,
        value: data,
      }],
    };
  }

  const validItems: T[] = [];

  for (let i = 0; i < data.length; i++) {
    const result = validateSchema<T>(data[i], itemSchema, {
      recover,
      filePath: filePath ? `${filePath}[${i}]` : `[${i}]`,
    });

    if (result.valid && result.data !== undefined) {
      validItems.push(result.data);
    } else if (!result.valid) {
      // Add item index to error paths
      for (const error of result.errors) {
        errors.push({
          ...error,
          path: `[${i}].${error.path}`.replace(/\.$/, ''),
        });
      }
      // If recovery is disabled, still include the item but note it's invalid
      if (!recover) {
        validItems.push(data[i] as T);
      }
    }
  }

  if (errors.length > 0 && isVerbose()) {
    const fileContext = filePath ? ` in ${filePath}` : '';
    const skippedCount = data.length - validItems.length;
    if (skippedCount > 0) {
      process.stderr.write(
        `[DEBUG] Skipped ${skippedCount} invalid item(s) from ${itemSchema.name} array${fileContext}\n`
      );
    }
  }

  return {
    valid: errors.filter(e => !e.recovered).length === 0,
    data: validItems,
    errors,
  };
}

/**
 * Get a schema by name
 */
export function getSchema(name: string): DataSchema | undefined {
  const schemas: Record<string, DataSchema> = {
    SessionStats: SESSION_STATS_SCHEMA,
    TaskMetrics: TASK_METRICS_SCHEMA,
    MetricsData: METRICS_DATA_SCHEMA,
    TaskLockData: TASK_LOCK_DATA_SCHEMA,
    ProgressData: PROGRESS_DATA_SCHEMA,
    PauseLockData: PAUSE_LOCK_DATA_SCHEMA,
    ApprovalLockData: APPROVAL_LOCK_DATA_SCHEMA,
  };
  return schemas[name];
}

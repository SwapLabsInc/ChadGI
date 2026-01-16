/**
 * CLI numeric option validation utilities.
 *
 * Provides validation functions for numeric CLI options with bounds checking
 * to prevent invalid values that could cause runtime errors or confusing behavior.
 */

import { colors } from './colors.js';

/**
 * Validation constraint configuration
 */
export interface NumericConstraint {
  /** Minimum allowed value (inclusive) */
  min?: number;
  /** Maximum allowed value (inclusive) */
  max?: number;
  /** If true, value must be an integer */
  integer?: boolean;
  /** Custom error message override */
  errorMessage?: string;
}

/**
 * Predefined constraint sets for common CLI options
 */
export const NUMERIC_CONSTRAINTS = {
  /** Timeout in minutes: >= 0 (0 = disabled) */
  timeout: {
    min: 0,
    integer: true,
    errorMessage: 'Timeout must be a non-negative integer (0 = disabled)',
  },
  /** Interval in milliseconds: >= 100 (prevent tight loops) */
  interval: {
    min: 100,
    integer: true,
    errorMessage: 'Interval must be at least 100ms to prevent tight loops',
  },
  /** Limit count: > 0 */
  limit: {
    min: 1,
    integer: true,
    errorMessage: 'Limit must be a positive integer',
  },
  /** Days count: > 0 */
  days: {
    min: 1,
    max: 36500, // ~100 years, reasonable upper bound
    integer: true,
    errorMessage: 'Days must be a positive integer (1-36500)',
  },
  /** Budget amount: > 0 */
  budget: {
    min: 0.01,
    errorMessage: 'Budget must be a positive number',
  },
  /** Iterations count: > 0 */
  iterations: {
    min: 1,
    integer: true,
    errorMessage: 'Iterations must be a positive integer',
  },
  /** PR/Issue number: > 0 and integer */
  issueNumber: {
    min: 1,
    integer: true,
    errorMessage: 'Issue/PR number must be a positive integer',
  },
  /** Priority level: >= 0 */
  priority: {
    min: 0,
    integer: true,
    errorMessage: 'Priority must be a non-negative integer',
  },
  /** Session count (--last): > 0 */
  sessionCount: {
    min: 1,
    integer: true,
    errorMessage: 'Session count must be a positive integer',
  },
  /** Parallel worker count: 1-16 */
  parallel: {
    min: 1,
    max: 16,
    integer: true,
    errorMessage: 'Parallel worker count must be a positive integer (1-16)',
  },
} as const;

export type ConstraintName = keyof typeof NUMERIC_CONSTRAINTS;

/**
 * Validation result for error reporting
 */
export interface ValidationResult {
  valid: boolean;
  value?: number;
  error?: string;
}

/**
 * Validates a numeric value against constraints.
 *
 * @param value - The value to validate (string from CLI input)
 * @param optionName - Name of the option for error messages
 * @param constraint - Constraint configuration or predefined constraint name
 * @returns Validation result with parsed value or error message
 */
export function validateNumeric(
  value: string,
  optionName: string,
  constraint: NumericConstraint | ConstraintName
): ValidationResult {
  // Resolve predefined constraint name to configuration
  const config: NumericConstraint =
    typeof constraint === 'string'
      ? NUMERIC_CONSTRAINTS[constraint]
      : constraint;

  // Parse the value - always use parseFloat first for proper detection
  const parsed = parseFloat(value);

  // Check if parsing succeeded
  if (isNaN(parsed)) {
    const typeDesc = config.integer ? 'integer' : 'number';
    return {
      valid: false,
      error: `Invalid ${optionName}: "${value}" is not a valid ${typeDesc}`,
    };
  }

  // Check integer constraint (handles cases like "3.5" when integer is required)
  if (config.integer && !Number.isInteger(parsed)) {
    return {
      valid: false,
      error: `Invalid ${optionName}: value must be an integer`,
    };
  }

  // Check minimum bound
  if (config.min !== undefined && parsed < config.min) {
    const errorMsg =
      config.errorMessage ||
      `Invalid ${optionName}: value must be >= ${config.min}`;
    return { valid: false, error: errorMsg };
  }

  // Check maximum bound
  if (config.max !== undefined && parsed > config.max) {
    const errorMsg =
      config.errorMessage ||
      `Invalid ${optionName}: value must be <= ${config.max}`;
    return { valid: false, error: errorMsg };
  }

  return { valid: true, value: parsed };
}

/**
 * Creates a Commander option parser function that validates numeric input.
 *
 * This function returns a parser suitable for use with Commander's .option() method.
 * If validation fails, it prints an error message and exits with code 1.
 *
 * @param optionName - Name of the option for error messages (e.g., "timeout")
 * @param constraint - Constraint configuration or predefined constraint name
 * @returns Parser function for Commander options
 *
 * @example
 * ```ts
 * program
 *   .option('-t, --timeout <minutes>', 'Task timeout', createNumericParser('timeout', 'timeout'))
 *   .option('-i, --interval <ms>', 'Refresh interval', createNumericParser('interval', 'interval'))
 * ```
 */
export function createNumericParser(
  optionName: string,
  constraint: NumericConstraint | ConstraintName
): (value: string) => number {
  return (value: string): number => {
    const result = validateNumeric(value, optionName, constraint);

    if (!result.valid) {
      console.error(`${colors.red}Error: ${result.error}${colors.reset}`);
      process.exit(1);
    }

    return result.value!;
  };
}

/**
 * Validates multiple numeric options at once.
 * Useful for validating options after parsing when custom logic is needed.
 *
 * @param options - Object containing option values to validate
 * @param constraints - Map of option names to their constraints
 * @returns Object with validation results for each option
 */
export function validateNumericOptions(
  options: Record<string, number | undefined>,
  constraints: Record<string, NumericConstraint | ConstraintName>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const [name, constraint] of Object.entries(constraints)) {
    const value = options[name];
    if (value === undefined) continue;

    const result = validateNumeric(String(value), name, constraint);
    if (!result.valid && result.error) {
      errors.push(result.error);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Formats constraint bounds for help text.
 *
 * @param constraint - Constraint configuration or predefined constraint name
 * @returns Human-readable bounds description
 */
export function formatConstraintBounds(
  constraint: NumericConstraint | ConstraintName
): string {
  const config: NumericConstraint =
    typeof constraint === 'string'
      ? NUMERIC_CONSTRAINTS[constraint]
      : constraint;

  const parts: string[] = [];

  if (config.integer) {
    parts.push('integer');
  }

  if (config.min !== undefined && config.max !== undefined) {
    parts.push(`${config.min}-${config.max}`);
  } else if (config.min !== undefined) {
    parts.push(`>= ${config.min}`);
  } else if (config.max !== undefined) {
    parts.push(`<= ${config.max}`);
  }

  return parts.join(', ');
}

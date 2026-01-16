/**
 * CLI numeric option validation utilities.
 *
 * Provides validation functions for numeric CLI options with bounds checking
 * to prevent invalid values that could cause runtime errors or confusing behavior.
 */
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
export declare const NUMERIC_CONSTRAINTS: {
    /** Timeout in minutes: >= 0 (0 = disabled) */
    readonly timeout: {
        readonly min: 0;
        readonly integer: true;
        readonly errorMessage: "Timeout must be a non-negative integer (0 = disabled)";
    };
    /** Interval in milliseconds: >= 100 (prevent tight loops) */
    readonly interval: {
        readonly min: 100;
        readonly integer: true;
        readonly errorMessage: "Interval must be at least 100ms to prevent tight loops";
    };
    /** Limit count: > 0 */
    readonly limit: {
        readonly min: 1;
        readonly integer: true;
        readonly errorMessage: "Limit must be a positive integer";
    };
    /** Days count: > 0 */
    readonly days: {
        readonly min: 1;
        readonly max: 36500;
        readonly integer: true;
        readonly errorMessage: "Days must be a positive integer (1-36500)";
    };
    /** Budget amount: > 0 */
    readonly budget: {
        readonly min: 0.01;
        readonly errorMessage: "Budget must be a positive number";
    };
    /** Iterations count: > 0 */
    readonly iterations: {
        readonly min: 1;
        readonly integer: true;
        readonly errorMessage: "Iterations must be a positive integer";
    };
    /** PR/Issue number: > 0 and integer */
    readonly issueNumber: {
        readonly min: 1;
        readonly integer: true;
        readonly errorMessage: "Issue/PR number must be a positive integer";
    };
    /** Priority level: >= 0 */
    readonly priority: {
        readonly min: 0;
        readonly integer: true;
        readonly errorMessage: "Priority must be a non-negative integer";
    };
    /** Session count (--last): > 0 */
    readonly sessionCount: {
        readonly min: 1;
        readonly integer: true;
        readonly errorMessage: "Session count must be a positive integer";
    };
    /** Parallel worker count: 1-16 */
    readonly parallel: {
        readonly min: 1;
        readonly max: 16;
        readonly integer: true;
        readonly errorMessage: "Parallel worker count must be a positive integer (1-16)";
    };
};
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
export declare function validateNumeric(value: string, optionName: string, constraint: NumericConstraint | ConstraintName): ValidationResult;
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
export declare function createNumericParser(optionName: string, constraint: NumericConstraint | ConstraintName): (value: string) => number;
/**
 * Validates multiple numeric options at once.
 * Useful for validating options after parsing when custom logic is needed.
 *
 * @param options - Object containing option values to validate
 * @param constraints - Map of option names to their constraints
 * @returns Object with validation results for each option
 */
export declare function validateNumericOptions(options: Record<string, number | undefined>, constraints: Record<string, NumericConstraint | ConstraintName>): {
    valid: boolean;
    errors: string[];
};
/**
 * Formats constraint bounds for help text.
 *
 * @param constraint - Constraint configuration or predefined constraint name
 * @returns Human-readable bounds description
 */
export declare function formatConstraintBounds(constraint: NumericConstraint | ConstraintName): string;
//# sourceMappingURL=validation.d.ts.map
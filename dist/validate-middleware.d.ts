/**
 * Validate command implementation using the middleware system.
 *
 * This is a refactored version of validate.ts that demonstrates the middleware
 * pattern for reducing boilerplate.
 */
import type { BaseCommandOptions } from './types/index.js';
/**
 * Validate command options.
 */
interface ValidateOptions extends BaseCommandOptions {
    quiet?: boolean;
    notifyTest?: boolean;
    strict?: boolean;
    showMerged?: boolean;
    mask?: boolean;
    verbose?: boolean;
    envPrefix?: string;
}
interface TemplateVariableMatch {
    variable: string;
    line: number;
    column: number;
}
export interface TemplateValidationResult {
    templatePath: string;
    unknownVariables: TemplateVariableMatch[];
}
export declare function validateTemplateVariables(templatePath: string, customVariables?: string[]): TemplateValidationResult;
/**
 * Validate command with middleware applied.
 *
 * The middleware chain:
 * 1. withTiming - tracks execution time (added automatically)
 * 2. withErrorHandler - catches and formats errors (added automatically)
 * 3. withJsonOutput - handles JSON serialization (added automatically)
 * 4. withDirectory - resolves chadgiDir and configPath
 *
 * Note: This command does NOT use withDirectoryValidation because it
 * should be able to report that the .chadgi directory doesn't exist.
 */
export declare const validateMiddleware: (options?: ValidateOptions | undefined) => Promise<void>;
export {};
//# sourceMappingURL=validate-middleware.d.ts.map
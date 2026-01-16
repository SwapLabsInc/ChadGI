interface ValidateOptions {
    config?: string;
    quiet?: boolean;
    notifyTest?: boolean;
    strict?: boolean;
    showMerged?: boolean;
    mask?: boolean;
    verbose?: boolean;
    envPrefix?: string;
}
/**
 * Check if a model name is valid
 * @param modelName - The model name to validate
 * @returns true if valid, false otherwise
 */
export declare function isValidModelName(modelName: string): boolean;
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
export declare function validate(options?: ValidateOptions): Promise<boolean>;
export {};
//# sourceMappingURL=validate.d.ts.map
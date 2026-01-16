interface ValidateOptions {
    config?: string;
    quiet?: boolean;
    notifyTest?: boolean;
    strict?: boolean;
    showMerged?: boolean;
    mask?: boolean;
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
export declare function validate(options?: ValidateOptions): Promise<boolean>;
export {};
//# sourceMappingURL=validate.d.ts.map
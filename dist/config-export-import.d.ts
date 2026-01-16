export interface ConfigExportOptions {
    config?: string;
    excludeSecrets?: boolean;
    output?: string;
    format?: 'json' | 'yaml';
}
export interface ConfigImportOptions {
    config?: string;
    merge?: boolean;
    dryRun?: boolean;
    file: string;
}
export declare function configExport(options?: ConfigExportOptions): Promise<void>;
export declare function configImport(options: ConfigImportOptions): Promise<void>;
//# sourceMappingURL=config-export-import.d.ts.map
export interface CompletionOptions {
    shell?: 'bash' | 'zsh' | 'fish';
}
export declare function completion(shell: string): Promise<void>;
export declare function getInstallationInstructions(): string;
//# sourceMappingURL=completion.d.ts.map
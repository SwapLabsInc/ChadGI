/**
 * Version command for ChadGI.
 *
 * Displays version information for ChadGI and key dependencies,
 * and optionally checks for available updates on npm.
 */
import type { BaseCommandOptions } from './types/index.js';
interface VersionOptions extends BaseCommandOptions {
    check?: boolean;
}
export type { VersionInfo } from './types/index.js';
/**
 * Main version command handler
 */
export declare function version(options?: VersionOptions): Promise<void>;
//# sourceMappingURL=version.d.ts.map
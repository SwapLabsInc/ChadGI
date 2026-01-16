/**
 * Doctor command implementation using the middleware system.
 *
 * This is a refactored version of doctor.ts that demonstrates the middleware
 * pattern for reducing boilerplate.
 */
import type { BaseCommandOptions } from './types/index.js';
/**
 * Doctor command options.
 */
interface DoctorOptions extends BaseCommandOptions {
    fix?: boolean;
    mask?: boolean;
}
/**
 * Doctor command with middleware applied.
 *
 * The middleware chain:
 * 1. withTiming - tracks execution time (added automatically)
 * 2. withErrorHandler - catches and formats errors (added automatically)
 * 3. withJsonOutput - handles JSON serialization (added automatically)
 * 4. withDirectory - resolves chadgiDir and configPath
 * 5. withDirectoryValidation - ensures .chadgi directory exists
 */
export declare const doctorMiddleware: (options?: DoctorOptions | undefined) => Promise<void>;
export {};
//# sourceMappingURL=doctor-middleware.d.ts.map
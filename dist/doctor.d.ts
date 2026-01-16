import type { BaseCommandOptions } from './types/index.js';
interface DoctorOptions extends BaseCommandOptions {
    fix?: boolean;
    mask?: boolean;
}
export declare function doctor(options?: DoctorOptions): Promise<void>;
export {};
//# sourceMappingURL=doctor.d.ts.map
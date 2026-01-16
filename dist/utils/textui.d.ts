/**
 * Text UI component library for consistent CLI output formatting.
 *
 * Provides reusable components for tables, sections, badges, status icons,
 * and info boxes. All components use shared colors from colors.ts.
 */
import { type ColorName } from './colors.js';
/**
 * Get terminal width, falling back to 80 if not available.
 */
export declare function getTerminalWidth(): number;
/**
 * Column configuration for Table.
 */
export interface TableColumn {
    /** Column header text */
    header: string;
    /** Key to extract from row data (optional if using render) */
    key?: string;
    /** Column width (characters). Use 'auto' to fit content. */
    width?: number | 'auto';
    /** Text alignment */
    align?: 'left' | 'right' | 'center';
    /** Custom render function for cell value */
    render?: (value: unknown, row: Record<string, unknown>) => string;
    /** Color to apply to values in this column */
    color?: ColorName;
}
/**
 * Options for Table rendering.
 */
export interface TableOptions {
    /** Columns configuration */
    columns: TableColumn[];
    /** Show header row (default: true) */
    showHeader?: boolean;
    /** Border style: 'none', 'ascii', 'unicode' (default: 'unicode') */
    border?: 'none' | 'ascii' | 'unicode';
    /** Minimum column width (default: 3) */
    minColumnWidth?: number;
    /** Maximum table width (default: terminal width) */
    maxWidth?: number;
    /** Padding between columns (default: 2) */
    columnPadding?: number;
    /** Color for header row */
    headerColor?: ColorName;
    /** Show divider line after header (default: true) */
    showHeaderDivider?: boolean;
}
/**
 * Table class for consistent column alignment and borders.
 */
export declare class Table {
    private columns;
    private rows;
    private options;
    constructor(options: TableOptions);
    /**
     * Add a row to the table.
     */
    addRow(row: Record<string, unknown>): this;
    /**
     * Add multiple rows to the table.
     */
    addRows(rows: Record<string, unknown>[]): this;
    /**
     * Clear all rows from the table.
     */
    clear(): this;
    /**
     * Calculate effective column widths.
     */
    private calculateWidths;
    /**
     * Get the formatted cell value for a column.
     */
    private getCellValue;
    /**
     * Strip ANSI escape codes from string for width calculation.
     */
    private stripAnsi;
    /**
     * Pad a string to width with alignment.
     */
    private padCell;
    /**
     * Apply color to a value.
     */
    private applyColor;
    /**
     * Render a divider line.
     */
    private renderDivider;
    /**
     * Render a single row.
     */
    private renderRow;
    /**
     * Render the header row.
     */
    private renderHeader;
    /**
     * Render the entire table as a string.
     */
    render(): string;
    /**
     * Print the table to stdout.
     */
    print(): void;
}
/**
 * Options for Section rendering.
 */
export interface SectionOptions {
    /** Section title */
    title: string;
    /** Title color (default: 'purple') */
    titleColor?: ColorName;
    /** Make title bold (default: true) */
    titleBold?: boolean;
    /** Width of the section (default: 58) */
    width?: number;
    /** Divider character (default: '=') */
    dividerChar?: string;
    /** Show top divider (default: true) */
    showTopDivider?: boolean;
    /** Show bottom divider (default: false) */
    showBottomDivider?: boolean;
    /** Center the title (default: true) */
    centerTitle?: boolean;
}
/**
 * Section class for header/divider sections with consistent styling.
 */
export declare class Section {
    private options;
    private content;
    constructor(options: SectionOptions);
    /**
     * Add content line to the section.
     */
    addLine(line: string): this;
    /**
     * Add multiple content lines.
     */
    addLines(lines: string[]): this;
    /**
     * Add an empty line.
     */
    addBlankLine(): this;
    /**
     * Clear content.
     */
    clear(): this;
    /**
     * Create a divider line.
     */
    private makeDivider;
    /**
     * Format the title.
     */
    private formatTitle;
    /**
     * Render the section header.
     */
    renderHeader(): string;
    /**
     * Render the section with content.
     */
    render(): string;
    /**
     * Print the section to stdout.
     */
    print(): void;
    /**
     * Print just the header.
     */
    printHeader(): void;
}
/**
 * Badge style configuration.
 */
export interface BadgeStyle {
    /** Text color */
    textColor?: ColorName;
    /** Background color */
    bgColor?: ColorName;
    /** Make text bold */
    bold?: boolean;
}
/**
 * Predefined badge types with their styles.
 */
export declare const BadgeStyles: Record<string, BadgeStyle>;
/**
 * Create a styled badge text.
 *
 * @param text - Badge text
 * @param style - Badge style (predefined name or custom style)
 * @returns Styled badge string
 */
export declare function Badge(text: string, style?: keyof typeof BadgeStyles | BadgeStyle): string;
/**
 * Create a bracketed badge like [SUCCESS] or [FAILED].
 */
export declare function BracketedBadge(text: string, style?: keyof typeof BadgeStyles | BadgeStyle): string;
/**
 * Status icon definitions.
 */
export declare const StatusIcons: {
    readonly success: {
        readonly icon: "✓";
        readonly color: ColorName;
    };
    readonly error: {
        readonly icon: "✗";
        readonly color: ColorName;
    };
    readonly warning: {
        readonly icon: "!";
        readonly color: ColorName;
    };
    readonly info: {
        readonly icon: "i";
        readonly color: ColorName;
    };
    readonly pending: {
        readonly icon: "○";
        readonly color: ColorName;
    };
    readonly running: {
        readonly icon: "●";
        readonly color: ColorName;
    };
    readonly paused: {
        readonly icon: "‖";
        readonly color: ColorName;
    };
    readonly blocked: {
        readonly icon: "◌";
        readonly color: ColorName;
    };
    readonly skipped: {
        readonly icon: "→";
        readonly color: ColorName;
    };
    readonly successAscii: {
        readonly icon: "+";
        readonly color: ColorName;
    };
    readonly errorAscii: {
        readonly icon: "x";
        readonly color: ColorName;
    };
    readonly warningAscii: {
        readonly icon: "!";
        readonly color: ColorName;
    };
    readonly infoAscii: {
        readonly icon: "*";
        readonly color: ColorName;
    };
};
export type StatusIconType = keyof typeof StatusIcons;
/**
 * Create a colored status icon.
 *
 * @param type - Icon type
 * @param label - Optional label to append after icon
 * @returns Colored icon string
 */
export declare function StatusIcon(type: StatusIconType, label?: string): string;
/**
 * Options for InfoBox.
 */
export interface InfoBoxOptions {
    /** Box title (optional) */
    title?: string;
    /** Border style: 'single', 'double', 'rounded', 'ascii' (default: 'single') */
    borderStyle?: 'single' | 'double' | 'rounded' | 'ascii';
    /** Border color */
    borderColor?: ColorName;
    /** Title color */
    titleColor?: ColorName;
    /** Content color */
    contentColor?: ColorName;
    /** Padding inside the box (default: 1) */
    padding?: number;
    /** Width of the box (default: auto based on content) */
    width?: number;
    /** Maximum width (default: terminal width - 4) */
    maxWidth?: number;
}
/**
 * InfoBox class for highlighted messages with borders.
 */
export declare class InfoBox {
    private options;
    private lines;
    constructor(options?: InfoBoxOptions);
    /**
     * Add a line of content.
     */
    addLine(line: string): this;
    /**
     * Add multiple lines of content.
     */
    addLines(lines: string[]): this;
    /**
     * Add an empty line.
     */
    addBlankLine(): this;
    /**
     * Clear all content.
     */
    clear(): this;
    /**
     * Strip ANSI codes for width calculation.
     */
    private stripAnsi;
    /**
     * Wrap text to fit within width.
     */
    private wrapText;
    /**
     * Calculate box width based on content.
     */
    private calculateWidth;
    /**
     * Pad content line to fit box width.
     */
    private padLine;
    /**
     * Render the InfoBox.
     */
    render(): string;
    /**
     * Print the InfoBox to stdout.
     */
    print(): void;
}
/**
 * Create and print a section header quickly.
 */
export declare function printSectionHeader(title: string, options?: Partial<SectionOptions>): void;
/**
 * Create and print a table quickly.
 */
export declare function printTable(columns: TableColumn[], rows: Record<string, unknown>[], options?: Partial<TableOptions>): void;
/**
 * Create and print an info box quickly.
 */
export declare function printInfoBox(lines: string[], options?: InfoBoxOptions): void;
/**
 * Create a simple key-value display line.
 *
 * @param key - The label
 * @param value - The value
 * @param keyWidth - Width for the key column (default: 12)
 * @returns Formatted line string
 */
export declare function keyValue(key: string, value: string | number | undefined | null, keyWidth?: number): string;
/**
 * Create a divider line.
 *
 * @param width - Line width (default: 78)
 * @param char - Character to use (default: '─')
 * @param color - Color for the divider
 * @returns Divider string
 */
export declare function divider(width?: number, char?: string, color?: ColorName): string;
//# sourceMappingURL=textui.d.ts.map
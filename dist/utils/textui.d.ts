/**
 * Text UI component library for consistent CLI output formatting.
 *
 * Provides reusable components for tables, sections, badges, status icons,
 * and info boxes. All components use shared colors from colors.ts.
 */
import { type ColorName } from './colors.js';
/**
 * Hyperlink mode setting.
 * - 'auto': Detect terminal support automatically
 * - 'on': Always use hyperlinks
 * - 'off': Never use hyperlinks (plain text)
 */
export type HyperlinkMode = 'auto' | 'on' | 'off';
/**
 * Detect if the terminal supports OSC 8 hyperlinks.
 *
 * Checks environment variables for known terminal emulators that support
 * clickable hyperlinks:
 * - iTerm2, Apple Terminal, Hyper, VS Code (via TERM_PROGRAM)
 * - Windows Terminal (via WT_SESSION)
 * - GNOME Terminal 3.26+ (via VTE_VERSION >= 5000)
 * - Kitty, Alacritty, WezTerm (via TERM_PROGRAM or TERM)
 *
 * @returns true if hyperlinks are supported, false otherwise
 */
export declare function isHyperlinkSupported(): boolean;
/**
 * Clear the hyperlink support cache.
 * Useful for testing or when terminal environment changes.
 */
export declare function clearHyperlinkCache(): void;
/**
 * Set the hyperlink mode.
 *
 * @param mode - 'auto', 'on', or 'off'
 */
export declare function setHyperlinkMode(mode: HyperlinkMode): void;
/**
 * Get the current hyperlink mode.
 *
 * @returns The current hyperlink mode setting
 */
export declare function getHyperlinkMode(): HyperlinkMode;
/**
 * Check if hyperlinks should be used based on current mode and terminal support.
 *
 * @returns true if hyperlinks should be rendered, false for plain text
 */
export declare function shouldUseHyperlinks(): boolean;
/**
 * Create a terminal hyperlink using OSC 8 escape sequences.
 *
 * The OSC 8 format is: \e]8;;URL\e\\TEXT\e]8;;\e\\
 * Where:
 * - \e]8;; starts the hyperlink with the URL
 * - \e\\ (or \x07) terminates the URL/parameter section
 * - TEXT is the visible text
 * - \e]8;;\e\\ ends the hyperlink
 *
 * @param url - The URL to link to
 * @param text - The visible text (defaults to the URL)
 * @returns The formatted hyperlink string, or plain text if hyperlinks disabled
 */
export declare function hyperlink(url: string, text?: string): string;
/**
 * Create a colored terminal hyperlink.
 *
 * Combines hyperlink functionality with color formatting.
 * The color is applied to the visible text portion.
 *
 * @param url - The URL to link to
 * @param text - The visible text (defaults to the URL)
 * @param color - The color to apply to the text
 * @returns The formatted colored hyperlink string
 */
export declare function coloredHyperlink(url: string, text?: string, color?: ColorName): string;
/**
 * Create a GitHub issue/PR URL hyperlink.
 *
 * Convenience function for creating hyperlinks to GitHub issues or PRs.
 *
 * @param url - The GitHub URL
 * @param issueNumber - The issue/PR number to display
 * @returns Formatted hyperlink showing #number that links to the URL
 */
export declare function githubIssueLink(url: string, issueNumber: number): string;
/**
 * Create a GitHub PR URL hyperlink with PR styling.
 *
 * @param url - The GitHub PR URL
 * @param prNumber - The PR number (optional, extracted from URL if not provided)
 * @returns Formatted hyperlink showing PR-xxx that links to the URL
 */
export declare function githubPrLink(url: string, prNumber?: number): string;
/**
 * Initialize hyperlink mode from ChadGI config.
 *
 * Call this function after loading the config to set the hyperlink mode
 * based on the output.hyperlinks configuration option.
 *
 * @param config - Object with optional output.hyperlinks setting
 */
export declare function initHyperlinkModeFromConfig(config?: {
    output?: {
        hyperlinks?: HyperlinkMode;
    };
}): void;
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
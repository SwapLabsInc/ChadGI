/**
 * Text UI component library for consistent CLI output formatting.
 *
 * Provides reusable components for tables, sections, badges, status icons,
 * and info boxes. All components use shared colors from colors.ts.
 */
import { colors } from './colors.js';
/**
 * Cache for terminal hyperlink support detection.
 * Set to null initially to indicate detection hasn't been performed.
 */
let hyperlinkSupportCache = null;
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
export function isHyperlinkSupported() {
    // Return cached result if available
    if (hyperlinkSupportCache !== null) {
        return hyperlinkSupportCache;
    }
    const env = process.env;
    // Check TERM_PROGRAM for known supporting terminals
    const termProgram = env.TERM_PROGRAM?.toLowerCase() || '';
    const supportedTermPrograms = [
        'iterm.app',
        'apple_terminal',
        'hyper',
        'vscode',
        'kitty',
        'alacritty',
        'wezterm',
    ];
    if (supportedTermPrograms.some((t) => termProgram.includes(t))) {
        hyperlinkSupportCache = true;
        return true;
    }
    // Check Windows Terminal
    if (env.WT_SESSION) {
        hyperlinkSupportCache = true;
        return true;
    }
    // Check GNOME Terminal via VTE_VERSION (>= 5000 means version 0.50+)
    const vteVersion = parseInt(env.VTE_VERSION || '0', 10);
    if (vteVersion >= 5000) {
        hyperlinkSupportCache = true;
        return true;
    }
    // Check TERM for additional indicators
    const term = env.TERM?.toLowerCase() || '';
    if (term.includes('kitty') || term.includes('wezterm')) {
        hyperlinkSupportCache = true;
        return true;
    }
    // Check COLORTERM for modern terminal indicators
    const colorterm = env.COLORTERM?.toLowerCase() || '';
    if (colorterm === 'truecolor' && (termProgram || env.KONSOLE_VERSION)) {
        // Many modern terminals with truecolor support also support hyperlinks
        hyperlinkSupportCache = true;
        return true;
    }
    // Default: hyperlinks not supported
    hyperlinkSupportCache = false;
    return false;
}
/**
 * Clear the hyperlink support cache.
 * Useful for testing or when terminal environment changes.
 */
export function clearHyperlinkCache() {
    hyperlinkSupportCache = null;
}
/**
 * Current hyperlink mode setting.
 * Can be set via config or programmatically.
 */
let currentHyperlinkMode = 'auto';
/**
 * Set the hyperlink mode.
 *
 * @param mode - 'auto', 'on', or 'off'
 */
export function setHyperlinkMode(mode) {
    currentHyperlinkMode = mode;
}
/**
 * Get the current hyperlink mode.
 *
 * @returns The current hyperlink mode setting
 */
export function getHyperlinkMode() {
    return currentHyperlinkMode;
}
/**
 * Check if hyperlinks should be used based on current mode and terminal support.
 *
 * @returns true if hyperlinks should be rendered, false for plain text
 */
export function shouldUseHyperlinks() {
    switch (currentHyperlinkMode) {
        case 'on':
            return true;
        case 'off':
            return false;
        case 'auto':
        default:
            return isHyperlinkSupported();
    }
}
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
export function hyperlink(url, text) {
    const displayText = text || url;
    if (!shouldUseHyperlinks()) {
        return displayText;
    }
    // OSC 8 hyperlink format
    // Using \x1b]8;; for start, \x1b\\ (ST) for terminator
    return `\x1b]8;;${url}\x1b\\${displayText}\x1b]8;;\x1b\\`;
}
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
export function coloredHyperlink(url, text, color) {
    const displayText = text || url;
    if (!shouldUseHyperlinks()) {
        // Return colored text without hyperlink
        if (color && colors[color]) {
            return `${colors[color]}${displayText}${colors.reset}`;
        }
        return displayText;
    }
    // Apply color inside the hyperlink text portion
    const coloredText = color && colors[color] ? `${colors[color]}${displayText}${colors.reset}` : displayText;
    return `\x1b]8;;${url}\x1b\\${coloredText}\x1b]8;;\x1b\\`;
}
/**
 * Create a GitHub issue/PR URL hyperlink.
 *
 * Convenience function for creating hyperlinks to GitHub issues or PRs.
 *
 * @param url - The GitHub URL
 * @param issueNumber - The issue/PR number to display
 * @returns Formatted hyperlink showing #number that links to the URL
 */
export function githubIssueLink(url, issueNumber) {
    return hyperlink(url, `#${issueNumber}`);
}
/**
 * Create a GitHub PR URL hyperlink with PR styling.
 *
 * @param url - The GitHub PR URL
 * @param prNumber - The PR number (optional, extracted from URL if not provided)
 * @returns Formatted hyperlink showing PR-xxx that links to the URL
 */
export function githubPrLink(url, prNumber) {
    let number = prNumber;
    if (!number) {
        // Extract PR number from URL like https://github.com/owner/repo/pull/123
        const match = url.match(/\/pull\/(\d+)/);
        if (match) {
            number = parseInt(match[1], 10);
        }
    }
    const text = number ? `PR-${number}` : url;
    return coloredHyperlink(url, text, 'cyan');
}
/**
 * Initialize hyperlink mode from ChadGI config.
 *
 * Call this function after loading the config to set the hyperlink mode
 * based on the output.hyperlinks configuration option.
 *
 * @param config - Object with optional output.hyperlinks setting
 */
export function initHyperlinkModeFromConfig(config) {
    const mode = config?.output?.hyperlinks;
    if (mode && ['auto', 'on', 'off'].includes(mode)) {
        setHyperlinkMode(mode);
    }
    // If not set, defaults to 'auto' which is the initial value
}
/**
 * Get terminal width, falling back to 80 if not available.
 */
export function getTerminalWidth() {
    return process.stdout.columns || 80;
}
/**
 * Table class for consistent column alignment and borders.
 */
export class Table {
    columns;
    rows = [];
    options;
    constructor(options) {
        this.columns = options.columns;
        this.options = {
            showHeader: options.showHeader ?? true,
            border: options.border ?? 'none',
            minColumnWidth: options.minColumnWidth ?? 3,
            maxWidth: options.maxWidth ?? getTerminalWidth(),
            columnPadding: options.columnPadding ?? 2,
            headerColor: options.headerColor ?? 'dim',
            showHeaderDivider: options.showHeaderDivider ?? true,
        };
    }
    /**
     * Add a row to the table.
     */
    addRow(row) {
        this.rows.push(row);
        return this;
    }
    /**
     * Add multiple rows to the table.
     */
    addRows(rows) {
        this.rows.push(...rows);
        return this;
    }
    /**
     * Clear all rows from the table.
     */
    clear() {
        this.rows = [];
        return this;
    }
    /**
     * Calculate effective column widths.
     */
    calculateWidths() {
        const widths = [];
        for (let i = 0; i < this.columns.length; i++) {
            const col = this.columns[i];
            if (typeof col.width === 'number') {
                widths[i] = col.width;
            }
            else {
                // Auto-calculate width based on content
                let maxWidth = this.stripAnsi(col.header).length;
                for (const row of this.rows) {
                    const cellValue = this.getCellValue(row, col);
                    const cellWidth = this.stripAnsi(cellValue).length;
                    maxWidth = Math.max(maxWidth, cellWidth);
                }
                widths[i] = Math.max(maxWidth, this.options.minColumnWidth);
            }
        }
        // Adjust widths to fit within maxWidth
        const totalPadding = (this.columns.length - 1) * this.options.columnPadding;
        const totalWidth = widths.reduce((a, b) => a + b, 0) + totalPadding;
        if (totalWidth > this.options.maxWidth) {
            const excessWidth = totalWidth - this.options.maxWidth;
            const adjustableColumns = widths.filter((w) => w > this.options.minColumnWidth);
            if (adjustableColumns.length > 0) {
                const reductionPerColumn = Math.ceil(excessWidth / adjustableColumns.length);
                for (let i = 0; i < widths.length; i++) {
                    if (widths[i] > this.options.minColumnWidth) {
                        widths[i] = Math.max(this.options.minColumnWidth, widths[i] - reductionPerColumn);
                    }
                }
            }
        }
        return widths;
    }
    /**
     * Get the formatted cell value for a column.
     */
    getCellValue(row, col) {
        if (col.render) {
            const value = col.key ? row[col.key] : undefined;
            return col.render(value, row);
        }
        if (col.key) {
            const value = row[col.key];
            return value === undefined || value === null ? '' : String(value);
        }
        return '';
    }
    /**
     * Strip ANSI escape codes from string for width calculation.
     */
    stripAnsi(str) {
        // eslint-disable-next-line no-control-regex
        return str.replace(/\x1b\[[0-9;]*m/g, '');
    }
    /**
     * Pad a string to width with alignment.
     */
    padCell(value, width, align = 'left') {
        const visibleLength = this.stripAnsi(value).length;
        const padding = width - visibleLength;
        if (padding <= 0) {
            // Truncate if too long
            const stripped = this.stripAnsi(value);
            if (stripped.length > width) {
                return stripped.substring(0, width - 3) + '...';
            }
            return value;
        }
        switch (align) {
            case 'right':
                return ' '.repeat(padding) + value;
            case 'center': {
                const leftPad = Math.floor(padding / 2);
                const rightPad = padding - leftPad;
                return ' '.repeat(leftPad) + value + ' '.repeat(rightPad);
            }
            default:
                return value + ' '.repeat(padding);
        }
    }
    /**
     * Apply color to a value.
     */
    applyColor(value, colorName) {
        if (!colorName)
            return value;
        const color = colors[colorName];
        return color ? `${color}${value}${colors.reset}` : value;
    }
    /**
     * Render a divider line.
     */
    renderDivider(widths) {
        const char = this.options.border === 'ascii' ? '-' : '─';
        const totalWidth = widths.reduce((a, b) => a + b, 0) + (widths.length - 1) * this.options.columnPadding;
        return `${colors.dim}${char.repeat(totalWidth)}${colors.reset}`;
    }
    /**
     * Render a single row.
     */
    renderRow(row, widths) {
        const padding = ' '.repeat(this.options.columnPadding);
        const cells = [];
        for (let i = 0; i < this.columns.length; i++) {
            const col = this.columns[i];
            let value = this.getCellValue(row, col);
            value = this.padCell(value, widths[i], col.align);
            value = this.applyColor(value, col.color);
            cells.push(value);
        }
        return cells.join(padding);
    }
    /**
     * Render the header row.
     */
    renderHeader(widths) {
        const padding = ' '.repeat(this.options.columnPadding);
        const cells = [];
        for (let i = 0; i < this.columns.length; i++) {
            const col = this.columns[i];
            const header = this.padCell(col.header, widths[i], col.align);
            cells.push(header);
        }
        return this.applyColor(cells.join(padding), this.options.headerColor);
    }
    /**
     * Render the entire table as a string.
     */
    render() {
        const widths = this.calculateWidths();
        const lines = [];
        if (this.options.showHeader) {
            lines.push(this.renderHeader(widths));
            if (this.options.showHeaderDivider) {
                lines.push(this.renderDivider(widths));
            }
        }
        for (const row of this.rows) {
            lines.push(this.renderRow(row, widths));
        }
        return lines.join('\n');
    }
    /**
     * Print the table to stdout.
     */
    print() {
        console.log(this.render());
    }
}
/**
 * Section class for header/divider sections with consistent styling.
 */
export class Section {
    options;
    content = [];
    constructor(options) {
        this.options = {
            title: options.title,
            titleColor: options.titleColor ?? 'purple',
            titleBold: options.titleBold ?? true,
            width: options.width ?? 58,
            dividerChar: options.dividerChar ?? '=',
            showTopDivider: options.showTopDivider ?? true,
            showBottomDivider: options.showBottomDivider ?? false,
            centerTitle: options.centerTitle ?? true,
        };
    }
    /**
     * Add content line to the section.
     */
    addLine(line) {
        this.content.push(line);
        return this;
    }
    /**
     * Add multiple content lines.
     */
    addLines(lines) {
        this.content.push(...lines);
        return this;
    }
    /**
     * Add an empty line.
     */
    addBlankLine() {
        this.content.push('');
        return this;
    }
    /**
     * Clear content.
     */
    clear() {
        this.content = [];
        return this;
    }
    /**
     * Create a divider line.
     */
    makeDivider() {
        return this.options.dividerChar.repeat(this.options.width);
    }
    /**
     * Format the title.
     */
    formatTitle() {
        let title = this.options.title;
        if (this.options.centerTitle) {
            const padding = Math.max(0, this.options.width - title.length);
            const leftPad = Math.floor(padding / 2);
            title = ' '.repeat(leftPad) + title;
        }
        const color = colors[this.options.titleColor] || '';
        const bold = this.options.titleBold ? colors.bold : '';
        return `${color}${bold}${title}${colors.reset}`;
    }
    /**
     * Render the section header.
     */
    renderHeader() {
        const lines = [];
        const color = colors[this.options.titleColor] || '';
        const bold = this.options.titleBold ? colors.bold : '';
        if (this.options.showTopDivider) {
            lines.push(`${color}${bold}${this.makeDivider()}${colors.reset}`);
        }
        lines.push(this.formatTitle());
        if (this.options.showTopDivider) {
            lines.push(`${color}${bold}${this.makeDivider()}${colors.reset}`);
        }
        return lines.join('\n');
    }
    /**
     * Render the section with content.
     */
    render() {
        const lines = [this.renderHeader()];
        if (this.content.length > 0) {
            lines.push(''); // Blank line after header
            lines.push(...this.content);
        }
        if (this.options.showBottomDivider) {
            lines.push(`${colors[this.options.titleColor] || ''}${this.makeDivider()}${colors.reset}`);
        }
        return lines.join('\n');
    }
    /**
     * Print the section to stdout.
     */
    print() {
        console.log(this.render());
    }
    /**
     * Print just the header.
     */
    printHeader() {
        console.log(this.renderHeader());
    }
}
/**
 * Predefined badge types with their styles.
 */
export const BadgeStyles = {
    success: { textColor: 'green', bold: true },
    error: { textColor: 'red', bold: true },
    warning: { textColor: 'yellow', bold: true },
    info: { textColor: 'cyan', bold: true },
    primary: { textColor: 'purple', bold: true },
    secondary: { textColor: 'dim', bold: false },
};
/**
 * Create a styled badge text.
 *
 * @param text - Badge text
 * @param style - Badge style (predefined name or custom style)
 * @returns Styled badge string
 */
export function Badge(text, style = 'info') {
    const resolvedStyle = typeof style === 'string' ? BadgeStyles[style] : style;
    let result = text;
    if (resolvedStyle.bold) {
        result = `${colors.bold}${result}`;
    }
    if (resolvedStyle.bgColor && colors[resolvedStyle.bgColor]) {
        result = `${colors[resolvedStyle.bgColor]}${result}`;
    }
    if (resolvedStyle.textColor && colors[resolvedStyle.textColor]) {
        result = `${colors[resolvedStyle.textColor]}${result}`;
    }
    return `${result}${colors.reset}`;
}
/**
 * Create a bracketed badge like [SUCCESS] or [FAILED].
 */
export function BracketedBadge(text, style = 'info') {
    return Badge(`[${text}]`, style);
}
// ============================================================================
// StatusIcon Component
// ============================================================================
/**
 * Status icon definitions.
 */
export const StatusIcons = {
    success: { icon: '✓', color: 'green' },
    error: { icon: '✗', color: 'red' },
    warning: { icon: '!', color: 'yellow' },
    info: { icon: 'i', color: 'cyan' },
    pending: { icon: '○', color: 'dim' },
    running: { icon: '●', color: 'green' },
    paused: { icon: '‖', color: 'yellow' },
    blocked: { icon: '◌', color: 'red' },
    skipped: { icon: '→', color: 'yellow' },
    // ASCII-safe alternatives
    successAscii: { icon: '+', color: 'green' },
    errorAscii: { icon: 'x', color: 'red' },
    warningAscii: { icon: '!', color: 'yellow' },
    infoAscii: { icon: '*', color: 'cyan' },
};
/**
 * Create a colored status icon.
 *
 * @param type - Icon type
 * @param label - Optional label to append after icon
 * @returns Colored icon string
 */
export function StatusIcon(type, label) {
    const { icon, color } = StatusIcons[type];
    const colorCode = colors[color] || '';
    const result = `${colorCode}${icon}${colors.reset}`;
    return label ? `${result} ${label}` : result;
}
/**
 * Border character sets.
 */
const BoxBorders = {
    single: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' },
    double: { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' },
    rounded: { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│' },
    ascii: { tl: '+', tr: '+', bl: '+', br: '+', h: '-', v: '|' },
};
/**
 * InfoBox class for highlighted messages with borders.
 */
export class InfoBox {
    options;
    lines = [];
    constructor(options = {}) {
        this.options = {
            title: options.title,
            borderStyle: options.borderStyle ?? 'single',
            borderColor: options.borderColor ?? 'cyan',
            titleColor: options.titleColor ?? 'cyan',
            contentColor: options.contentColor,
            padding: options.padding ?? 1,
            width: options.width,
            maxWidth: options.maxWidth ?? getTerminalWidth() - 4,
        };
    }
    /**
     * Add a line of content.
     */
    addLine(line) {
        this.lines.push(line);
        return this;
    }
    /**
     * Add multiple lines of content.
     */
    addLines(lines) {
        this.lines.push(...lines);
        return this;
    }
    /**
     * Add an empty line.
     */
    addBlankLine() {
        this.lines.push('');
        return this;
    }
    /**
     * Clear all content.
     */
    clear() {
        this.lines = [];
        return this;
    }
    /**
     * Strip ANSI codes for width calculation.
     */
    stripAnsi(str) {
        // eslint-disable-next-line no-control-regex
        return str.replace(/\x1b\[[0-9;]*m/g, '');
    }
    /**
     * Wrap text to fit within width.
     */
    wrapText(text, width) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
        for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            if (this.stripAnsi(testLine).length <= width) {
                currentLine = testLine;
            }
            else {
                if (currentLine) {
                    lines.push(currentLine);
                }
                currentLine = word;
            }
        }
        if (currentLine) {
            lines.push(currentLine);
        }
        return lines.length > 0 ? lines : [''];
    }
    /**
     * Calculate box width based on content.
     */
    calculateWidth() {
        if (this.options.width) {
            return Math.min(this.options.width, this.options.maxWidth);
        }
        let maxContentWidth = 0;
        // Check title width
        if (this.options.title) {
            maxContentWidth = Math.max(maxContentWidth, this.stripAnsi(this.options.title).length);
        }
        // Check content width
        for (const line of this.lines) {
            maxContentWidth = Math.max(maxContentWidth, this.stripAnsi(line).length);
        }
        // Add padding and border space
        const totalWidth = maxContentWidth + this.options.padding * 2 + 2;
        return Math.min(totalWidth, this.options.maxWidth);
    }
    /**
     * Pad content line to fit box width.
     */
    padLine(line, contentWidth) {
        const visibleLength = this.stripAnsi(line).length;
        const padding = Math.max(0, contentWidth - visibleLength);
        return line + ' '.repeat(padding);
    }
    /**
     * Render the InfoBox.
     */
    render() {
        const border = BoxBorders[this.options.borderStyle];
        const borderColor = colors[this.options.borderColor] || '';
        const titleColor = colors[this.options.titleColor] || '';
        const contentColor = this.options.contentColor ? colors[this.options.contentColor] || '' : '';
        const boxWidth = this.calculateWidth();
        const contentWidth = boxWidth - 2 - this.options.padding * 2; // Subtract borders and padding
        const paddingStr = ' '.repeat(this.options.padding);
        const output = [];
        // Top border with optional title
        if (this.options.title) {
            const titleText = ` ${this.options.title} `;
            const titleLen = this.stripAnsi(titleText).length;
            const availableWidth = boxWidth - 2;
            const leftLen = Math.floor((availableWidth - titleLen) / 2);
            const rightLen = availableWidth - titleLen - leftLen;
            output.push(`${borderColor}${border.tl}${border.h.repeat(leftLen)}${colors.reset}${titleColor}${titleText}${colors.reset}${borderColor}${border.h.repeat(rightLen)}${border.tr}${colors.reset}`);
        }
        else {
            output.push(`${borderColor}${border.tl}${border.h.repeat(boxWidth - 2)}${border.tr}${colors.reset}`);
        }
        // Content lines with word wrapping
        for (const line of this.lines) {
            const wrappedLines = this.wrapText(line, contentWidth);
            for (const wrappedLine of wrappedLines) {
                const paddedLine = this.padLine(wrappedLine, contentWidth);
                const formattedLine = contentColor ? `${contentColor}${paddedLine}${colors.reset}` : paddedLine;
                output.push(`${borderColor}${border.v}${colors.reset}${paddingStr}${formattedLine}${paddingStr}${borderColor}${border.v}${colors.reset}`);
            }
        }
        // Bottom border
        output.push(`${borderColor}${border.bl}${border.h.repeat(boxWidth - 2)}${border.br}${colors.reset}`);
        return output.join('\n');
    }
    /**
     * Print the InfoBox to stdout.
     */
    print() {
        console.log(this.render());
    }
}
// ============================================================================
// Convenience Functions
// ============================================================================
/**
 * Create and print a section header quickly.
 */
export function printSectionHeader(title, options) {
    new Section({ title, ...options }).printHeader();
}
/**
 * Create and print a table quickly.
 */
export function printTable(columns, rows, options) {
    const table = new Table({ columns, ...options });
    table.addRows(rows);
    table.print();
}
/**
 * Create and print an info box quickly.
 */
export function printInfoBox(lines, options) {
    const box = new InfoBox(options);
    box.addLines(lines);
    box.print();
}
/**
 * Create a simple key-value display line.
 *
 * @param key - The label
 * @param value - The value
 * @param keyWidth - Width for the key column (default: 12)
 * @returns Formatted line string
 */
export function keyValue(key, value, keyWidth = 12) {
    const keyStr = `${colors.cyan}${key.padEnd(keyWidth)}${colors.reset}`;
    return `  ${keyStr}${value ?? ''}`;
}
/**
 * Create a divider line.
 *
 * @param width - Line width (default: 78)
 * @param char - Character to use (default: '─')
 * @param color - Color for the divider
 * @returns Divider string
 */
export function divider(width = 78, char = '─', color = 'dim') {
    const colorCode = colors[color] || '';
    return `${colorCode}${char.repeat(width)}${colors.reset}`;
}
//# sourceMappingURL=textui.js.map
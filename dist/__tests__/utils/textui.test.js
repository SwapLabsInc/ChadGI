/**
 * Unit tests for src/utils/textui.ts
 *
 * Tests Text UI components: Table, Section, Badge, StatusIcon, and InfoBox.
 */
import { jest } from '@jest/globals';
import { getTerminalWidth, Table, Section, Badge, BracketedBadge, BadgeStyles, StatusIcon, StatusIcons, InfoBox, printSectionHeader, printTable, printInfoBox, keyValue, divider, } from '../../utils/textui.js';
import { colors } from '../../utils/colors.js';
// Helper to strip ANSI codes for easier testing
function stripAnsi(str) {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1b\[[0-9;]*m/g, '');
}
describe('getTerminalWidth', () => {
    it('should return process.stdout.columns if available', () => {
        const originalColumns = process.stdout.columns;
        process.stdout.columns = 120;
        expect(getTerminalWidth()).toBe(120);
        process.stdout.columns = originalColumns;
    });
    it('should return 80 as default if stdout.columns is not available', () => {
        const originalColumns = process.stdout.columns;
        process.stdout.columns = undefined;
        expect(getTerminalWidth()).toBe(80);
        process.stdout.columns = originalColumns;
    });
});
describe('Table', () => {
    const simpleColumns = [
        { header: 'ID', key: 'id', width: 5 },
        { header: 'Name', key: 'name', width: 15 },
        { header: 'Status', key: 'status', width: 10 },
    ];
    const simpleRows = [
        { id: 1, name: 'Alice', status: 'active' },
        { id: 2, name: 'Bob', status: 'inactive' },
        { id: 3, name: 'Charlie', status: 'pending' },
    ];
    describe('constructor and basic rendering', () => {
        it('should create a table with basic columns and render header', () => {
            const table = new Table({ columns: simpleColumns });
            const output = table.render();
            const stripped = stripAnsi(output);
            expect(stripped).toContain('ID');
            expect(stripped).toContain('Name');
            expect(stripped).toContain('Status');
        });
        it('should render rows when added', () => {
            const table = new Table({ columns: simpleColumns });
            table.addRows(simpleRows);
            const output = stripAnsi(table.render());
            expect(output).toContain('Alice');
            expect(output).toContain('Bob');
            expect(output).toContain('Charlie');
            expect(output).toContain('active');
            expect(output).toContain('inactive');
            expect(output).toContain('pending');
        });
        it('should handle empty table', () => {
            const table = new Table({ columns: simpleColumns });
            const output = table.render();
            expect(output).toBeDefined();
            expect(stripAnsi(output)).toContain('ID');
        });
    });
    describe('addRow and addRows', () => {
        it('should add single row', () => {
            const table = new Table({ columns: simpleColumns });
            table.addRow({ id: 1, name: 'Test', status: 'ok' });
            const output = stripAnsi(table.render());
            expect(output).toContain('Test');
            expect(output).toContain('ok');
        });
        it('should add multiple rows', () => {
            const table = new Table({ columns: simpleColumns });
            table.addRows(simpleRows);
            const output = stripAnsi(table.render());
            expect(output).toContain('Alice');
            expect(output).toContain('Bob');
            expect(output).toContain('Charlie');
        });
        it('should chain addRow calls', () => {
            const table = new Table({ columns: simpleColumns });
            table.addRow({ id: 1, name: 'First', status: 'ok' }).addRow({ id: 2, name: 'Second', status: 'ok' });
            const output = stripAnsi(table.render());
            expect(output).toContain('First');
            expect(output).toContain('Second');
        });
    });
    describe('clear', () => {
        it('should clear all rows', () => {
            const table = new Table({ columns: simpleColumns });
            table.addRows(simpleRows);
            table.clear();
            const output = stripAnsi(table.render());
            // Should only have header, no data rows
            expect(output).toContain('ID');
            expect(output).not.toContain('Alice');
        });
    });
    describe('column options', () => {
        it('should apply right alignment', () => {
            const columns = [
                { header: 'Number', key: 'num', width: 10, align: 'right' },
            ];
            const table = new Table({ columns });
            table.addRow({ num: '5' });
            const output = stripAnsi(table.render());
            // Number should be right-aligned (spaces before the value)
            const lines = output.split('\n');
            const dataLine = lines.find((l) => l.includes('5'));
            expect(dataLine).toBeDefined();
        });
        it('should apply center alignment', () => {
            const columns = [
                { header: 'Center', key: 'val', width: 10, align: 'center' },
            ];
            const table = new Table({ columns });
            table.addRow({ val: 'X' });
            const output = stripAnsi(table.render());
            // Value should be centered
            const lines = output.split('\n');
            const dataLine = lines.find((l) => l.includes('X'));
            expect(dataLine).toBeDefined();
        });
        it('should apply custom render function', () => {
            const columns = [
                {
                    header: 'Status',
                    key: 'status',
                    render: (value) => (value === 'ok' ? 'SUCCESS' : 'FAILURE'),
                },
            ];
            const table = new Table({ columns });
            table.addRow({ status: 'ok' });
            table.addRow({ status: 'fail' });
            const output = stripAnsi(table.render());
            expect(output).toContain('SUCCESS');
            expect(output).toContain('FAILURE');
        });
        it('should apply column color', () => {
            const columns = [
                { header: 'Name', key: 'name', color: 'green' },
            ];
            const table = new Table({ columns });
            table.addRow({ name: 'Test' });
            const output = table.render();
            // Should contain green color code
            expect(output).toContain(colors.green);
        });
    });
    describe('table options', () => {
        it('should hide header when showHeader is false', () => {
            const table = new Table({ columns: simpleColumns, showHeader: false });
            table.addRows(simpleRows);
            const output = stripAnsi(table.render());
            // Should not contain header line at the top
            const lines = output.split('\n');
            expect(lines[0]).not.toContain('ID  '); // First line should be data
        });
        it('should hide header divider when showHeaderDivider is false', () => {
            const table = new Table({ columns: simpleColumns, showHeaderDivider: false });
            table.addRows(simpleRows);
            const output = stripAnsi(table.render());
            // Should not contain divider line
            expect(output).not.toContain('─');
        });
        it('should use ascii border style', () => {
            const table = new Table({ columns: simpleColumns, border: 'ascii' });
            table.addRows(simpleRows);
            const output = stripAnsi(table.render());
            // Should use dashes for divider
            expect(output).toContain('-');
        });
    });
    describe('auto width calculation', () => {
        it('should auto-calculate width based on content', () => {
            const columns = [
                { header: 'Short', key: 'short' },
                { header: 'Long Column', key: 'long' },
            ];
            const table = new Table({ columns });
            table.addRow({ short: 'A', long: 'Very Long Value Here' });
            const output = stripAnsi(table.render());
            // Should render without truncation
            expect(output).toContain('Very Long Value Here');
        });
    });
    describe('print', () => {
        it('should print to stdout', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
            const table = new Table({ columns: simpleColumns });
            table.addRows(simpleRows);
            table.print();
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });
});
describe('Section', () => {
    describe('constructor and rendering', () => {
        it('should create a section with title', () => {
            const section = new Section({ title: 'TEST SECTION' });
            const output = stripAnsi(section.render());
            expect(output).toContain('TEST SECTION');
        });
        it('should include dividers by default', () => {
            const section = new Section({ title: 'TEST' });
            const output = stripAnsi(section.render());
            expect(output).toContain('=');
        });
        it('should center title by default', () => {
            const section = new Section({ title: 'TEST', width: 20 });
            const output = stripAnsi(section.renderHeader());
            const lines = output.split('\n');
            const titleLine = lines.find((l) => l.includes('TEST'));
            expect(titleLine).toBeDefined();
            // Title should have leading spaces for centering
        });
    });
    describe('content management', () => {
        it('should add content lines', () => {
            const section = new Section({ title: 'Test' });
            section.addLine('Content line 1');
            section.addLine('Content line 2');
            const output = stripAnsi(section.render());
            expect(output).toContain('Content line 1');
            expect(output).toContain('Content line 2');
        });
        it('should add multiple lines at once', () => {
            const section = new Section({ title: 'Test' });
            section.addLines(['Line 1', 'Line 2', 'Line 3']);
            const output = stripAnsi(section.render());
            expect(output).toContain('Line 1');
            expect(output).toContain('Line 2');
            expect(output).toContain('Line 3');
        });
        it('should add blank lines', () => {
            const section = new Section({ title: 'Test' });
            section.addLine('Before');
            section.addBlankLine();
            section.addLine('After');
            const output = stripAnsi(section.render());
            expect(output).toContain('Before');
            expect(output).toContain('After');
        });
        it('should clear content', () => {
            const section = new Section({ title: 'Test' });
            section.addLine('Content');
            section.clear();
            const output = stripAnsi(section.render());
            expect(output).not.toContain('Content');
            expect(output).toContain('Test'); // Title should remain
        });
    });
    describe('options', () => {
        it('should hide top divider when showTopDivider is false', () => {
            const section = new Section({ title: 'Test', showTopDivider: false });
            const output = stripAnsi(section.render());
            // Should not have divider at the top
            const lines = output.split('\n');
            expect(lines[0]).toContain('Test');
        });
        it('should show bottom divider when showBottomDivider is true', () => {
            const section = new Section({ title: 'Test', showBottomDivider: true, showTopDivider: false });
            section.addLine('Content');
            const output = stripAnsi(section.render());
            const lines = output.split('\n');
            // Last line should be divider
            expect(lines[lines.length - 1]).toContain('=');
        });
        it('should use custom divider character', () => {
            const section = new Section({ title: 'Test', dividerChar: '-' });
            const output = stripAnsi(section.render());
            expect(output).toContain('-');
            expect(output).not.toContain('=');
        });
        it('should apply custom width', () => {
            const section = new Section({ title: 'Test', width: 30 });
            const output = stripAnsi(section.render());
            const lines = output.split('\n').filter((l) => l.length > 0);
            const dividerLine = lines[0];
            expect(dividerLine.length).toBe(30);
        });
        it('should apply title color', () => {
            const section = new Section({ title: 'Test', titleColor: 'cyan' });
            const output = section.render();
            expect(output).toContain(colors.cyan);
        });
    });
    describe('print methods', () => {
        it('should print full section', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
            const section = new Section({ title: 'Test' });
            section.addLine('Content');
            section.print();
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
        it('should print header only', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
            const section = new Section({ title: 'Test' });
            section.addLine('Content');
            section.printHeader();
            expect(consoleSpy).toHaveBeenCalled();
            const callArg = consoleSpy.mock.calls[0][0];
            expect(callArg).not.toContain('Content');
            consoleSpy.mockRestore();
        });
    });
});
describe('Badge', () => {
    it('should create a simple badge', () => {
        const badge = Badge('TEST', 'info');
        const stripped = stripAnsi(badge);
        expect(stripped).toBe('TEST');
    });
    it('should apply predefined styles', () => {
        const successBadge = Badge('SUCCESS', 'success');
        expect(successBadge).toContain(colors.green);
        const errorBadge = Badge('ERROR', 'error');
        expect(errorBadge).toContain(colors.red);
        const warningBadge = Badge('WARNING', 'warning');
        expect(warningBadge).toContain(colors.yellow);
    });
    it('should apply custom style', () => {
        const badge = Badge('CUSTOM', { textColor: 'purple', bold: true });
        expect(badge).toContain(colors.purple);
        expect(badge).toContain(colors.bold);
    });
    it('should use default style when not specified', () => {
        const badge = Badge('DEFAULT');
        expect(badge).toContain(colors.cyan); // info is default
    });
});
describe('BracketedBadge', () => {
    it('should wrap text in brackets', () => {
        const badge = BracketedBadge('TEST', 'success');
        const stripped = stripAnsi(badge);
        expect(stripped).toBe('[TEST]');
    });
    it('should apply style to bracketed text', () => {
        const badge = BracketedBadge('SUCCESS', 'success');
        expect(badge).toContain(colors.green);
        expect(stripAnsi(badge)).toBe('[SUCCESS]');
    });
});
describe('BadgeStyles', () => {
    it('should have predefined styles', () => {
        expect(BadgeStyles.success).toBeDefined();
        expect(BadgeStyles.error).toBeDefined();
        expect(BadgeStyles.warning).toBeDefined();
        expect(BadgeStyles.info).toBeDefined();
        expect(BadgeStyles.primary).toBeDefined();
        expect(BadgeStyles.secondary).toBeDefined();
    });
});
describe('StatusIcon', () => {
    it('should return colored icon', () => {
        const icon = StatusIcon('success');
        expect(icon).toContain(colors.green);
        expect(stripAnsi(icon)).toBe(StatusIcons.success.icon);
    });
    it('should append label when provided', () => {
        const icon = StatusIcon('success', 'Completed');
        const stripped = stripAnsi(icon);
        expect(stripped).toContain(StatusIcons.success.icon);
        expect(stripped).toContain('Completed');
    });
    it('should support all icon types', () => {
        const types = Object.keys(StatusIcons);
        for (const type of types) {
            const icon = StatusIcon(type);
            const stripped = stripAnsi(icon);
            expect(stripped).toBe(StatusIcons[type].icon);
        }
    });
});
describe('StatusIcons', () => {
    it('should have predefined icons', () => {
        expect(StatusIcons.success).toBeDefined();
        expect(StatusIcons.error).toBeDefined();
        expect(StatusIcons.warning).toBeDefined();
        expect(StatusIcons.info).toBeDefined();
        expect(StatusIcons.pending).toBeDefined();
        expect(StatusIcons.running).toBeDefined();
        expect(StatusIcons.paused).toBeDefined();
        expect(StatusIcons.blocked).toBeDefined();
        expect(StatusIcons.skipped).toBeDefined();
    });
    it('should have ASCII alternatives', () => {
        expect(StatusIcons.successAscii).toBeDefined();
        expect(StatusIcons.errorAscii).toBeDefined();
        expect(StatusIcons.warningAscii).toBeDefined();
        expect(StatusIcons.infoAscii).toBeDefined();
    });
});
describe('InfoBox', () => {
    describe('basic rendering', () => {
        it('should render a simple box', () => {
            const box = new InfoBox();
            box.addLine('Hello World');
            const output = stripAnsi(box.render());
            expect(output).toContain('Hello World');
            expect(output).toContain('┌');
            expect(output).toContain('┐');
            expect(output).toContain('└');
            expect(output).toContain('┘');
            expect(output).toContain('│');
        });
        it('should render with title', () => {
            const box = new InfoBox({ title: 'Notice' });
            box.addLine('Content');
            const output = stripAnsi(box.render());
            expect(output).toContain('Notice');
            expect(output).toContain('Content');
        });
    });
    describe('content management', () => {
        it('should add single line', () => {
            const box = new InfoBox();
            box.addLine('Line 1');
            const output = stripAnsi(box.render());
            expect(output).toContain('Line 1');
        });
        it('should add multiple lines', () => {
            const box = new InfoBox();
            box.addLines(['Line 1', 'Line 2', 'Line 3']);
            const output = stripAnsi(box.render());
            expect(output).toContain('Line 1');
            expect(output).toContain('Line 2');
            expect(output).toContain('Line 3');
        });
        it('should add blank lines', () => {
            const box = new InfoBox();
            box.addLine('Before');
            box.addBlankLine();
            box.addLine('After');
            const output = stripAnsi(box.render());
            expect(output).toContain('Before');
            expect(output).toContain('After');
        });
        it('should clear content', () => {
            const box = new InfoBox();
            box.addLine('Content');
            box.clear();
            const output = stripAnsi(box.render());
            expect(output).not.toContain('Content');
        });
        it('should chain methods', () => {
            const box = new InfoBox();
            box.addLine('Line 1').addLine('Line 2').addBlankLine().addLine('Line 3');
            const output = stripAnsi(box.render());
            expect(output).toContain('Line 1');
            expect(output).toContain('Line 2');
            expect(output).toContain('Line 3');
        });
    });
    describe('border styles', () => {
        it('should use single border by default', () => {
            const box = new InfoBox();
            box.addLine('Test');
            const output = box.render();
            expect(output).toContain('┌');
        });
        it('should use double border when specified', () => {
            const box = new InfoBox({ borderStyle: 'double' });
            box.addLine('Test');
            const output = box.render();
            expect(output).toContain('╔');
            expect(output).toContain('╗');
        });
        it('should use rounded border when specified', () => {
            const box = new InfoBox({ borderStyle: 'rounded' });
            box.addLine('Test');
            const output = box.render();
            expect(output).toContain('╭');
            expect(output).toContain('╯');
        });
        it('should use ascii border when specified', () => {
            const box = new InfoBox({ borderStyle: 'ascii' });
            box.addLine('Test');
            const output = box.render();
            expect(output).toContain('+');
            expect(output).toContain('-');
            expect(output).toContain('|');
        });
    });
    describe('colors', () => {
        it('should apply border color', () => {
            const box = new InfoBox({ borderColor: 'green' });
            box.addLine('Test');
            const output = box.render();
            expect(output).toContain(colors.green);
        });
        it('should apply title color', () => {
            const box = new InfoBox({ title: 'Title', titleColor: 'purple' });
            box.addLine('Test');
            const output = box.render();
            expect(output).toContain(colors.purple);
        });
        it('should apply content color', () => {
            const box = new InfoBox({ contentColor: 'yellow' });
            box.addLine('Test');
            const output = box.render();
            expect(output).toContain(colors.yellow);
        });
    });
    describe('width handling', () => {
        it('should auto-calculate width based on content', () => {
            const box = new InfoBox();
            box.addLine('Short');
            const shortOutput = stripAnsi(box.render());
            const shortWidth = shortOutput.split('\n')[0].length;
            const box2 = new InfoBox();
            box2.addLine('This is a much longer line of content');
            const longOutput = stripAnsi(box2.render());
            const longWidth = longOutput.split('\n')[0].length;
            expect(longWidth).toBeGreaterThan(shortWidth);
        });
        it('should respect fixed width', () => {
            const box = new InfoBox({ width: 40 });
            box.addLine('Test');
            const output = stripAnsi(box.render());
            const lines = output.split('\n');
            expect(lines[0].length).toBe(40);
        });
        it('should wrap long text', () => {
            const box = new InfoBox({ width: 30 });
            box.addLine('This is a very long line that should be wrapped to multiple lines');
            const output = stripAnsi(box.render());
            const lines = output.split('\n');
            // Should have more content lines due to wrapping
            expect(lines.length).toBeGreaterThan(3);
        });
    });
    describe('print', () => {
        it('should print to stdout', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
            const box = new InfoBox();
            box.addLine('Test');
            box.print();
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });
});
describe('Convenience Functions', () => {
    describe('printSectionHeader', () => {
        it('should print section header', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
            printSectionHeader('Test Header');
            expect(consoleSpy).toHaveBeenCalled();
            const output = consoleSpy.mock.calls[0][0];
            expect(stripAnsi(output)).toContain('Test Header');
            consoleSpy.mockRestore();
        });
        it('should accept options', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
            printSectionHeader('Test', { titleColor: 'green' });
            expect(consoleSpy).toHaveBeenCalled();
            const output = consoleSpy.mock.calls[0][0];
            expect(output).toContain(colors.green);
            consoleSpy.mockRestore();
        });
    });
    describe('printTable', () => {
        it('should print a table', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
            const columns = [{ header: 'Name', key: 'name' }];
            const rows = [{ name: 'Alice' }];
            printTable(columns, rows);
            expect(consoleSpy).toHaveBeenCalled();
            const output = stripAnsi(consoleSpy.mock.calls[0][0]);
            expect(output).toContain('Name');
            expect(output).toContain('Alice');
            consoleSpy.mockRestore();
        });
    });
    describe('printInfoBox', () => {
        it('should print an info box', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
            printInfoBox(['Line 1', 'Line 2']);
            expect(consoleSpy).toHaveBeenCalled();
            const output = stripAnsi(consoleSpy.mock.calls[0][0]);
            expect(output).toContain('Line 1');
            expect(output).toContain('Line 2');
            consoleSpy.mockRestore();
        });
        it('should accept options', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
            printInfoBox(['Content'], { title: 'Notice' });
            expect(consoleSpy).toHaveBeenCalled();
            const output = stripAnsi(consoleSpy.mock.calls[0][0]);
            expect(output).toContain('Notice');
            consoleSpy.mockRestore();
        });
    });
    describe('keyValue', () => {
        it('should format key-value pair', () => {
            const output = keyValue('Key', 'Value');
            const stripped = stripAnsi(output);
            expect(stripped).toContain('Key');
            expect(stripped).toContain('Value');
        });
        it('should pad key to specified width', () => {
            const output = keyValue('K', 'V', 10);
            const stripped = stripAnsi(output);
            // Key should be padded
            expect(stripped).toContain('K         V');
        });
        it('should handle undefined value', () => {
            const output = keyValue('Key', undefined);
            const stripped = stripAnsi(output);
            expect(stripped).toContain('Key');
        });
        it('should handle null value', () => {
            const output = keyValue('Key', null);
            const stripped = stripAnsi(output);
            expect(stripped).toContain('Key');
        });
        it('should handle numeric value', () => {
            const output = keyValue('Count', 42);
            const stripped = stripAnsi(output);
            expect(stripped).toContain('42');
        });
        it('should apply cyan color to key', () => {
            const output = keyValue('Key', 'Value');
            expect(output).toContain(colors.cyan);
        });
    });
    describe('divider', () => {
        it('should create a divider line with default settings', () => {
            const output = divider();
            const stripped = stripAnsi(output);
            expect(stripped.length).toBe(78);
            expect(stripped).toBe('─'.repeat(78));
        });
        it('should create a divider with custom width', () => {
            const output = divider(40);
            const stripped = stripAnsi(output);
            expect(stripped.length).toBe(40);
        });
        it('should create a divider with custom character', () => {
            const output = divider(20, '=');
            const stripped = stripAnsi(output);
            expect(stripped).toBe('='.repeat(20));
        });
        it('should apply color', () => {
            const output = divider(10, '-', 'cyan');
            expect(output).toContain(colors.cyan);
        });
    });
});
//# sourceMappingURL=textui.test.js.map
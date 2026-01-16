#!/bin/bash
#
# Tests for Cleanup Command functionality
#
# Run with: bash tests/test-cleanup.sh
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

TESTS_PASSED=0
TESTS_FAILED=0

# Test helper functions
pass() {
    echo -e "${GREEN}PASS${NC}: $1"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

fail() {
    echo -e "${RED}FAIL${NC}: $1"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo "  Cleanup Command Tests"
echo "=========================================="
echo ""

#------------------------------------------------------------------------------
# Test 1: cleanup.ts file exists
#------------------------------------------------------------------------------
echo "Test 1: cleanup.ts file exists"

if [ -f "$PROJECT_ROOT/src/cleanup.ts" ]; then
    pass "cleanup.ts file exists"
else
    fail "cleanup.ts should exist"
fi

#------------------------------------------------------------------------------
# Test 2: CLI has cleanup command
#------------------------------------------------------------------------------
echo "Test 2: CLI has cleanup command"

if grep -q "command('cleanup')" "$PROJECT_ROOT/src/cli.ts"; then
    pass "cleanup command exists in CLI"
else
    fail "cleanup command should exist in CLI"
fi

#------------------------------------------------------------------------------
# Test 3: CLI imports cleanup module
#------------------------------------------------------------------------------
echo "Test 3: CLI imports cleanup module"

if grep -q "import { cleanup }" "$PROJECT_ROOT/src/cli.ts"; then
    pass "cleanup module imported in CLI"
else
    fail "cleanup module should be imported in CLI"
fi

#------------------------------------------------------------------------------
# Test 4: Cleanup command has --branches option
#------------------------------------------------------------------------------
echo "Test 4: Cleanup command has --branches option"

if grep -A15 "command('cleanup')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-branches"; then
    pass "--branches option exists for cleanup command"
else
    fail "cleanup command should have --branches option"
fi

#------------------------------------------------------------------------------
# Test 5: Cleanup command has --diagnostics option
#------------------------------------------------------------------------------
echo "Test 5: Cleanup command has --diagnostics option"

if grep -A15 "command('cleanup')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-diagnostics"; then
    pass "--diagnostics option exists for cleanup command"
else
    fail "cleanup command should have --diagnostics option"
fi

#------------------------------------------------------------------------------
# Test 6: Cleanup command has --logs option
#------------------------------------------------------------------------------
echo "Test 6: Cleanup command has --logs option"

if grep -A15 "command('cleanup')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-logs"; then
    pass "--logs option exists for cleanup command"
else
    fail "cleanup command should have --logs option"
fi

#------------------------------------------------------------------------------
# Test 7: Cleanup command has --all option
#------------------------------------------------------------------------------
echo "Test 7: Cleanup command has --all option"

if grep -A15 "command('cleanup')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-all"; then
    pass "--all option exists for cleanup command"
else
    fail "cleanup command should have --all option"
fi

#------------------------------------------------------------------------------
# Test 8: Cleanup command has --dry-run option
#------------------------------------------------------------------------------
echo "Test 8: Cleanup command has --dry-run option"

if grep -A15 "command('cleanup')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-dry-run"; then
    pass "--dry-run option exists for cleanup command"
else
    fail "cleanup command should have --dry-run option"
fi

#------------------------------------------------------------------------------
# Test 9: Cleanup command has --yes option
#------------------------------------------------------------------------------
echo "Test 9: Cleanup command has --yes option"

if grep -A15 "command('cleanup')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-yes"; then
    pass "--yes option exists for cleanup command"
else
    fail "cleanup command should have --yes option"
fi

#------------------------------------------------------------------------------
# Test 10: Cleanup command has --days option
#------------------------------------------------------------------------------
echo "Test 10: Cleanup command has --days option"

if grep -A15 "command('cleanup')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-days"; then
    pass "--days option exists for cleanup command"
else
    fail "cleanup command should have --days option"
fi

#------------------------------------------------------------------------------
# Test 11: Cleanup command has --json option
#------------------------------------------------------------------------------
echo "Test 11: Cleanup command has --json option"

if grep -A15 "command('cleanup')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-json"; then
    pass "--json option exists for cleanup command"
else
    fail "cleanup command should have --json option"
fi

#------------------------------------------------------------------------------
# Test 12: Cleanup command has --config option
#------------------------------------------------------------------------------
echo "Test 12: Cleanup command has --config option"

if grep -A15 "command('cleanup')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-config"; then
    pass "--config option exists for cleanup command"
else
    fail "cleanup command should have --config option"
fi

#------------------------------------------------------------------------------
# Test 13: cleanup.ts exports cleanup function
#------------------------------------------------------------------------------
echo "Test 13: cleanup.ts exports cleanup function"

if grep -q "export async function cleanup" "$PROJECT_ROOT/src/cleanup.ts"; then
    pass "cleanup.ts exports cleanup function"
else
    fail "cleanup.ts should export cleanup function"
fi

#------------------------------------------------------------------------------
# Test 14: cleanup.ts defines CleanupOptions interface
#------------------------------------------------------------------------------
echo "Test 14: cleanup.ts defines CleanupOptions interface"

if grep -q "interface CleanupOptions\|export interface CleanupOptions" "$PROJECT_ROOT/src/cleanup.ts"; then
    pass "cleanup.ts defines CleanupOptions interface"
else
    fail "cleanup.ts should define CleanupOptions interface"
fi

#------------------------------------------------------------------------------
# Test 15: cleanup.ts defines CleanupResult interface
#------------------------------------------------------------------------------
echo "Test 15: cleanup.ts defines CleanupResult interface"

if grep -q "interface CleanupResult" "$PROJECT_ROOT/src/cleanup.ts"; then
    pass "cleanup.ts defines CleanupResult interface"
else
    fail "cleanup.ts should define CleanupResult interface"
fi

#------------------------------------------------------------------------------
# Test 16: cleanup.ts handles orphaned branch detection
#------------------------------------------------------------------------------
echo "Test 16: cleanup.ts handles orphaned branch detection"

if grep -q "getOrphanedBranches\|orphan.*branch\|gh pr list" "$PROJECT_ROOT/src/cleanup.ts"; then
    pass "cleanup.ts handles orphaned branch detection"
else
    fail "cleanup.ts should handle orphaned branch detection"
fi

#------------------------------------------------------------------------------
# Test 17: cleanup.ts deletes local branches with git branch -D
#------------------------------------------------------------------------------
echo "Test 17: cleanup.ts deletes local branches with git branch -D"

if grep -q "git branch -D\|deleteLocalBranch" "$PROJECT_ROOT/src/cleanup.ts"; then
    pass "cleanup.ts deletes local branches with git branch -D"
else
    fail "cleanup.ts should delete local branches with git branch -D"
fi

#------------------------------------------------------------------------------
# Test 18: cleanup.ts deletes remote branches with git push origin --delete
#------------------------------------------------------------------------------
echo "Test 18: cleanup.ts deletes remote branches with git push origin --delete"

if grep -q "git push origin --delete\|deleteRemoteBranch" "$PROJECT_ROOT/src/cleanup.ts"; then
    pass "cleanup.ts deletes remote branches with git push origin --delete"
else
    fail "cleanup.ts should delete remote branches with git push origin --delete"
fi

#------------------------------------------------------------------------------
# Test 19: cleanup.ts handles diagnostic folder cleanup
#------------------------------------------------------------------------------
echo "Test 19: cleanup.ts handles diagnostic folder cleanup"

if grep -q "getOldDiagnostics\|diagnostics.*folder\|deleteDiagnostic" "$PROJECT_ROOT/src/cleanup.ts"; then
    pass "cleanup.ts handles diagnostic folder cleanup"
else
    fail "cleanup.ts should handle diagnostic folder cleanup"
fi

#------------------------------------------------------------------------------
# Test 20: cleanup.ts handles log file cleanup
#------------------------------------------------------------------------------
echo "Test 20: cleanup.ts handles log file cleanup"

if grep -q "getOldLogFiles\|deleteLogFile\|max_log_files" "$PROJECT_ROOT/src/cleanup.ts"; then
    pass "cleanup.ts handles log file cleanup"
else
    fail "cleanup.ts should handle log file cleanup"
fi

#------------------------------------------------------------------------------
# Test 21: cleanup.ts parses branch.prefix from config
#------------------------------------------------------------------------------
echo "Test 21: cleanup.ts parses branch.prefix from config"

if grep -q "branchPrefix\|branch.*prefix\|parseYamlNested.*branch.*prefix" "$PROJECT_ROOT/src/cleanup.ts"; then
    pass "cleanup.ts parses branch.prefix from config"
else
    fail "cleanup.ts should parse branch.prefix from config"
fi

#------------------------------------------------------------------------------
# Test 22: cleanup.ts supports retention days configuration
#------------------------------------------------------------------------------
echo "Test 22: cleanup.ts supports retention days configuration"

if grep -q "retentionDays\|days.*30\|retention.*days" "$PROJECT_ROOT/src/cleanup.ts"; then
    pass "cleanup.ts supports retention days configuration"
else
    fail "cleanup.ts should support retention days configuration"
fi

#------------------------------------------------------------------------------
# Test 23: cleanup.ts shows dry-run preview
#------------------------------------------------------------------------------
echo "Test 23: cleanup.ts shows dry-run preview"

if grep -q "dryRun\|dry.*run\|DRY RUN" "$PROJECT_ROOT/src/cleanup.ts"; then
    pass "cleanup.ts shows dry-run preview"
else
    fail "cleanup.ts should show dry-run preview"
fi

#------------------------------------------------------------------------------
# Test 24: cleanup.ts requires confirmation for destructive operations
#------------------------------------------------------------------------------
echo "Test 24: cleanup.ts requires confirmation for destructive operations"

if grep -q "promptConfirmation\|confirmation\|Continue\?" "$PROJECT_ROOT/src/cleanup.ts"; then
    pass "cleanup.ts requires confirmation for destructive operations"
else
    fail "cleanup.ts should require confirmation for destructive operations"
fi

#------------------------------------------------------------------------------
# Test 25: cleanup.ts skips confirmation with --yes flag
#------------------------------------------------------------------------------
echo "Test 25: cleanup.ts skips confirmation with --yes flag"

if grep -q "skipConfirmation\|options.yes\|--yes" "$PROJECT_ROOT/src/cleanup.ts"; then
    pass "cleanup.ts skips confirmation with --yes flag"
else
    fail "cleanup.ts should skip confirmation with --yes flag"
fi

#------------------------------------------------------------------------------
# Test 26: cleanup.ts displays cleanup summary
#------------------------------------------------------------------------------
echo "Test 26: cleanup.ts displays cleanup summary"

if grep -q "summary\|Summary\|totalDeleted" "$PROJECT_ROOT/src/cleanup.ts"; then
    pass "cleanup.ts displays cleanup summary"
else
    fail "cleanup.ts should display cleanup summary"
fi

#------------------------------------------------------------------------------
# Test 27: cleanup.ts uses colored output
#------------------------------------------------------------------------------
echo "Test 27: cleanup.ts uses colored output"

if grep -q "colors\s*=\|\\\\x1b\[" "$PROJECT_ROOT/src/cleanup.ts"; then
    pass "cleanup.ts uses colored output"
else
    fail "cleanup.ts should use colored output"
fi

#------------------------------------------------------------------------------
# Test 28: cleanup.ts supports JSON output
#------------------------------------------------------------------------------
echo "Test 28: cleanup.ts supports JSON output"

if grep -q "options.json\|JSON.stringify" "$PROJECT_ROOT/src/cleanup.ts"; then
    pass "cleanup.ts supports JSON output"
else
    fail "cleanup.ts should support JSON output"
fi

#------------------------------------------------------------------------------
# Test 29: cleanup.ts handles rmSync for directory deletion
#------------------------------------------------------------------------------
echo "Test 29: cleanup.ts handles rmSync for directory deletion"

if grep -q "rmSync\|recursive.*true\|force.*true" "$PROJECT_ROOT/src/cleanup.ts"; then
    pass "cleanup.ts uses rmSync for directory deletion"
else
    fail "cleanup.ts should use rmSync for directory deletion"
fi

#------------------------------------------------------------------------------
# Test 30: cleanup.ts avoids deleting current branch
#------------------------------------------------------------------------------
echo "Test 30: cleanup.ts avoids deleting current branch"

if grep -q "currentBranch\|rev-parse.*HEAD\|current.*branch" "$PROJECT_ROOT/src/cleanup.ts"; then
    pass "cleanup.ts avoids deleting current branch"
else
    fail "cleanup.ts should avoid deleting current branch"
fi

#------------------------------------------------------------------------------
# Test 31: cleanup.ts shows help when no flags specified
#------------------------------------------------------------------------------
echo "Test 31: cleanup.ts shows help when no flags specified"

if grep -q "cleanBranches.*cleanDiagnostics.*cleanLogs\|nothing.*to.*clean\|Usage:" "$PROJECT_ROOT/src/cleanup.ts"; then
    pass "cleanup.ts shows help when no flags specified"
else
    fail "cleanup.ts should show help when no flags specified"
fi

#------------------------------------------------------------------------------
# Test 32: cleanup.ts has printReport function
#------------------------------------------------------------------------------
echo "Test 32: cleanup.ts has printReport function"

if grep -q "printReport\|CHADGI CLEANUP" "$PROJECT_ROOT/src/cleanup.ts"; then
    pass "cleanup.ts has printReport function"
else
    fail "cleanup.ts should have printReport function"
fi

#------------------------------------------------------------------------------
# Test 33: cleanup.ts handles unlinkSync for file deletion
#------------------------------------------------------------------------------
echo "Test 33: cleanup.ts handles unlinkSync for file deletion"

if grep -q "unlinkSync" "$PROJECT_ROOT/src/cleanup.ts"; then
    pass "cleanup.ts uses unlinkSync for file deletion"
else
    fail "cleanup.ts should use unlinkSync for file deletion"
fi

#------------------------------------------------------------------------------
# Test 34: cleanup.ts parses github.repo from config
#------------------------------------------------------------------------------
echo "Test 34: cleanup.ts parses github.repo from config"

if grep -q "github.*repo\|parseYamlNested.*github.*repo" "$PROJECT_ROOT/src/cleanup.ts"; then
    pass "cleanup.ts parses github.repo from config"
else
    fail "cleanup.ts should parse github.repo from config"
fi

#------------------------------------------------------------------------------
# Test 35: cleanup.ts uses createInterface for readline prompts
#------------------------------------------------------------------------------
echo "Test 35: cleanup.ts uses createInterface for readline prompts"

if grep -q "createInterface\|readline" "$PROJECT_ROOT/src/cleanup.ts"; then
    pass "cleanup.ts uses createInterface for readline prompts"
else
    fail "cleanup.ts should use createInterface for readline prompts"
fi

#------------------------------------------------------------------------------
# Summary
#------------------------------------------------------------------------------
echo ""
echo "=========================================="
echo "  Test Results"
echo "=========================================="
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -gt 0 ]; then
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
else
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
fi

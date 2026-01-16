#!/bin/bash
#
# Tests for Snapshot Command functionality
#
# Run with: bash tests/test-snapshot.sh
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
echo "  Snapshot Command Tests"
echo "=========================================="
echo ""

#------------------------------------------------------------------------------
# Test 1: snapshot.ts file exists
#------------------------------------------------------------------------------
echo "Test 1: snapshot.ts file exists"

if [ -f "$PROJECT_ROOT/src/snapshot.ts" ]; then
    pass "snapshot.ts file exists"
else
    fail "snapshot.ts should exist"
fi

#------------------------------------------------------------------------------
# Test 2: CLI has snapshot command
#------------------------------------------------------------------------------
echo "Test 2: CLI has snapshot command"

if grep -q "command('snapshot')" "$PROJECT_ROOT/src/cli.ts"; then
    pass "snapshot command exists in CLI"
else
    fail "snapshot command should exist in CLI"
fi

#------------------------------------------------------------------------------
# Test 3: CLI imports snapshot functions
#------------------------------------------------------------------------------
echo "Test 3: CLI imports snapshot functions"

if grep -q "import {" "$PROJECT_ROOT/src/cli.ts" | head -1 && \
   grep -q "snapshotSave" "$PROJECT_ROOT/src/cli.ts" && \
   grep -q "snapshotRestore" "$PROJECT_ROOT/src/cli.ts" && \
   grep -q "snapshotList" "$PROJECT_ROOT/src/cli.ts" && \
   grep -q "snapshotDiff" "$PROJECT_ROOT/src/cli.ts" && \
   grep -q "snapshotDelete" "$PROJECT_ROOT/src/cli.ts"; then
    pass "snapshot functions imported in CLI"
else
    fail "snapshot functions should be imported in CLI"
fi

#------------------------------------------------------------------------------
# Test 4: Snapshot save command exists
#------------------------------------------------------------------------------
echo "Test 4: Snapshot save command exists"

if grep -q "command('save" "$PROJECT_ROOT/src/cli.ts"; then
    pass "save subcommand exists"
else
    fail "save subcommand should exist"
fi

#------------------------------------------------------------------------------
# Test 5: Snapshot restore command exists
#------------------------------------------------------------------------------
echo "Test 5: Snapshot restore command exists"

if grep -q "command('restore" "$PROJECT_ROOT/src/cli.ts"; then
    pass "restore subcommand exists"
else
    fail "restore subcommand should exist"
fi

#------------------------------------------------------------------------------
# Test 6: Snapshot list command exists
#------------------------------------------------------------------------------
echo "Test 6: Snapshot list command exists"

if grep -A5 "snapshotCommand" "$PROJECT_ROOT/src/cli.ts" | grep -q "command('list"; then
    pass "list subcommand exists"
else
    fail "list subcommand should exist"
fi

#------------------------------------------------------------------------------
# Test 7: Snapshot diff command exists
#------------------------------------------------------------------------------
echo "Test 7: Snapshot diff command exists"

if grep "snapshotCommand" -A100 "$PROJECT_ROOT/src/cli.ts" | grep -q "command('diff"; then
    pass "diff subcommand exists"
else
    fail "diff subcommand should exist"
fi

#------------------------------------------------------------------------------
# Test 8: Snapshot delete command exists
#------------------------------------------------------------------------------
echo "Test 8: Snapshot delete command exists"

if grep -q "command('delete" "$PROJECT_ROOT/src/cli.ts"; then
    pass "delete subcommand exists"
else
    fail "delete subcommand should exist"
fi

#------------------------------------------------------------------------------
# Test 9: Save command has --description option
#------------------------------------------------------------------------------
echo "Test 9: Save command has --description option"

if grep -A10 "command('save" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-description"; then
    pass "--description option exists for save"
else
    fail "save command should have --description option"
fi

#------------------------------------------------------------------------------
# Test 10: Save command has --alias option
#------------------------------------------------------------------------------
echo "Test 10: Save command has --alias option"

if grep -A10 "command('save" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-alias"; then
    pass "--alias option exists for save"
else
    fail "save command should have --alias option"
fi

#------------------------------------------------------------------------------
# Test 11: Restore command has --force option
#------------------------------------------------------------------------------
echo "Test 11: Restore command has --force option"

if grep -A10 "command('restore" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-force"; then
    pass "--force option exists for restore"
else
    fail "restore command should have --force option"
fi

#------------------------------------------------------------------------------
# Test 12: List command has --json option
#------------------------------------------------------------------------------
echo "Test 12: List command has --json option"

if grep "snapshotCommand" -A100 "$PROJECT_ROOT/src/cli.ts" | grep -B10 "snapshotList" | grep -q "\-\-json"; then
    pass "--json option exists for list"
else
    fail "list command should have --json option"
fi

#------------------------------------------------------------------------------
# Test 13: Diff command has --json option
#------------------------------------------------------------------------------
echo "Test 13: Diff command has --json option"

if grep "snapshotCommand" -A100 "$PROJECT_ROOT/src/cli.ts" | grep -B10 "snapshotDiff" | grep -q "\-\-json"; then
    pass "--json option exists for diff"
else
    fail "diff command should have --json option"
fi

#------------------------------------------------------------------------------
# Test 14: Delete command has --force option
#------------------------------------------------------------------------------
echo "Test 14: Delete command has --force option"

if grep -A10 "command('delete" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-force"; then
    pass "--force option exists for delete"
else
    fail "delete command should have --force option"
fi

#------------------------------------------------------------------------------
# Test 15: snapshot.ts exports snapshotSave function
#------------------------------------------------------------------------------
echo "Test 15: snapshot.ts exports snapshotSave function"

if grep -q "export async function snapshotSave" "$PROJECT_ROOT/src/snapshot.ts"; then
    pass "snapshotSave function is exported"
else
    fail "snapshotSave function should be exported"
fi

#------------------------------------------------------------------------------
# Test 16: snapshot.ts exports snapshotRestore function
#------------------------------------------------------------------------------
echo "Test 16: snapshot.ts exports snapshotRestore function"

if grep -q "export async function snapshotRestore" "$PROJECT_ROOT/src/snapshot.ts"; then
    pass "snapshotRestore function is exported"
else
    fail "snapshotRestore function should be exported"
fi

#------------------------------------------------------------------------------
# Test 17: snapshot.ts exports snapshotList function
#------------------------------------------------------------------------------
echo "Test 17: snapshot.ts exports snapshotList function"

if grep -q "export async function snapshotList" "$PROJECT_ROOT/src/snapshot.ts"; then
    pass "snapshotList function is exported"
else
    fail "snapshotList function should be exported"
fi

#------------------------------------------------------------------------------
# Test 18: snapshot.ts exports snapshotDiff function
#------------------------------------------------------------------------------
echo "Test 18: snapshot.ts exports snapshotDiff function"

if grep -q "export async function snapshotDiff" "$PROJECT_ROOT/src/snapshot.ts"; then
    pass "snapshotDiff function is exported"
else
    fail "snapshotDiff function should be exported"
fi

#------------------------------------------------------------------------------
# Test 19: snapshot.ts exports snapshotDelete function
#------------------------------------------------------------------------------
echo "Test 19: snapshot.ts exports snapshotDelete function"

if grep -q "export async function snapshotDelete" "$PROJECT_ROOT/src/snapshot.ts"; then
    pass "snapshotDelete function is exported"
else
    fail "snapshotDelete function should be exported"
fi

#------------------------------------------------------------------------------
# Test 20: SnapshotMetadata interface exists
#------------------------------------------------------------------------------
echo "Test 20: SnapshotMetadata interface exists"

if grep -q "interface SnapshotMetadata" "$PROJECT_ROOT/src/snapshot.ts"; then
    pass "SnapshotMetadata interface exists"
else
    fail "SnapshotMetadata interface should exist"
fi

#------------------------------------------------------------------------------
# Test 21: SnapshotBundle interface exists
#------------------------------------------------------------------------------
echo "Test 21: SnapshotBundle interface exists"

if grep -q "interface SnapshotBundle" "$PROJECT_ROOT/src/snapshot.ts"; then
    pass "SnapshotBundle interface exists"
else
    fail "SnapshotBundle interface should exist"
fi

#------------------------------------------------------------------------------
# Test 22: Metadata includes createdAt timestamp
#------------------------------------------------------------------------------
echo "Test 22: Metadata includes createdAt timestamp"

if grep -q "createdAt:" "$PROJECT_ROOT/src/snapshot.ts"; then
    pass "createdAt timestamp included in metadata"
else
    fail "createdAt timestamp should be included in metadata"
fi

#------------------------------------------------------------------------------
# Test 23: Metadata includes chadgiVersion
#------------------------------------------------------------------------------
echo "Test 23: Metadata includes chadgiVersion"

if grep -q "chadgiVersion" "$PROJECT_ROOT/src/snapshot.ts"; then
    pass "chadgiVersion included in metadata"
else
    fail "chadgiVersion should be included in metadata"
fi

#------------------------------------------------------------------------------
# Test 24: Metadata includes gitCommit
#------------------------------------------------------------------------------
echo "Test 24: Metadata includes gitCommit"

if grep -q "gitCommit" "$PROJECT_ROOT/src/snapshot.ts"; then
    pass "gitCommit included in metadata"
else
    fail "gitCommit should be included in metadata"
fi

#------------------------------------------------------------------------------
# Test 25: Metadata includes description
#------------------------------------------------------------------------------
echo "Test 25: Metadata includes description"

if grep -q "description\?:" "$PROJECT_ROOT/src/snapshot.ts"; then
    pass "description field exists in metadata"
else
    fail "description field should exist in metadata"
fi

#------------------------------------------------------------------------------
# Test 26: Snapshots stored in .chadgi/snapshots directory
#------------------------------------------------------------------------------
echo "Test 26: Snapshots stored in .chadgi/snapshots directory"

if grep -q "snapshots" "$PROJECT_ROOT/src/snapshot.ts" && grep -q "getSnapshotsDir" "$PROJECT_ROOT/src/snapshot.ts"; then
    pass "Snapshots stored in snapshots directory"
else
    fail "Snapshots should be stored in .chadgi/snapshots directory"
fi

#------------------------------------------------------------------------------
# Test 27: Snapshot bundle includes config
#------------------------------------------------------------------------------
echo "Test 27: Snapshot bundle includes config"

if grep -q "config:" "$PROJECT_ROOT/src/snapshot.ts" | head -1; then
    pass "Snapshot bundle includes config"
else
    fail "Snapshot bundle should include config"
fi

#------------------------------------------------------------------------------
# Test 28: Snapshot bundle includes templates
#------------------------------------------------------------------------------
echo "Test 28: Snapshot bundle includes templates"

if grep -q "templates:" "$PROJECT_ROOT/src/snapshot.ts" | head -1; then
    pass "Snapshot bundle includes templates"
else
    fail "Snapshot bundle should include templates"
fi

#------------------------------------------------------------------------------
# Test 29: getGitCommit function exists
#------------------------------------------------------------------------------
echo "Test 29: getGitCommit function exists"

if grep -q "function getGitCommit" "$PROJECT_ROOT/src/snapshot.ts"; then
    pass "getGitCommit function exists"
else
    fail "getGitCommit function should exist"
fi

#------------------------------------------------------------------------------
# Test 30: getGitBranch function exists
#------------------------------------------------------------------------------
echo "Test 30: getGitBranch function exists"

if grep -q "function getGitBranch" "$PROJECT_ROOT/src/snapshot.ts"; then
    pass "getGitBranch function exists"
else
    fail "getGitBranch function should exist"
fi

#------------------------------------------------------------------------------
# Test 31: deepDiff function for comparing configs
#------------------------------------------------------------------------------
echo "Test 31: deepDiff function for comparing configs"

if grep -q "function deepDiff\|deepDiff(" "$PROJECT_ROOT/src/snapshot.ts"; then
    pass "deepDiff function exists"
else
    fail "deepDiff function should exist for config comparison"
fi

#------------------------------------------------------------------------------
# Test 32: findSnapshot function for lookup by name or alias
#------------------------------------------------------------------------------
echo "Test 32: findSnapshot function for lookup by name or alias"

if grep -q "function findSnapshot\|findSnapshot(" "$PROJECT_ROOT/src/snapshot.ts"; then
    pass "findSnapshot function exists"
else
    fail "findSnapshot function should exist for name/alias lookup"
fi

#------------------------------------------------------------------------------
# Test 33: sanitizeSnapshotName function exists
#------------------------------------------------------------------------------
echo "Test 33: sanitizeSnapshotName function exists"

if grep -q "function sanitizeSnapshotName\|sanitizeSnapshotName(" "$PROJECT_ROOT/src/snapshot.ts"; then
    pass "sanitizeSnapshotName function exists"
else
    fail "sanitizeSnapshotName function should exist"
fi

#------------------------------------------------------------------------------
# Test 34: loadAllSnapshots function exists
#------------------------------------------------------------------------------
echo "Test 34: loadAllSnapshots function exists"

if grep -q "function loadAllSnapshots\|loadAllSnapshots(" "$PROJECT_ROOT/src/snapshot.ts"; then
    pass "loadAllSnapshots function exists"
else
    fail "loadAllSnapshots function should exist"
fi

#------------------------------------------------------------------------------
# Test 35: Color output support
#------------------------------------------------------------------------------
echo "Test 35: Color output support"

if grep -q "colors\s*=\|from './utils/colors.js'" "$PROJECT_ROOT/src/snapshot.ts"; then
    pass "Color output support implemented"
else
    fail "Color output support should be implemented"
fi

#------------------------------------------------------------------------------
# Test 36: File existence check for config
#------------------------------------------------------------------------------
echo "Test 36: File existence check for config"

if grep -q "existsSync.*configPath\|Configuration.*not found" "$PROJECT_ROOT/src/snapshot.ts"; then
    pass "File existence check for config implemented"
else
    fail "File existence check should be implemented"
fi

#------------------------------------------------------------------------------
# Test 37: Snapshot name validation
#------------------------------------------------------------------------------
echo "Test 37: Snapshot name validation"

if grep -q "Snapshot name is required\|name.*required" "$PROJECT_ROOT/src/snapshot.ts"; then
    pass "Snapshot name validation implemented"
else
    fail "Snapshot name validation should be implemented"
fi

#------------------------------------------------------------------------------
# Test 38: Duplicate snapshot check
#------------------------------------------------------------------------------
echo "Test 38: Duplicate snapshot check"

if grep -q "already exists" "$PROJECT_ROOT/src/snapshot.ts"; then
    pass "Duplicate snapshot check implemented"
else
    fail "Duplicate snapshot check should be implemented"
fi

#------------------------------------------------------------------------------
# Test 39: Alias conflict check
#------------------------------------------------------------------------------
echo "Test 39: Alias conflict check"

if grep -q "alias.*already in use\|already in use" "$PROJECT_ROOT/src/snapshot.ts"; then
    pass "Alias conflict check implemented"
else
    fail "Alias conflict check should be implemented"
fi

#------------------------------------------------------------------------------
# Test 40: Confirmation prompt for restore
#------------------------------------------------------------------------------
echo "Test 40: Confirmation prompt for restore"

if grep -q "confirm\|Restore this snapshot" "$PROJECT_ROOT/src/snapshot.ts"; then
    pass "Confirmation prompt for restore implemented"
else
    fail "Confirmation prompt for restore should be implemented"
fi

#------------------------------------------------------------------------------
# Test 41: Confirmation prompt for delete
#------------------------------------------------------------------------------
echo "Test 41: Confirmation prompt for delete"

if grep -q "Delete.*snapshot\|Delete this" "$PROJECT_ROOT/src/snapshot.ts"; then
    pass "Confirmation prompt for delete implemented"
else
    fail "Confirmation prompt for delete should be implemented"
fi

#------------------------------------------------------------------------------
# Test 42: JSON output for list
#------------------------------------------------------------------------------
echo "Test 42: JSON output for list"

if grep -q "options.json" "$PROJECT_ROOT/src/snapshot.ts" && grep -q "JSON.stringify" "$PROJECT_ROOT/src/snapshot.ts"; then
    pass "JSON output for list implemented"
else
    fail "JSON output for list should be implemented"
fi

#------------------------------------------------------------------------------
# Test 43: JSON output for diff
#------------------------------------------------------------------------------
echo "Test 43: JSON output for diff"

if grep -A100 "export async function snapshotDiff" "$PROJECT_ROOT/src/snapshot.ts" | grep -q "options.json"; then
    pass "JSON output for diff implemented"
else
    fail "JSON output for diff should be implemented"
fi

#------------------------------------------------------------------------------
# Test 44: Suggests validate after restore
#------------------------------------------------------------------------------
echo "Test 44: Suggests validate after restore"

if grep -q "chadgi validate" "$PROJECT_ROOT/src/snapshot.ts"; then
    pass "Suggests running validate after restore"
else
    fail "Should suggest running validate after restore"
fi

#------------------------------------------------------------------------------
# Test 45: Options interfaces defined
#------------------------------------------------------------------------------
echo "Test 45: Options interfaces defined"

if grep -q "interface SnapshotSaveOptions" "$PROJECT_ROOT/src/snapshot.ts" && \
   grep -q "interface SnapshotRestoreOptions" "$PROJECT_ROOT/src/snapshot.ts" && \
   grep -q "interface SnapshotListOptions" "$PROJECT_ROOT/src/snapshot.ts" && \
   grep -q "interface SnapshotDiffOptions" "$PROJECT_ROOT/src/snapshot.ts" && \
   grep -q "interface SnapshotDeleteOptions" "$PROJECT_ROOT/src/snapshot.ts"; then
    pass "All options interfaces defined"
else
    fail "All options interfaces should be defined"
fi

#------------------------------------------------------------------------------
# Test 46: Snapshot command has description
#------------------------------------------------------------------------------
echo "Test 46: Snapshot command has description"

if grep -A5 "command('snapshot')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\.description("; then
    pass "snapshot command has description"
else
    fail "snapshot command should have description"
fi

#------------------------------------------------------------------------------
# Test 47: Save subcommand has description
#------------------------------------------------------------------------------
echo "Test 47: Save subcommand has description"

if grep -A5 "command('save" "$PROJECT_ROOT/src/cli.ts" | grep -q "\.description("; then
    pass "save subcommand has description"
else
    fail "save subcommand should have description"
fi

#------------------------------------------------------------------------------
# Test 48: Restore subcommand has description
#------------------------------------------------------------------------------
echo "Test 48: Restore subcommand has description"

if grep -A5 "command('restore" "$PROJECT_ROOT/src/cli.ts" | grep -q "\.description("; then
    pass "restore subcommand has description"
else
    fail "restore subcommand should have description"
fi

#------------------------------------------------------------------------------
# Test 49: List is default subcommand
#------------------------------------------------------------------------------
echo "Test 49: List is default subcommand"

if grep -A10 "snapshotCommand" "$PROJECT_ROOT/src/cli.ts" | grep -q "isDefault.*true"; then
    pass "list is default subcommand"
else
    fail "list should be default subcommand"
fi

#------------------------------------------------------------------------------
# Test 50: DiffResult interface for diff output
#------------------------------------------------------------------------------
echo "Test 50: DiffResult interface for diff output"

if grep -q "interface DiffResult" "$PROJECT_ROOT/src/snapshot.ts"; then
    pass "DiffResult interface exists"
else
    fail "DiffResult interface should exist"
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

#!/bin/bash
#
# Tests for Workspace Command functionality (multi-repo support)
#
# Run with: bash tests/test-workspace.sh
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
    if [ "${QUIET:-0}" = "1" ]; then TESTS_PASSED=$((TESTS_PASSED + 1)); return; fi
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
echo "  Workspace Command Tests"
echo "=========================================="
echo ""

#------------------------------------------------------------------------------
# Test 1: workspace.ts file exists
#------------------------------------------------------------------------------
echo "Test 1: workspace.ts file exists"

if [ -f "$PROJECT_ROOT/src/workspace.ts" ]; then
    pass "workspace.ts file exists"
else
    fail "workspace.ts should exist"
fi

#------------------------------------------------------------------------------
# Test 2: CLI has workspace command
#------------------------------------------------------------------------------
echo "Test 2: CLI has workspace command"

if grep -q "command('workspace')" "$PROJECT_ROOT/src/cli.ts"; then
    pass "workspace command exists in CLI"
else
    fail "workspace command should exist in CLI"
fi

#------------------------------------------------------------------------------
# Test 3: CLI imports workspace functions
#------------------------------------------------------------------------------
echo "Test 3: CLI imports workspace functions"

if grep -q "workspaceInit" "$PROJECT_ROOT/src/cli.ts" && \
   grep -q "workspaceAdd" "$PROJECT_ROOT/src/cli.ts" && \
   grep -q "workspaceRemove" "$PROJECT_ROOT/src/cli.ts" && \
   grep -q "workspaceList" "$PROJECT_ROOT/src/cli.ts"; then
    pass "workspace functions imported in CLI"
else
    fail "workspace functions should be imported in CLI"
fi

#------------------------------------------------------------------------------
# Test 4: Workspace init command exists
#------------------------------------------------------------------------------
echo "Test 4: Workspace init command exists"

if grep -A50 "command('workspace')" "$PROJECT_ROOT/src/cli.ts" | grep -q "command('init')"; then
    pass "workspace init subcommand exists"
else
    fail "workspace init subcommand should exist"
fi

#------------------------------------------------------------------------------
# Test 5: Workspace add command exists
#------------------------------------------------------------------------------
echo "Test 5: Workspace add command exists"

if grep -A100 "command('workspace')" "$PROJECT_ROOT/src/cli.ts" | grep -q "command('add"; then
    pass "workspace add subcommand exists"
else
    fail "workspace add subcommand should exist"
fi

#------------------------------------------------------------------------------
# Test 6: Workspace remove command exists
#------------------------------------------------------------------------------
echo "Test 6: Workspace remove command exists"

if grep -A120 "command('workspace')" "$PROJECT_ROOT/src/cli.ts" | grep -q "command('remove"; then
    pass "workspace remove subcommand exists"
else
    fail "workspace remove subcommand should exist"
fi

#------------------------------------------------------------------------------
# Test 7: Workspace list command exists
#------------------------------------------------------------------------------
echo "Test 7: Workspace list command exists"

if grep -A150 "command('workspace')" "$PROJECT_ROOT/src/cli.ts" | grep -q "command('list"; then
    pass "workspace list subcommand exists"
else
    fail "workspace list subcommand should exist"
fi

#------------------------------------------------------------------------------
# Test 8: Workspace status command exists
#------------------------------------------------------------------------------
echo "Test 8: Workspace status command exists"

if grep -A180 "command('workspace')" "$PROJECT_ROOT/src/cli.ts" | grep -q "command('status')"; then
    pass "workspace status subcommand exists"
else
    fail "workspace status subcommand should exist"
fi

#------------------------------------------------------------------------------
# Test 9: Start command has --workspace option
#------------------------------------------------------------------------------
echo "Test 9: Start command has --workspace option"

if grep -A20 "command('start')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-workspace"; then
    pass "--workspace option exists for start command"
else
    fail "start command should have --workspace option"
fi

#------------------------------------------------------------------------------
# Test 10: Start command has --repo option
#------------------------------------------------------------------------------
echo "Test 10: Start command has --repo option"

if grep -A20 "command('start')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-repo"; then
    pass "--repo option exists for start command"
else
    fail "start command should have --repo option"
fi

#------------------------------------------------------------------------------
# Test 11: workspace.ts exports workspaceInit function
#------------------------------------------------------------------------------
echo "Test 11: workspace.ts exports workspaceInit function"

if grep -q "export async function workspaceInit" "$PROJECT_ROOT/src/workspace.ts"; then
    pass "workspaceInit function is exported"
else
    fail "workspaceInit function should be exported"
fi

#------------------------------------------------------------------------------
# Test 12: workspace.ts exports workspaceAdd function
#------------------------------------------------------------------------------
echo "Test 12: workspace.ts exports workspaceAdd function"

if grep -q "export async function workspaceAdd" "$PROJECT_ROOT/src/workspace.ts"; then
    pass "workspaceAdd function is exported"
else
    fail "workspaceAdd function should be exported"
fi

#------------------------------------------------------------------------------
# Test 13: workspace.ts exports workspaceRemove function
#------------------------------------------------------------------------------
echo "Test 13: workspace.ts exports workspaceRemove function"

if grep -q "export async function workspaceRemove" "$PROJECT_ROOT/src/workspace.ts"; then
    pass "workspaceRemove function is exported"
else
    fail "workspaceRemove function should be exported"
fi

#------------------------------------------------------------------------------
# Test 14: workspace.ts exports workspaceList function
#------------------------------------------------------------------------------
echo "Test 14: workspace.ts exports workspaceList function"

if grep -q "export async function workspaceList" "$PROJECT_ROOT/src/workspace.ts"; then
    pass "workspaceList function is exported"
else
    fail "workspaceList function should be exported"
fi

#------------------------------------------------------------------------------
# Test 15: workspace.ts exports workspaceStatus function
#------------------------------------------------------------------------------
echo "Test 15: workspace.ts exports workspaceStatus function"

if grep -q "export async function workspaceStatus" "$PROJECT_ROOT/src/workspace.ts"; then
    pass "workspaceStatus function is exported"
else
    fail "workspaceStatus function should be exported"
fi

#------------------------------------------------------------------------------
# Test 16: WorkspaceConfig interface exists
#------------------------------------------------------------------------------
echo "Test 16: WorkspaceConfig interface exists"

if grep -q "interface WorkspaceConfig" "$PROJECT_ROOT/src/workspace.ts"; then
    pass "WorkspaceConfig interface exists"
else
    fail "WorkspaceConfig interface should exist"
fi

#------------------------------------------------------------------------------
# Test 17: WorkspaceRepoConfig interface exists
#------------------------------------------------------------------------------
echo "Test 17: WorkspaceRepoConfig interface exists"

if grep -q "interface WorkspaceRepoConfig" "$PROJECT_ROOT/src/workspace.ts"; then
    pass "WorkspaceRepoConfig interface exists"
else
    fail "WorkspaceRepoConfig interface should exist"
fi

#------------------------------------------------------------------------------
# Test 18: WorkspaceConfig has strategy field
#------------------------------------------------------------------------------
echo "Test 18: WorkspaceConfig has strategy field"

if grep -q "strategy:" "$PROJECT_ROOT/src/workspace.ts" && \
   grep -q "round-robin\|priority\|sequential" "$PROJECT_ROOT/src/workspace.ts"; then
    pass "WorkspaceConfig has strategy field with valid options"
else
    fail "WorkspaceConfig should have strategy field"
fi

#------------------------------------------------------------------------------
# Test 19: WorkspaceRepoConfig has path field
#------------------------------------------------------------------------------
echo "Test 19: WorkspaceRepoConfig has path field"

if grep -A10 "interface WorkspaceRepoConfig" "$PROJECT_ROOT/src/workspace.ts" | grep -q "path:"; then
    pass "WorkspaceRepoConfig has path field"
else
    fail "WorkspaceRepoConfig should have path field"
fi

#------------------------------------------------------------------------------
# Test 20: WorkspaceRepoConfig has priority field
#------------------------------------------------------------------------------
echo "Test 20: WorkspaceRepoConfig has priority field"

if grep -A15 "interface WorkspaceRepoConfig" "$PROJECT_ROOT/src/workspace.ts" | grep -q "priority"; then
    pass "WorkspaceRepoConfig has priority field"
else
    fail "WorkspaceRepoConfig should have priority field"
fi

#------------------------------------------------------------------------------
# Test 21: WorkspaceRepoConfig has enabled field
#------------------------------------------------------------------------------
echo "Test 21: WorkspaceRepoConfig has enabled field"

if grep -A15 "interface WorkspaceRepoConfig" "$PROJECT_ROOT/src/workspace.ts" | grep -q "enabled"; then
    pass "WorkspaceRepoConfig has enabled field"
else
    fail "WorkspaceRepoConfig should have enabled field"
fi

#------------------------------------------------------------------------------
# Test 22: loadWorkspaceConfig function exists
#------------------------------------------------------------------------------
echo "Test 22: loadWorkspaceConfig function exists"

if grep -q "function loadWorkspaceConfig\|export function loadWorkspaceConfig" "$PROJECT_ROOT/src/workspace.ts"; then
    pass "loadWorkspaceConfig function exists"
else
    fail "loadWorkspaceConfig function should exist"
fi

#------------------------------------------------------------------------------
# Test 23: saveWorkspaceConfig function exists
#------------------------------------------------------------------------------
echo "Test 23: saveWorkspaceConfig function exists"

if grep -q "function saveWorkspaceConfig\|export function saveWorkspaceConfig" "$PROJECT_ROOT/src/workspace.ts"; then
    pass "saveWorkspaceConfig function exists"
else
    fail "saveWorkspaceConfig function should exist"
fi

#------------------------------------------------------------------------------
# Test 24: validateRepoPath function exists
#------------------------------------------------------------------------------
echo "Test 24: validateRepoPath function exists"

if grep -q "function validateRepoPath\|export function validateRepoPath" "$PROJECT_ROOT/src/workspace.ts"; then
    pass "validateRepoPath function exists"
else
    fail "validateRepoPath function should exist"
fi

#------------------------------------------------------------------------------
# Test 25: Workspace template exists
#------------------------------------------------------------------------------
echo "Test 25: Workspace template exists"

if [ -f "$PROJECT_ROOT/templates/workspace.yaml" ]; then
    pass "workspace.yaml template exists"
else
    fail "workspace.yaml template should exist"
fi

#------------------------------------------------------------------------------
# Test 26: Workspace template has strategy field
#------------------------------------------------------------------------------
echo "Test 26: Workspace template has strategy field"

if grep -q "strategy:" "$PROJECT_ROOT/templates/workspace.yaml"; then
    pass "workspace.yaml template has strategy field"
else
    fail "workspace.yaml template should have strategy field"
fi

#------------------------------------------------------------------------------
# Test 27: Workspace template has repos section
#------------------------------------------------------------------------------
echo "Test 27: Workspace template has repos section"

if grep -q "repos:" "$PROJECT_ROOT/templates/workspace.yaml"; then
    pass "workspace.yaml template has repos section"
else
    fail "workspace.yaml template should have repos section"
fi

#------------------------------------------------------------------------------
# Test 28: Workspace template documents round-robin strategy
#------------------------------------------------------------------------------
echo "Test 28: Workspace template documents round-robin strategy"

if grep -q "round-robin" "$PROJECT_ROOT/templates/workspace.yaml"; then
    pass "workspace.yaml template documents round-robin strategy"
else
    fail "workspace.yaml template should document round-robin strategy"
fi

#------------------------------------------------------------------------------
# Test 29: Workspace template documents priority strategy
#------------------------------------------------------------------------------
echo "Test 29: Workspace template documents priority strategy"

if grep -q "priority" "$PROJECT_ROOT/templates/workspace.yaml"; then
    pass "workspace.yaml template documents priority strategy"
else
    fail "workspace.yaml template should document priority strategy"
fi

#------------------------------------------------------------------------------
# Test 30: Workspace template documents sequential strategy
#------------------------------------------------------------------------------
echo "Test 30: Workspace template documents sequential strategy"

if grep -q "sequential" "$PROJECT_ROOT/templates/workspace.yaml"; then
    pass "workspace.yaml template documents sequential strategy"
else
    fail "workspace.yaml template should document sequential strategy"
fi

#------------------------------------------------------------------------------
# Test 31: start.ts imports workspace functions
#------------------------------------------------------------------------------
echo "Test 31: start.ts imports workspace functions"

if grep -q "import.*workspace\|from.*workspace" "$PROJECT_ROOT/src/start.ts"; then
    pass "start.ts imports workspace functions"
else
    fail "start.ts should import workspace functions"
fi

#------------------------------------------------------------------------------
# Test 32: start.ts has workspace mode handling
#------------------------------------------------------------------------------
echo "Test 32: start.ts has workspace mode handling"

if grep -q "startWorkspace\|options.workspace" "$PROJECT_ROOT/src/start.ts"; then
    pass "start.ts has workspace mode handling"
else
    fail "start.ts should have workspace mode handling"
fi

#------------------------------------------------------------------------------
# Test 33: Workspace init has --force option
#------------------------------------------------------------------------------
echo "Test 33: Workspace init has --force option"

if grep -A100 "command('workspace')" "$PROJECT_ROOT/src/cli.ts" | grep -A15 "command('init')" | grep -q "\-\-force"; then
    pass "--force option exists for workspace init"
else
    fail "workspace init should have --force option"
fi

#------------------------------------------------------------------------------
# Test 34: Workspace init has --name option
#------------------------------------------------------------------------------
echo "Test 34: Workspace init has --name option"

if grep -A100 "command('workspace')" "$PROJECT_ROOT/src/cli.ts" | grep -A20 "command('init')" | grep -q "\-\-name"; then
    pass "--name option exists for workspace init"
else
    fail "workspace init should have --name option"
fi

#------------------------------------------------------------------------------
# Test 35: Workspace add has --priority option
#------------------------------------------------------------------------------
echo "Test 35: Workspace add has --priority option"

if grep -A100 "command('workspace')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-priority"; then
    pass "--priority option exists for workspace add"
else
    fail "workspace add should have --priority option"
fi

#------------------------------------------------------------------------------
# Test 36: Workspace list has --json option
#------------------------------------------------------------------------------
echo "Test 36: Workspace list has --json option"

if grep -A180 "command('workspace')" "$PROJECT_ROOT/src/cli.ts" | grep -A20 "command('list'" | grep -q "\-\-json"; then
    pass "--json option exists for workspace list"
else
    fail "workspace list should have --json option"
fi

#------------------------------------------------------------------------------
# Test 37: Workspace status has --json option
#------------------------------------------------------------------------------
echo "Test 37: Workspace status has --json option"

if grep -A200 "command('workspace')" "$PROJECT_ROOT/src/cli.ts" | grep -A20 "command('status')" | grep -q "\-\-json"; then
    pass "--json option exists for workspace status"
else
    fail "workspace status should have --json option"
fi

#------------------------------------------------------------------------------
# Test 38: Workspace status has --limit option
#------------------------------------------------------------------------------
echo "Test 38: Workspace status has --limit option"

if grep -A200 "command('workspace')" "$PROJECT_ROOT/src/cli.ts" | grep -A20 "command('status')" | grep -q "\-\-limit"; then
    pass "--limit option exists for workspace status"
else
    fail "workspace status should have --limit option"
fi

#------------------------------------------------------------------------------
# Test 39: JSON output support in workspaceList
#------------------------------------------------------------------------------
echo "Test 39: JSON output support in workspaceList"

if grep -A50 "async function workspaceList" "$PROJECT_ROOT/src/workspace.ts" | grep -q "options.json\|JSON.stringify"; then
    pass "JSON output support in workspaceList"
else
    fail "workspaceList should support JSON output"
fi

#------------------------------------------------------------------------------
# Test 40: JSON output support in workspaceStatus
#------------------------------------------------------------------------------
echo "Test 40: JSON output support in workspaceStatus"

if grep -A50 "async function workspaceStatus" "$PROJECT_ROOT/src/workspace.ts" | grep -q "options.json\|JSON.stringify"; then
    pass "JSON output support in workspaceStatus"
else
    fail "workspaceStatus should support JSON output"
fi

#------------------------------------------------------------------------------
# Test 41: Combined queue view in workspaceStatus
#------------------------------------------------------------------------------
echo "Test 41: Combined queue view in workspaceStatus"

if grep -q "Combined.*Queue\|allTasks" "$PROJECT_ROOT/src/workspace.ts"; then
    pass "Combined queue view implemented"
else
    fail "workspaceStatus should have combined queue view"
fi

#------------------------------------------------------------------------------
# Test 42: Per-repo config overrides supported
#------------------------------------------------------------------------------
echo "Test 42: Per-repo config overrides supported"

if grep -q "test_command\|build_command\|branch_prefix" "$PROJECT_ROOT/src/workspace.ts"; then
    pass "Per-repo config overrides supported"
else
    fail "Per-repo config overrides should be supported"
fi

#------------------------------------------------------------------------------
# Test 43: Repository validation checks .chadgi directory
#------------------------------------------------------------------------------
echo "Test 43: Repository validation checks .chadgi directory"

if grep -q ".chadgi.*directory\|chadgiDir" "$PROJECT_ROOT/src/workspace.ts"; then
    pass "Repository validation checks .chadgi directory"
else
    fail "Repository validation should check .chadgi directory"
fi

#------------------------------------------------------------------------------
# Test 44: Workspace timestamps are tracked
#------------------------------------------------------------------------------
echo "Test 44: Workspace timestamps are tracked"

if grep -q "created_at\|updated_at" "$PROJECT_ROOT/src/workspace.ts"; then
    pass "Workspace timestamps are tracked"
else
    fail "Workspace timestamps should be tracked"
fi

#------------------------------------------------------------------------------
# Test 45: Workspace supports auto_clone setting
#------------------------------------------------------------------------------
echo "Test 45: Workspace supports auto_clone setting"

if grep -q "auto_clone" "$PROJECT_ROOT/src/workspace.ts"; then
    pass "auto_clone setting supported"
else
    fail "auto_clone setting should be supported"
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

#!/bin/bash
#
# Tests for Queue command functionality
#
# Run with: bash tests/test-queue.sh
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
echo "  Queue Command Tests"
echo "=========================================="
echo ""

#------------------------------------------------------------------------------
# Test 1: queue.ts file exists
#------------------------------------------------------------------------------
echo "Test 1: queue.ts file exists"

if [ -f "$PROJECT_ROOT/src/queue.ts" ]; then
    pass "queue.ts file exists"
else
    fail "queue.ts should exist"
fi

#------------------------------------------------------------------------------
# Test 2: CLI has queue command
#------------------------------------------------------------------------------
echo "Test 2: CLI has queue command"

if grep -q "command('queue')" "$PROJECT_ROOT/src/cli.ts"; then
    pass "queue command exists in CLI"
else
    fail "queue command should exist in CLI"
fi

#------------------------------------------------------------------------------
# Test 3: CLI imports queue module
#------------------------------------------------------------------------------
echo "Test 3: CLI imports queue module"

# Accept either direct import or middleware import pattern
if grep -q "import { queue, queueSkip, queuePromote }" "$PROJECT_ROOT/src/cli.ts" || \
   grep -q "import { queueMiddleware }" "$PROJECT_ROOT/src/cli.ts"; then
    pass "queue module imported in CLI"
else
    fail "queue module should be imported in CLI"
fi

#------------------------------------------------------------------------------
# Test 4: queue command has list subcommand
#------------------------------------------------------------------------------
echo "Test 4: queue command has list subcommand"

if grep -q "command('list'" "$PROJECT_ROOT/src/cli.ts"; then
    pass "list subcommand exists for queue"
else
    fail "queue should have list subcommand"
fi

#------------------------------------------------------------------------------
# Test 5: queue command has skip subcommand
#------------------------------------------------------------------------------
echo "Test 5: queue command has skip subcommand"

if grep -q "command('skip" "$PROJECT_ROOT/src/cli.ts"; then
    pass "skip subcommand exists for queue"
else
    fail "queue should have skip subcommand"
fi

#------------------------------------------------------------------------------
# Test 6: queue command has promote subcommand
#------------------------------------------------------------------------------
echo "Test 6: queue command has promote subcommand"

if grep -q "command('promote" "$PROJECT_ROOT/src/cli.ts"; then
    pass "promote subcommand exists for queue"
else
    fail "queue should have promote subcommand"
fi

#------------------------------------------------------------------------------
# Test 7: queue command has --json option
#------------------------------------------------------------------------------
echo "Test 7: queue command has --json option"

# Check either inline option definition or centralized addStandardOptions with 'json'
if grep -A5 "command('list'" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-json"; then
    pass "--json option exists for queue list"
elif grep -A5 "command('list'" "$PROJECT_ROOT/src/cli.ts" | grep -q "'json'"; then
    pass "--json option exists via addStandardOptions"
else
    fail "queue list should have --json option"
fi

#------------------------------------------------------------------------------
# Test 8: queue command has --limit option
#------------------------------------------------------------------------------
echo "Test 8: queue command has --limit option"

# Check either inline option definition or centralized addStandardOptions with 'limit'
if grep -A5 "command('list'" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-limit"; then
    pass "--limit option exists for queue list"
elif grep -A5 "command('list'" "$PROJECT_ROOT/src/cli.ts" | grep -q "'limit'"; then
    pass "--limit option exists via addStandardOptions"
else
    fail "queue list should have --limit option"
fi

#------------------------------------------------------------------------------
# Test 9: queue.ts exports queue function
#------------------------------------------------------------------------------
echo "Test 9: queue.ts exports queue function"

if grep -q 'export async function queue' "$PROJECT_ROOT/src/queue.ts"; then
    pass "queue function is exported"
else
    fail "queue function should be exported"
fi

#------------------------------------------------------------------------------
# Test 10: queue.ts exports queueSkip function
#------------------------------------------------------------------------------
echo "Test 10: queue.ts exports queueSkip function"

if grep -q 'export async function queueSkip' "$PROJECT_ROOT/src/queue.ts"; then
    pass "queueSkip function is exported"
else
    fail "queueSkip function should be exported"
fi

#------------------------------------------------------------------------------
# Test 11: queue.ts exports queuePromote function
#------------------------------------------------------------------------------
echo "Test 11: queue.ts exports queuePromote function"

if grep -q 'export async function queuePromote' "$PROJECT_ROOT/src/queue.ts"; then
    pass "queuePromote function is exported"
else
    fail "queuePromote function should be exported"
fi

#------------------------------------------------------------------------------
# Test 12: queue.ts handles JSON output
#------------------------------------------------------------------------------
echo "Test 12: queue.ts handles JSON output"

if grep -q 'options.json' "$PROJECT_ROOT/src/queue.ts"; then
    pass "JSON output is handled"
else
    fail "queue should handle JSON output"
fi

#------------------------------------------------------------------------------
# Test 13: queue.ts handles limit option
#------------------------------------------------------------------------------
echo "Test 13: queue.ts handles limit option"

if grep -q 'options.limit' "$PROJECT_ROOT/src/queue.ts"; then
    pass "Limit option is handled"
else
    fail "queue should handle limit option"
fi

#------------------------------------------------------------------------------
# Test 14: queue.ts uses gh project item-list
#------------------------------------------------------------------------------
echo "Test 14: queue.ts uses gh project item-list"

if grep -q 'gh project item-list' "$PROJECT_ROOT/src/queue.ts"; then
    pass "Uses gh project item-list command"
else
    fail "queue should use gh project item-list"
fi

#------------------------------------------------------------------------------
# Test 15: queue.ts has QueueTask interface
#------------------------------------------------------------------------------
echo "Test 15: queue.ts has QueueTask interface"

if grep -q 'interface QueueTask' "$PROJECT_ROOT/src/queue.ts"; then
    pass "QueueTask interface exists"
else
    fail "queue should have QueueTask interface"
fi

#------------------------------------------------------------------------------
# Test 16: queue.ts has QueueResult interface
#------------------------------------------------------------------------------
echo "Test 16: queue.ts has QueueResult interface"

if grep -q 'interface QueueResult' "$PROJECT_ROOT/src/queue.ts"; then
    pass "QueueResult interface exists"
else
    fail "queue should have QueueResult interface"
fi

#------------------------------------------------------------------------------
# Test 17: queue.ts has ActionResult interface
#------------------------------------------------------------------------------
echo "Test 17: queue.ts has ActionResult interface"

if grep -q 'interface ActionResult' "$PROJECT_ROOT/src/queue.ts"; then
    pass "ActionResult interface exists"
else
    fail "queue should have ActionResult interface"
fi

#------------------------------------------------------------------------------
# Test 18: queue.ts parses config for GitHub settings
#------------------------------------------------------------------------------
echo "Test 18: queue.ts parses config for GitHub settings"

if grep -q 'parseYamlNested' "$PROJECT_ROOT/src/queue.ts"; then
    pass "Config parsing is implemented"
else
    fail "queue should parse config for GitHub settings"
fi

#------------------------------------------------------------------------------
# Test 19: queue.ts checks dependencies
#------------------------------------------------------------------------------
echo "Test 19: queue.ts checks dependencies"

if grep -q 'dependencyStatus' "$PROJECT_ROOT/src/queue.ts"; then
    pass "Dependency status is checked"
else
    fail "queue should check dependency status"
fi

#------------------------------------------------------------------------------
# Test 20: queue.ts parses dependency patterns
#------------------------------------------------------------------------------
echo "Test 20: queue.ts parses dependency patterns"

if grep -q 'parseDependencyPatterns\|parseDependencies' "$PROJECT_ROOT/src/queue.ts"; then
    pass "Dependency patterns are parsed"
else
    fail "queue should parse dependency patterns"
fi

#------------------------------------------------------------------------------
# Test 21: queue.ts determines task category from labels
#------------------------------------------------------------------------------
echo "Test 21: queue.ts determines task category from labels"

if grep -q 'getCategoryFromLabels' "$PROJECT_ROOT/src/queue.ts"; then
    pass "Category detection from labels exists"
else
    fail "queue should detect category from labels"
fi

#------------------------------------------------------------------------------
# Test 22: queue.ts determines task priority from labels
#------------------------------------------------------------------------------
echo "Test 22: queue.ts determines task priority from labels"

if grep -q 'getPriorityFromLabels' "$PROJECT_ROOT/src/queue.ts"; then
    pass "Priority detection from labels exists"
else
    fail "queue should detect priority from labels"
fi

#------------------------------------------------------------------------------
# Test 23: queue.ts sorts tasks by priority
#------------------------------------------------------------------------------
echo "Test 23: queue.ts sorts tasks by priority"

if grep -q 'tasks.sort' "$PROJECT_ROOT/src/queue.ts"; then
    pass "Tasks are sorted by priority"
else
    fail "queue should sort tasks by priority"
fi

#------------------------------------------------------------------------------
# Test 24: queue.ts moves items between columns
#------------------------------------------------------------------------------
echo "Test 24: queue.ts moves items between columns"

if grep -q 'moveItemToColumn' "$PROJECT_ROOT/src/queue.ts"; then
    pass "Moving items between columns is supported"
else
    fail "queue should support moving items between columns"
fi

#------------------------------------------------------------------------------
# Test 25: queue.ts uses gh project item-edit for skip
#------------------------------------------------------------------------------
echo "Test 25: queue.ts uses gh project item-edit for skip"

if grep -q 'gh project item-edit' "$PROJECT_ROOT/src/queue.ts"; then
    pass "Uses gh project item-edit command"
else
    fail "queue skip should use gh project item-edit"
fi

#------------------------------------------------------------------------------
# Test 26: queue.ts uses gh issue edit for promote
#------------------------------------------------------------------------------
echo "Test 26: queue.ts uses gh issue edit for promote"

if grep -q 'gh issue edit' "$PROJECT_ROOT/src/queue.ts"; then
    pass "Uses gh issue edit command for promote"
else
    fail "queue promote should use gh issue edit"
fi

#------------------------------------------------------------------------------
# Test 27: queue.ts fetches issue labels
#------------------------------------------------------------------------------
echo "Test 27: queue.ts fetches issue labels"

if grep -q 'getIssueLabels' "$PROJECT_ROOT/src/queue.ts"; then
    pass "Issue labels are fetched"
else
    fail "queue should fetch issue labels"
fi

#------------------------------------------------------------------------------
# Test 28: queue.ts fetches issue body for dependencies
#------------------------------------------------------------------------------
echo "Test 28: queue.ts fetches issue body for dependencies"

if grep -q 'getIssueBody' "$PROJECT_ROOT/src/queue.ts"; then
    pass "Issue body is fetched for dependencies"
else
    fail "queue should fetch issue body for dependencies"
fi

#------------------------------------------------------------------------------
# Test 29: queue.ts checks if issue is completed
#------------------------------------------------------------------------------
echo "Test 29: queue.ts checks if issue is completed"

if grep -q 'isIssueCompleted' "$PROJECT_ROOT/src/queue.ts"; then
    pass "Issue completion check exists"
else
    fail "queue should check if issues are completed"
fi

#------------------------------------------------------------------------------
# Test 30: queue.ts prints formatted queue
#------------------------------------------------------------------------------
echo "Test 30: queue.ts prints formatted queue"

if grep -q 'printQueue' "$PROJECT_ROOT/src/queue.ts"; then
    pass "Formatted queue printing exists"
else
    fail "queue should print formatted queue"
fi

#------------------------------------------------------------------------------
# Test 31: queue.ts shows task number in output
#------------------------------------------------------------------------------
echo "Test 31: queue.ts shows task number in output"

if grep -q 'task.number' "$PROJECT_ROOT/src/queue.ts"; then
    pass "Task number is shown"
else
    fail "queue should show task number"
fi

#------------------------------------------------------------------------------
# Test 32: queue.ts shows task title in output
#------------------------------------------------------------------------------
echo "Test 32: queue.ts shows task title in output"

if grep -q 'task.title' "$PROJECT_ROOT/src/queue.ts"; then
    pass "Task title is shown"
else
    fail "queue should show task title"
fi

#------------------------------------------------------------------------------
# Test 33: queue.ts shows task category in output
#------------------------------------------------------------------------------
echo "Test 33: queue.ts shows task category in output"

if grep -q 'task.category' "$PROJECT_ROOT/src/queue.ts"; then
    pass "Task category is shown"
else
    fail "queue should show task category"
fi

#------------------------------------------------------------------------------
# Test 34: queue.ts shows blocking issues
#------------------------------------------------------------------------------
echo "Test 34: queue.ts shows blocking issues"

if grep -q 'blockingIssues' "$PROJECT_ROOT/src/queue.ts"; then
    pass "Blocking issues are shown"
else
    fail "queue should show blocking issues"
fi

#------------------------------------------------------------------------------
# Test 35: queue.ts gets project board metadata
#------------------------------------------------------------------------------
echo "Test 35: queue.ts gets project board metadata"

if grep -q 'getProjectBoardMetadata' "$PROJECT_ROOT/src/queue.ts"; then
    pass "Project board metadata function exists"
else
    fail "queue should get project board metadata"
fi

#------------------------------------------------------------------------------
# Test 36: queue.ts has color constants
#------------------------------------------------------------------------------
echo "Test 36: queue.ts has color constants"

if grep -q "colors = {\|from './utils/colors.js'" "$PROJECT_ROOT/src/queue.ts"; then
    pass "Color constants exist"
else
    fail "queue should have color constants for output"
fi

#------------------------------------------------------------------------------
# Test 37: queue skip validates issue exists in ready column
#------------------------------------------------------------------------------
echo "Test 37: queue skip validates issue exists in ready column"

if grep -q 'not found in.*column' "$PROJECT_ROOT/src/queue.ts"; then
    pass "Skip validates issue exists in ready column"
else
    fail "queue skip should validate issue exists"
fi

#------------------------------------------------------------------------------
# Test 38: queue promote uses priority labels
#------------------------------------------------------------------------------
echo "Test 38: queue promote uses priority labels"

if grep -q 'criticalLabels\|priority:critical' "$PROJECT_ROOT/src/queue.ts"; then
    pass "Promote uses priority labels"
else
    fail "queue promote should use priority labels"
fi

#------------------------------------------------------------------------------
# Test 39: queue.ts parses category mappings from config
#------------------------------------------------------------------------------
echo "Test 39: queue.ts parses category mappings from config"

if grep -q 'parseCategoryMappings' "$PROJECT_ROOT/src/queue.ts"; then
    pass "Category mappings parser exists"
else
    fail "queue should parse category mappings from config"
fi

#------------------------------------------------------------------------------
# Test 40: queue.ts parses priority labels from config
#------------------------------------------------------------------------------
echo "Test 40: queue.ts parses priority labels from config"

if grep -q 'parsePriorityLabels' "$PROJECT_ROOT/src/queue.ts"; then
    pass "Priority labels parser exists"
else
    fail "queue should parse priority labels from config"
fi

#------------------------------------------------------------------------------
# Test 41: skip subcommand has --json option
#------------------------------------------------------------------------------
echo "Test 41: skip subcommand has --json option"

if grep -A5 "command('skip" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-json"; then
    pass "--json option exists for skip subcommand"
else
    fail "skip subcommand should have --json option"
fi

#------------------------------------------------------------------------------
# Test 42: promote subcommand has --json option
#------------------------------------------------------------------------------
echo "Test 42: promote subcommand has --json option"

if grep -A5 "command('promote" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-json"; then
    pass "--json option exists for promote subcommand"
else
    fail "promote subcommand should have --json option"
fi

#------------------------------------------------------------------------------
# Test 43: queue list is default subcommand
#------------------------------------------------------------------------------
echo "Test 43: queue list is default subcommand"

if grep -q "isDefault: true" "$PROJECT_ROOT/src/cli.ts"; then
    pass "List is default subcommand"
else
    fail "list should be the default subcommand"
fi

#------------------------------------------------------------------------------
# Test 44: queue.ts handles priority enabled check
#------------------------------------------------------------------------------
echo "Test 44: queue.ts handles priority enabled check"

if grep -q 'priorityEnabled' "$PROJECT_ROOT/src/queue.ts"; then
    pass "Priority enabled check exists"
else
    fail "queue should check if priority is enabled"
fi

#------------------------------------------------------------------------------
# Test 45: queue.ts handles dependencies enabled check
#------------------------------------------------------------------------------
echo "Test 45: queue.ts handles dependencies enabled check"

if grep -q 'dependenciesEnabled' "$PROJECT_ROOT/src/queue.ts"; then
    pass "Dependencies enabled check exists"
else
    fail "queue should check if dependencies are enabled"
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

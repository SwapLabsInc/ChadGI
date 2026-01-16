#!/bin/bash
#
# Tests for Task History functionality
#
# Run with: bash tests/test-history.sh
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
echo "  Task History Tests"
echo "=========================================="
echo ""

#------------------------------------------------------------------------------
# Test 1: history.ts file exists
#------------------------------------------------------------------------------
echo "Test 1: history.ts file exists"

if [ -f "$PROJECT_ROOT/src/history.ts" ]; then
    pass "history.ts file exists"
else
    fail "history.ts should exist"
fi

#------------------------------------------------------------------------------
# Test 2: CLI has history command
#------------------------------------------------------------------------------
echo "Test 2: CLI has history command"

if grep -q "command('history')" "$PROJECT_ROOT/src/cli.ts"; then
    pass "history command exists in CLI"
else
    fail "history command should exist in CLI"
fi

#------------------------------------------------------------------------------
# Test 3: CLI imports history module
#------------------------------------------------------------------------------
echo "Test 3: CLI imports history module"

# Accept either direct import or middleware import pattern
if grep -q "import { history }" "$PROJECT_ROOT/src/cli.ts" || \
   grep -q "import { historyMiddleware }" "$PROJECT_ROOT/src/cli.ts"; then
    pass "history module imported in CLI"
else
    fail "history module should be imported in CLI"
fi

#------------------------------------------------------------------------------
# Test 4: history command has --limit option
#------------------------------------------------------------------------------
echo "Test 4: history command has --limit option"

if grep -A10 "command('history')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-limit"; then
    pass "--limit option exists for history command"
else
    fail "history command should have --limit option"
fi

#------------------------------------------------------------------------------
# Test 5: history command has --since option
#------------------------------------------------------------------------------
echo "Test 5: history command has --since option"

if grep -A10 "command('history')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-since"; then
    pass "--since option exists for history command"
else
    fail "history command should have --since option"
fi

#------------------------------------------------------------------------------
# Test 6: history command has --status option
#------------------------------------------------------------------------------
echo "Test 6: history command has --status option"

if grep -A10 "command('history')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-status"; then
    pass "--status option exists for history command"
else
    fail "history command should have --status option"
fi

#------------------------------------------------------------------------------
# Test 7: history command has --json option
#------------------------------------------------------------------------------
echo "Test 7: history command has --json option"

if grep -A10 "command('history')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-json"; then
    pass "--json option exists for history command"
else
    fail "history command should have --json option"
fi

#------------------------------------------------------------------------------
# Test 8: history.ts imports HistoryEntry from types
#------------------------------------------------------------------------------
echo "Test 8: history.ts imports HistoryEntry from types"

if grep -q "import type.*HistoryEntry" "$PROJECT_ROOT/src/history.ts" || grep -q "interface HistoryEntry" "$PROJECT_ROOT/src/types/index.ts"; then
    pass "HistoryEntry interface available"
else
    fail "HistoryEntry interface should be defined or imported"
fi

#------------------------------------------------------------------------------
# Test 9: HistoryEntry includes issueNumber
#------------------------------------------------------------------------------
echo "Test 9: HistoryEntry includes issueNumber"

if grep -A20 "interface HistoryEntry" "$PROJECT_ROOT/src/types/index.ts" | grep -q "issueNumber"; then
    pass "HistoryEntry includes issueNumber"
else
    fail "HistoryEntry should include issueNumber"
fi

#------------------------------------------------------------------------------
# Test 10: HistoryEntry includes outcome
#------------------------------------------------------------------------------
echo "Test 10: HistoryEntry includes outcome"

if grep -A20 "interface HistoryEntry" "$PROJECT_ROOT/src/types/index.ts" | grep -q "outcome"; then
    pass "HistoryEntry includes outcome"
else
    fail "HistoryEntry should include outcome"
fi

#------------------------------------------------------------------------------
# Test 11: HistoryEntry includes elapsedTime
#------------------------------------------------------------------------------
echo "Test 11: HistoryEntry includes elapsedTime"

if grep -A20 "interface HistoryEntry" "$PROJECT_ROOT/src/types/index.ts" | grep -q "elapsedTime"; then
    pass "HistoryEntry includes elapsedTime"
else
    fail "HistoryEntry should include elapsedTime"
fi

#------------------------------------------------------------------------------
# Test 12: HistoryEntry includes cost
#------------------------------------------------------------------------------
echo "Test 12: HistoryEntry includes cost"

if grep -A20 "interface HistoryEntry" "$PROJECT_ROOT/src/types/index.ts" | grep -q "cost"; then
    pass "HistoryEntry includes cost"
else
    fail "HistoryEntry should include cost"
fi

#------------------------------------------------------------------------------
# Test 13: HistoryEntry includes prUrl
#------------------------------------------------------------------------------
echo "Test 13: HistoryEntry includes prUrl"

if grep -A20 "interface HistoryEntry" "$PROJECT_ROOT/src/types/index.ts" | grep -q "prUrl"; then
    pass "HistoryEntry includes prUrl"
else
    fail "HistoryEntry should include prUrl"
fi

#------------------------------------------------------------------------------
# Test 14: history.ts uses parseSince function from utils
#------------------------------------------------------------------------------
echo "Test 14: history.ts uses parseSince function"

if grep -q "parseSince" "$PROJECT_ROOT/src/history.ts"; then
    pass "parseSince function is used"
else
    fail "parseSince function should be used for date parsing"
fi

#------------------------------------------------------------------------------
# Test 15: parseSince supports relative dates (e.g., 7d) in utils
#------------------------------------------------------------------------------
echo "Test 15: parseSince supports relative dates"

if grep -A20 "function parseSince" "$PROJECT_ROOT/src/utils/formatting.ts" | grep -q "relativeMatch"; then
    pass "parseSince supports relative date format"
else
    fail "parseSince should support relative date format (e.g., 7d)"
fi

#------------------------------------------------------------------------------
# Test 16: parseSince supports ISO dates (e.g., 2024-01-01) in utils
#------------------------------------------------------------------------------
echo "Test 16: parseSince supports ISO dates"

if grep -A30 "function parseSince" "$PROJECT_ROOT/src/utils/formatting.ts" | grep -q "dateMatch"; then
    pass "parseSince supports ISO date format"
else
    fail "parseSince should support ISO date format (e.g., 2024-01-01)"
fi

#------------------------------------------------------------------------------
# Test 17: history.ts uses loadSessionStats from utils
#------------------------------------------------------------------------------
echo "Test 17: history.ts uses loadSessionStats from utils"

if grep -q "loadSessionStats" "$PROJECT_ROOT/src/history.ts"; then
    pass "Uses loadSessionStats from utils"
else
    fail "Should use loadSessionStats from utils"
fi

#------------------------------------------------------------------------------
# Test 18: history.ts uses loadTaskMetrics from utils
#------------------------------------------------------------------------------
echo "Test 18: history.ts uses loadTaskMetrics from utils"

if grep -q "loadTaskMetrics" "$PROJECT_ROOT/src/history.ts"; then
    pass "Uses loadTaskMetrics from utils"
else
    fail "Should use loadTaskMetrics from utils"
fi

#------------------------------------------------------------------------------
# Test 19: history.ts has applyFilters function
#------------------------------------------------------------------------------
echo "Test 19: history.ts has applyFilters function"

if grep -q "function applyFilters" "$PROJECT_ROOT/src/history.ts"; then
    pass "applyFilters function exists"
else
    fail "applyFilters function should exist"
fi

#------------------------------------------------------------------------------
# Test 20: history.ts has buildHistoryEntries function
#------------------------------------------------------------------------------
echo "Test 20: history.ts has buildHistoryEntries function"

if grep -q "function buildHistoryEntries" "$PROJECT_ROOT/src/history.ts"; then
    pass "buildHistoryEntries function exists"
else
    fail "buildHistoryEntries function should exist"
fi

#------------------------------------------------------------------------------
# Test 21: history.ts exports history function
#------------------------------------------------------------------------------
echo "Test 21: history.ts exports history function"

if grep -q "export async function history" "$PROJECT_ROOT/src/history.ts"; then
    pass "history function is exported"
else
    fail "history function should be exported"
fi

#------------------------------------------------------------------------------
# Test 22: history command supports filtering by success status
#------------------------------------------------------------------------------
echo "Test 22: history supports filtering by success status"

if grep -q "statusFilter === 'success'" "$PROJECT_ROOT/src/history.ts"; then
    pass "Supports success status filter"
else
    fail "Should support filtering by success status"
fi

#------------------------------------------------------------------------------
# Test 23: history command supports filtering by failed status
#------------------------------------------------------------------------------
echo "Test 23: history supports filtering by failed status"

if grep -q "statusFilter === 'failed'" "$PROJECT_ROOT/src/history.ts"; then
    pass "Supports failed status filter"
else
    fail "Should support filtering by failed status"
fi

#------------------------------------------------------------------------------
# Test 24: history.ts has printHistory function
#------------------------------------------------------------------------------
echo "Test 24: history.ts has printHistory function"

if grep -q "function printHistory" "$PROJECT_ROOT/src/history.ts"; then
    pass "printHistory function exists"
else
    fail "printHistory function should exist"
fi

#------------------------------------------------------------------------------
# Test 25: history command has --config option
#------------------------------------------------------------------------------
echo "Test 25: history command has --config option"

if grep -A10 "command('history')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-config"; then
    pass "--config option exists for history command"
else
    fail "history command should have --config option"
fi

#------------------------------------------------------------------------------
# Test 26: Default limit is 10
#------------------------------------------------------------------------------
echo "Test 26: Default limit is 10"

if grep -q "defaultLimit = 10" "$PROJECT_ROOT/src/history.ts"; then
    pass "Default limit is 10"
else
    fail "Default limit should be 10"
fi

#------------------------------------------------------------------------------
# Test 27: HistoryResult interface exists in types
#------------------------------------------------------------------------------
echo "Test 27: HistoryResult interface exists for JSON output"

if grep -q "interface HistoryResult" "$PROJECT_ROOT/src/types/index.ts"; then
    pass "HistoryResult interface exists"
else
    fail "HistoryResult interface should exist for JSON output"
fi

#------------------------------------------------------------------------------
# Test 28: types/index.ts handles outcome types
#------------------------------------------------------------------------------
echo "Test 28: types/index.ts handles outcome types (success/skipped/failed)"

if grep -q "'success' | 'skipped' | 'failed'" "$PROJECT_ROOT/src/types/index.ts"; then
    pass "Handles outcome types"
else
    fail "Should handle outcome types (success/skipped/failed)"
fi

#------------------------------------------------------------------------------
# Test 29: history.ts uses fetchPrUrl from utils
#------------------------------------------------------------------------------
echo "Test 29: history.ts uses fetchPrUrl from utils"

if grep -q "fetchPrUrl" "$PROJECT_ROOT/src/history.ts"; then
    pass "fetchPrUrl function is used"
else
    fail "fetchPrUrl function should be used to get PR links"
fi

#------------------------------------------------------------------------------
# Test 30: history command description is set
#------------------------------------------------------------------------------
echo "Test 30: history command description is set"

if grep -A2 "command('history')" "$PROJECT_ROOT/src/cli.ts" | grep -q "description"; then
    pass "history command has description"
else
    fail "history command should have a description"
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

#!/bin/bash
#
# Tests for Session Statistics functionality
#
# Run with: bash tests/test-session-stats.sh
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
echo "  Session Statistics Tests"
echo "=========================================="
echo ""

#------------------------------------------------------------------------------
# Test 1: Session tracking variables exist
#------------------------------------------------------------------------------
echo "Test 1: Session tracking variables are initialized"

if grep -q 'SESSION_START_EPOCH=$(date +%s)' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "SESSION_START_EPOCH variable exists"
else
    fail "SESSION_START_EPOCH should be initialized"
fi

#------------------------------------------------------------------------------
# Test 2: ISSUES_ATTEMPTED counter exists
#------------------------------------------------------------------------------
echo "Test 2: ISSUES_ATTEMPTED counter exists"

if grep -q 'ISSUES_ATTEMPTED=0' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "ISSUES_ATTEMPTED counter initialized"
else
    fail "ISSUES_ATTEMPTED counter should be initialized to 0"
fi

#------------------------------------------------------------------------------
# Test 3: GIGACHAD_MERGES counter exists
#------------------------------------------------------------------------------
echo "Test 3: GIGACHAD_MERGES counter exists"

if grep -q 'GIGACHAD_MERGES=0' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "GIGACHAD_MERGES counter initialized"
else
    fail "GIGACHAD_MERGES counter should be initialized to 0"
fi

#------------------------------------------------------------------------------
# Test 4: SUCCESSFUL_TASKS tracking variable exists
#------------------------------------------------------------------------------
echo "Test 4: SUCCESSFUL_TASKS tracking variable exists"

if grep -q 'SUCCESSFUL_TASKS=""' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "SUCCESSFUL_TASKS tracking variable exists"
else
    fail "SUCCESSFUL_TASKS should be initialized"
fi

#------------------------------------------------------------------------------
# Test 5: FAILED_TASKS tracking variable exists
#------------------------------------------------------------------------------
echo "Test 5: FAILED_TASKS tracking variable exists"

if grep -q 'FAILED_TASKS=""' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "FAILED_TASKS tracking variable exists"
else
    fail "FAILED_TASKS should be initialized"
fi

#------------------------------------------------------------------------------
# Test 6: print_session_summary function exists
#------------------------------------------------------------------------------
echo "Test 6: print_session_summary function exists"

if grep -q 'print_session_summary()' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "print_session_summary function exists"
else
    fail "print_session_summary function should exist"
fi

#------------------------------------------------------------------------------
# Test 7: save_session_stats function exists
#------------------------------------------------------------------------------
echo "Test 7: save_session_stats function exists"

if grep -q 'save_session_stats()' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "save_session_stats function exists"
else
    fail "save_session_stats function should exist"
fi

#------------------------------------------------------------------------------
# Test 8: format_duration function exists
#------------------------------------------------------------------------------
echo "Test 8: format_duration function exists"

if grep -q 'format_duration()' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "format_duration function exists"
else
    fail "format_duration function should exist"
fi

#------------------------------------------------------------------------------
# Test 9: ctrl_c calls print_session_summary
#------------------------------------------------------------------------------
echo "Test 9: ctrl_c handler calls print_session_summary"

if grep -A10 "^function ctrl_c()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'print_session_summary'; then
    pass "ctrl_c calls print_session_summary"
else
    fail "ctrl_c should call print_session_summary"
fi

#------------------------------------------------------------------------------
# Test 10: ctrl_c calls save_session_stats
#------------------------------------------------------------------------------
echo "Test 10: ctrl_c handler calls save_session_stats"

if grep -A15 "^function ctrl_c()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'save_session_stats'; then
    pass "ctrl_c calls save_session_stats"
else
    fail "ctrl_c should call save_session_stats"
fi

#------------------------------------------------------------------------------
# Test 11: ISSUES_ATTEMPTED is incremented when task starts
#------------------------------------------------------------------------------
echo "Test 11: ISSUES_ATTEMPTED is incremented when task starts"

if grep -q 'ISSUES_ATTEMPTED=\$((ISSUES_ATTEMPTED + 1))' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "ISSUES_ATTEMPTED is incremented"
else
    fail "ISSUES_ATTEMPTED should be incremented when task starts"
fi

#------------------------------------------------------------------------------
# Test 12: CURRENT_TASK_START_EPOCH is set when task starts
#------------------------------------------------------------------------------
echo "Test 12: CURRENT_TASK_START_EPOCH is set when task starts"

if grep -q 'CURRENT_TASK_START_EPOCH=\$(date +%s)' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "CURRENT_TASK_START_EPOCH is set"
else
    fail "CURRENT_TASK_START_EPOCH should be set when task starts"
fi

#------------------------------------------------------------------------------
# Test 13: Successful tasks are recorded
#------------------------------------------------------------------------------
echo "Test 13: Successful tasks are recorded"

if grep -q 'SUCCESSFUL_TASKS="\${SUCCESSFUL_TASKS}' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Successful tasks are recorded"
else
    fail "Successful tasks should be recorded in SUCCESSFUL_TASKS"
fi

#------------------------------------------------------------------------------
# Test 14: Failed tasks are recorded
#------------------------------------------------------------------------------
echo "Test 14: Failed tasks are recorded"

if grep -q 'FAILED_TASKS="\${FAILED_TASKS}' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Failed tasks are recorded"
else
    fail "Failed tasks should be recorded in FAILED_TASKS"
fi

#------------------------------------------------------------------------------
# Test 15: GIGACHAD_MERGES is incremented
#------------------------------------------------------------------------------
echo "Test 15: GIGACHAD_MERGES is incremented on auto-merge"

if grep -q 'GIGACHAD_MERGES=\$((GIGACHAD_MERGES + 1))' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "GIGACHAD_MERGES is incremented"
else
    fail "GIGACHAD_MERGES should be incremented on auto-merge"
fi

#------------------------------------------------------------------------------
# Test 16: Stats file path uses chadgi-stats.json
#------------------------------------------------------------------------------
echo "Test 16: Stats file uses chadgi-stats.json"

if grep -q 'chadgi-stats.json' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Stats file is chadgi-stats.json"
else
    fail "Stats file should be chadgi-stats.json"
fi

#------------------------------------------------------------------------------
# Test 17: CLI has stats command
#------------------------------------------------------------------------------
echo "Test 17: CLI has stats command"

if grep -q "command('stats')" "$PROJECT_ROOT/src/cli.ts"; then
    pass "stats command exists in CLI"
else
    fail "stats command should exist in CLI"
fi

#------------------------------------------------------------------------------
# Test 18: CLI imports stats module
#------------------------------------------------------------------------------
echo "Test 18: CLI imports stats module"

if grep -q "import { stats }" "$PROJECT_ROOT/src/cli.ts"; then
    pass "stats module imported in CLI"
else
    fail "stats module should be imported in CLI"
fi

#------------------------------------------------------------------------------
# Test 19: stats.ts file exists
#------------------------------------------------------------------------------
echo "Test 19: stats.ts file exists"

if [ -f "$PROJECT_ROOT/src/stats.ts" ]; then
    pass "stats.ts file exists"
else
    fail "stats.ts should exist"
fi

#------------------------------------------------------------------------------
# Test 20: stats command has --last option
#------------------------------------------------------------------------------
echo "Test 20: stats command has --last option"

if grep -q "\-\-last" "$PROJECT_ROOT/src/cli.ts"; then
    pass "--last option exists for stats command"
else
    fail "stats command should have --last option"
fi

#------------------------------------------------------------------------------
# Test 21: stats command has --json option
#------------------------------------------------------------------------------
echo "Test 21: stats command has --json option"

if grep -q "\-\-json" "$PROJECT_ROOT/src/cli.ts"; then
    pass "--json option exists for stats command"
else
    fail "stats command should have --json option"
fi

#------------------------------------------------------------------------------
# Test 22: print_session_summary shows session timing
#------------------------------------------------------------------------------
echo "Test 22: print_session_summary shows session timing"

if grep -A50 "print_session_summary()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q "Session Timing"; then
    pass "Session timing is displayed"
else
    fail "print_session_summary should show session timing"
fi

#------------------------------------------------------------------------------
# Test 23: print_session_summary shows task completion stats
#------------------------------------------------------------------------------
echo "Test 23: print_session_summary shows task completion stats"

if grep -A50 "print_session_summary()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q "Task Completion"; then
    pass "Task completion stats are displayed"
else
    fail "print_session_summary should show task completion stats"
fi

#------------------------------------------------------------------------------
# Test 24: print_session_summary shows API costs
#------------------------------------------------------------------------------
echo "Test 24: print_session_summary shows API costs"

if grep -A80 "print_session_summary()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q "API Costs"; then
    pass "API costs are displayed"
else
    fail "print_session_summary should show API costs"
fi

#------------------------------------------------------------------------------
# Test 25: print_session_summary shows GigaChad mode stats
#------------------------------------------------------------------------------
echo "Test 25: print_session_summary shows GigaChad mode stats"

if grep -A100 "print_session_summary()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q "GigaChad Mode"; then
    pass "GigaChad mode stats are displayed"
else
    fail "print_session_summary should show GigaChad mode stats"
fi

#------------------------------------------------------------------------------
# Test 26: save_session_stats creates JSON structure
#------------------------------------------------------------------------------
echo "Test 26: save_session_stats creates JSON structure"

if grep -A60 "save_session_stats()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q '"session_id"'; then
    pass "save_session_stats creates JSON with session_id"
else
    fail "save_session_stats should create JSON with session_id"
fi

#------------------------------------------------------------------------------
# Test 27: calculate_average function exists
#------------------------------------------------------------------------------
echo "Test 27: calculate_average function exists"

if grep -q 'calculate_average()' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "calculate_average function exists"
else
    fail "calculate_average function should exist"
fi

#------------------------------------------------------------------------------
# Test 28: Exit behavior includes stats display
#------------------------------------------------------------------------------
echo "Test 28: Exit on empty queue includes stats display"

if grep -B2 -A5 '"exit")' "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'print_session_summary'; then
    pass "Exit behavior includes stats display"
else
    fail "Exit on empty queue should display stats"
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

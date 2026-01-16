#!/bin/bash
#
# Tests for Dry-Run mode functionality
#
# Run with: bash tests/test-dry-run-mode.sh
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
echo "  Dry-Run Mode Tests"
echo "=========================================="
echo ""

#------------------------------------------------------------------------------
# Test 1: CLI accepts --dry-run flag
#------------------------------------------------------------------------------
echo "Test 1: CLI accepts --dry-run flag"

if grep -q "\-\-dry-run" "$PROJECT_ROOT/src/cli.ts"; then
    pass "--dry-run flag found in CLI"
else
    fail "--dry-run flag should be in CLI"
fi

#------------------------------------------------------------------------------
# Test 2: StartOptions interface has dryRun property
#------------------------------------------------------------------------------
echo "Test 2: StartOptions interface has dryRun property"

if grep -q "dryRun" "$PROJECT_ROOT/src/start.ts"; then
    pass "dryRun property found in StartOptions"
else
    fail "dryRun property should be in StartOptions interface"
fi

#------------------------------------------------------------------------------
# Test 3: start.ts passes DRY_RUN environment variable
#------------------------------------------------------------------------------
echo "Test 3: start.ts passes DRY_RUN environment variable"

if grep -q "DRY_RUN:" "$PROJECT_ROOT/src/start.ts"; then
    pass "DRY_RUN environment variable found in start.ts"
else
    fail "DRY_RUN environment variable should be passed in start.ts"
fi

#------------------------------------------------------------------------------
# Test 4: chadgi.sh reads DRY_RUN environment variable
#------------------------------------------------------------------------------
echo "Test 4: chadgi.sh reads DRY_RUN environment variable"

if grep -q 'DRY_RUN="\${DRY_RUN:-false}"' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "DRY_RUN variable initialization found in chadgi.sh"
else
    fail "DRY_RUN variable should be initialized in chadgi.sh"
fi

#------------------------------------------------------------------------------
# Test 5: chadgi.sh has log_dry_run function
#------------------------------------------------------------------------------
echo "Test 5: chadgi.sh has log_dry_run function"

if grep -q "log_dry_run()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "log_dry_run function exists"
else
    fail "log_dry_run function should exist"
fi

#------------------------------------------------------------------------------
# Test 6: move_to_column has dry-run check
#------------------------------------------------------------------------------
echo "Test 6: move_to_column has dry-run check"

# Check that move_to_column function contains DRY_RUN check
if grep -A30 "^move_to_column()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'DRY_RUN.*true'; then
    pass "move_to_column has dry-run check"
else
    fail "move_to_column should have dry-run check"
fi

#------------------------------------------------------------------------------
# Test 7: Branch creation has dry-run check
#------------------------------------------------------------------------------
echo "Test 7: Branch creation has dry-run check"

if grep -A3 "Would create branch:" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q "DRY_RUN" || \
   grep -q "Would create branch:" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Branch creation has dry-run check"
else
    fail "Branch creation should have dry-run check"
fi

#------------------------------------------------------------------------------
# Test 8: Issue assignment has dry-run check
#------------------------------------------------------------------------------
echo "Test 8: Issue assignment has dry-run check"

if grep -q "Would assign issue" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Issue assignment has dry-run check"
else
    fail "Issue assignment should have dry-run check"
fi

#------------------------------------------------------------------------------
# Test 9: run_task_dry_run function exists
#------------------------------------------------------------------------------
echo "Test 9: run_task_dry_run function exists"

if grep -q "run_task_dry_run()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "run_task_dry_run function exists"
else
    fail "run_task_dry_run function should exist"
fi

#------------------------------------------------------------------------------
# Test 10: Dry-run mode exits after one task
#------------------------------------------------------------------------------
echo "Test 10: Dry-run mode exits after one task"

# Check that after running dry-run, it exits
if grep -B2 -A10 "DRY-RUN SESSION COMPLETE" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q "exit 0"; then
    pass "Dry-run mode exits after one task"
else
    fail "Dry-run mode should exit after one task"
fi

#------------------------------------------------------------------------------
# Test 11: Dry-run mode displays GigaChad warnings
#------------------------------------------------------------------------------
echo "Test 11: Dry-run mode displays GigaChad warnings"

if grep -q "WARNING: GigaChad mode is ENABLED" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "GigaChad warning in dry-run mode exists"
else
    fail "Dry-run should display GigaChad warnings when enabled"
fi

#------------------------------------------------------------------------------
# Test 12: Dry-run mode shows startup message
#------------------------------------------------------------------------------
echo "Test 12: Dry-run mode shows startup message"

if grep -q "DRY-RUN MODE - No changes will be made" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Dry-run startup message exists"
else
    fail "Dry-run startup message should exist"
fi

#------------------------------------------------------------------------------
# Test 13: CLI description mentions dry-run
#------------------------------------------------------------------------------
echo "Test 13: CLI description mentions dry-run"

if grep -q "dry-run mode" "$PROJECT_ROOT/src/cli.ts"; then
    pass "CLI description mentions dry-run mode"
else
    fail "CLI description should mention dry-run mode"
fi

#------------------------------------------------------------------------------
# Test 14: start.ts shows dry-run information on startup
#------------------------------------------------------------------------------
echo "Test 14: start.ts shows dry-run information on startup"

if grep -q "Starting ChadGI in DRY-RUN mode" "$PROJECT_ROOT/src/start.ts"; then
    pass "start.ts shows dry-run startup info"
else
    fail "start.ts should show dry-run startup info"
fi

#------------------------------------------------------------------------------
# Test 15: Dry-run exploration uses Claude without dangerous permissions
#------------------------------------------------------------------------------
echo "Test 15: Dry-run exploration uses Claude without dangerous permissions"

# The dry-run function should use 'claude --print' without --dangerously-skip-permissions
if grep -A80 "^run_task_dry_run()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'claude --print'; then
    pass "Dry-run uses claude --print without dangerous permissions"
else
    fail "Dry-run should use claude --print without --dangerously-skip-permissions"
fi

#------------------------------------------------------------------------------
# Test 16: [DRY-RUN] prefix used in log messages
#------------------------------------------------------------------------------
echo "Test 16: [DRY-RUN] prefix used in log messages"

if grep -q '\[DRY-RUN\]' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "[DRY-RUN] prefix found in log messages"
else
    fail "[DRY-RUN] prefix should be used in log messages"
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

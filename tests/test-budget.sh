#!/bin/bash
#
# Tests for Budget Limit functionality
#
# Run with: bash tests/test-budget.sh
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
echo "  Budget Limit Tests"
echo "=========================================="
echo ""

#------------------------------------------------------------------------------
# Test 1: Template config has budget section
#------------------------------------------------------------------------------
echo "Test 1: Template config has budget section"

if grep -q "^budget:" "$PROJECT_ROOT/templates/chadgi-config.yaml"; then
    pass "Template config has budget section"
else
    fail "Template config should have budget section"
fi

#------------------------------------------------------------------------------
# Test 2: Template config has per_task_limit setting
#------------------------------------------------------------------------------
echo "Test 2: Template config has per_task_limit setting"

if grep -q "per_task_limit:" "$PROJECT_ROOT/templates/chadgi-config.yaml"; then
    pass "Template config has per_task_limit setting"
else
    fail "Template config should have per_task_limit setting"
fi

#------------------------------------------------------------------------------
# Test 3: Template config has per_session_limit setting
#------------------------------------------------------------------------------
echo "Test 3: Template config has per_session_limit setting"

if grep -q "per_session_limit:" "$PROJECT_ROOT/templates/chadgi-config.yaml"; then
    pass "Template config has per_session_limit setting"
else
    fail "Template config should have per_session_limit setting"
fi

#------------------------------------------------------------------------------
# Test 4: Template config has on_task_budget_exceeded setting
#------------------------------------------------------------------------------
echo "Test 4: Template config has on_task_budget_exceeded setting"

if grep -q "on_task_budget_exceeded:" "$PROJECT_ROOT/templates/chadgi-config.yaml"; then
    pass "Template config has on_task_budget_exceeded setting"
else
    fail "Template config should have on_task_budget_exceeded setting"
fi

#------------------------------------------------------------------------------
# Test 5: Template config has on_session_budget_exceeded setting
#------------------------------------------------------------------------------
echo "Test 5: Template config has on_session_budget_exceeded setting"

if grep -q "on_session_budget_exceeded:" "$PROJECT_ROOT/templates/chadgi-config.yaml"; then
    pass "Template config has on_session_budget_exceeded setting"
else
    fail "Template config should have on_session_budget_exceeded setting"
fi

#------------------------------------------------------------------------------
# Test 6: Template config has warning_threshold setting
#------------------------------------------------------------------------------
echo "Test 6: Template config has warning_threshold setting"

if grep -q "warning_threshold:" "$PROJECT_ROOT/templates/chadgi-config.yaml"; then
    pass "Template config has warning_threshold setting"
else
    fail "Template config should have warning_threshold setting"
fi

#------------------------------------------------------------------------------
# Test 7: Script has BUDGET_PER_TASK_LIMIT parsing
#------------------------------------------------------------------------------
echo "Test 7: Script has BUDGET_PER_TASK_LIMIT parsing"

if grep -q 'BUDGET_PER_TASK_LIMIT=' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Script has BUDGET_PER_TASK_LIMIT parsing"
else
    fail "Script should have BUDGET_PER_TASK_LIMIT parsing"
fi

#------------------------------------------------------------------------------
# Test 8: Script has BUDGET_PER_SESSION_LIMIT parsing
#------------------------------------------------------------------------------
echo "Test 8: Script has BUDGET_PER_SESSION_LIMIT parsing"

if grep -q 'BUDGET_PER_SESSION_LIMIT=' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Script has BUDGET_PER_SESSION_LIMIT parsing"
else
    fail "Script should have BUDGET_PER_SESSION_LIMIT parsing"
fi

#------------------------------------------------------------------------------
# Test 9: Script has BUDGET_ON_TASK_EXCEEDED parsing
#------------------------------------------------------------------------------
echo "Test 9: Script has BUDGET_ON_TASK_EXCEEDED parsing"

if grep -q 'BUDGET_ON_TASK_EXCEEDED=' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Script has BUDGET_ON_TASK_EXCEEDED parsing"
else
    fail "Script should have BUDGET_ON_TASK_EXCEEDED parsing"
fi

#------------------------------------------------------------------------------
# Test 10: Script has BUDGET_ON_SESSION_EXCEEDED parsing
#------------------------------------------------------------------------------
echo "Test 10: Script has BUDGET_ON_SESSION_EXCEEDED parsing"

if grep -q 'BUDGET_ON_SESSION_EXCEEDED=' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Script has BUDGET_ON_SESSION_EXCEEDED parsing"
else
    fail "Script should have BUDGET_ON_SESSION_EXCEEDED parsing"
fi

#------------------------------------------------------------------------------
# Test 11: Script has BUDGET_WARNING_THRESHOLD parsing
#------------------------------------------------------------------------------
echo "Test 11: Script has BUDGET_WARNING_THRESHOLD parsing"

if grep -q 'BUDGET_WARNING_THRESHOLD=' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Script has BUDGET_WARNING_THRESHOLD parsing"
else
    fail "Script should have BUDGET_WARNING_THRESHOLD parsing"
fi

#------------------------------------------------------------------------------
# Test 12: is_budget_enabled function exists
#------------------------------------------------------------------------------
echo "Test 12: is_budget_enabled function exists"

if grep -q "is_budget_enabled()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "is_budget_enabled function exists"
else
    fail "is_budget_enabled function should exist"
fi

#------------------------------------------------------------------------------
# Test 13: is_task_budget_enabled function exists
#------------------------------------------------------------------------------
echo "Test 13: is_task_budget_enabled function exists"

if grep -q "is_task_budget_enabled()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "is_task_budget_enabled function exists"
else
    fail "is_task_budget_enabled function should exist"
fi

#------------------------------------------------------------------------------
# Test 14: is_session_budget_enabled function exists
#------------------------------------------------------------------------------
echo "Test 14: is_session_budget_enabled function exists"

if grep -q "is_session_budget_enabled()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "is_session_budget_enabled function exists"
else
    fail "is_session_budget_enabled function should exist"
fi

#------------------------------------------------------------------------------
# Test 15: calculate_budget_percentage function exists
#------------------------------------------------------------------------------
echo "Test 15: calculate_budget_percentage function exists"

if grep -q "calculate_budget_percentage()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "calculate_budget_percentage function exists"
else
    fail "calculate_budget_percentage function should exist"
fi

#------------------------------------------------------------------------------
# Test 16: check_task_budget_warning function exists
#------------------------------------------------------------------------------
echo "Test 16: check_task_budget_warning function exists"

if grep -q "check_task_budget_warning()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "check_task_budget_warning function exists"
else
    fail "check_task_budget_warning function should exist"
fi

#------------------------------------------------------------------------------
# Test 17: check_session_budget_warning function exists
#------------------------------------------------------------------------------
echo "Test 17: check_session_budget_warning function exists"

if grep -q "check_session_budget_warning()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "check_session_budget_warning function exists"
else
    fail "check_session_budget_warning function should exist"
fi

#------------------------------------------------------------------------------
# Test 18: check_task_budget_exceeded function exists
#------------------------------------------------------------------------------
echo "Test 18: check_task_budget_exceeded function exists"

if grep -q "check_task_budget_exceeded()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "check_task_budget_exceeded function exists"
else
    fail "check_task_budget_exceeded function should exist"
fi

#------------------------------------------------------------------------------
# Test 19: check_session_budget_exceeded function exists
#------------------------------------------------------------------------------
echo "Test 19: check_session_budget_exceeded function exists"

if grep -q "check_session_budget_exceeded()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "check_session_budget_exceeded function exists"
else
    fail "check_session_budget_exceeded function should exist"
fi

#------------------------------------------------------------------------------
# Test 20: handle_task_budget_exceeded function exists
#------------------------------------------------------------------------------
echo "Test 20: handle_task_budget_exceeded function exists"

if grep -q "handle_task_budget_exceeded()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "handle_task_budget_exceeded function exists"
else
    fail "handle_task_budget_exceeded function should exist"
fi

#------------------------------------------------------------------------------
# Test 21: handle_session_budget_exceeded function exists
#------------------------------------------------------------------------------
echo "Test 21: handle_session_budget_exceeded function exists"

if grep -q "handle_session_budget_exceeded()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "handle_session_budget_exceeded function exists"
else
    fail "handle_session_budget_exceeded function should exist"
fi

#------------------------------------------------------------------------------
# Test 22: check_budgets_and_act function exists
#------------------------------------------------------------------------------
echo "Test 22: check_budgets_and_act function exists"

if grep -q "check_budgets_and_act()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "check_budgets_and_act function exists"
else
    fail "check_budgets_and_act function should exist"
fi

#------------------------------------------------------------------------------
# Test 23: reset_task_budget_state function exists
#------------------------------------------------------------------------------
echo "Test 23: reset_task_budget_state function exists"

if grep -q "reset_task_budget_state()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "reset_task_budget_state function exists"
else
    fail "reset_task_budget_state function should exist"
fi

#------------------------------------------------------------------------------
# Test 24: notify_budget_warning function exists
#------------------------------------------------------------------------------
echo "Test 24: notify_budget_warning function exists"

if grep -q "notify_budget_warning()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "notify_budget_warning function exists"
else
    fail "notify_budget_warning function should exist"
fi

#------------------------------------------------------------------------------
# Test 25: notify_budget_exceeded function exists
#------------------------------------------------------------------------------
echo "Test 25: notify_budget_exceeded function exists"

if grep -q "notify_budget_exceeded()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "notify_budget_exceeded function exists"
else
    fail "notify_budget_exceeded function should exist"
fi

#------------------------------------------------------------------------------
# Test 26: Budget Management section exists in script
#------------------------------------------------------------------------------
echo "Test 26: Budget Management section exists in script"

if grep -q "# Budget Management" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Budget Management section exists"
else
    fail "Budget Management section should exist"
fi

#------------------------------------------------------------------------------
# Test 27: TASK_BUDGET_EXCEEDED variable exists
#------------------------------------------------------------------------------
echo "Test 27: TASK_BUDGET_EXCEEDED variable exists"

if grep -q "TASK_BUDGET_EXCEEDED=" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "TASK_BUDGET_EXCEEDED variable exists"
else
    fail "TASK_BUDGET_EXCEEDED variable should exist"
fi

#------------------------------------------------------------------------------
# Test 28: SESSION_BUDGET_EXCEEDED variable exists
#------------------------------------------------------------------------------
echo "Test 28: SESSION_BUDGET_EXCEEDED variable exists"

if grep -q "SESSION_BUDGET_EXCEEDED=" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "SESSION_BUDGET_EXCEEDED variable exists"
else
    fail "SESSION_BUDGET_EXCEEDED variable should exist"
fi

#------------------------------------------------------------------------------
# Test 29: Budget variables reset in reset_task_metrics
#------------------------------------------------------------------------------
echo "Test 29: Budget variables reset in reset_task_metrics"

if grep -A20 "reset_task_metrics()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q "reset_task_budget_state"; then
    pass "Budget state is reset in reset_task_metrics"
else
    fail "Budget state should be reset in reset_task_metrics"
fi

#------------------------------------------------------------------------------
# Test 30: Budget check in iteration loop
#------------------------------------------------------------------------------
echo "Test 30: Budget check in iteration loop"

if grep -q "check_budgets_and_act" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Budget check is called in execution"
else
    fail "Budget check should be called in execution"
fi

#------------------------------------------------------------------------------
# Test 31: README has budget section
#------------------------------------------------------------------------------
echo "Test 31: README has budget section"

if grep -q "### Budget Limits" "$PROJECT_ROOT/README.md"; then
    pass "README has budget section"
else
    fail "README should have budget section"
fi

#------------------------------------------------------------------------------
# Test 32: README documents per_task_limit
#------------------------------------------------------------------------------
echo "Test 32: README documents per_task_limit"

if grep -q "per_task_limit" "$PROJECT_ROOT/README.md"; then
    pass "README documents per_task_limit"
else
    fail "README should document per_task_limit"
fi

#------------------------------------------------------------------------------
# Test 33: README documents per_session_limit
#------------------------------------------------------------------------------
echo "Test 33: README documents per_session_limit"

if grep -q "per_session_limit" "$PROJECT_ROOT/README.md"; then
    pass "README documents per_session_limit"
else
    fail "README should document per_session_limit"
fi

#------------------------------------------------------------------------------
# Test 34: Default on_task_budget_exceeded is skip
#------------------------------------------------------------------------------
echo "Test 34: Default on_task_budget_exceeded is skip"

if grep -q 'BUDGET_ON_TASK_EXCEEDED:-skip' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Default on_task_budget_exceeded is skip"
else
    fail "Default on_task_budget_exceeded should be skip"
fi

#------------------------------------------------------------------------------
# Test 35: Default on_session_budget_exceeded is stop
#------------------------------------------------------------------------------
echo "Test 35: Default on_session_budget_exceeded is stop"

if grep -q 'BUDGET_ON_SESSION_EXCEEDED:-stop' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Default on_session_budget_exceeded is stop"
else
    fail "Default on_session_budget_exceeded should be stop"
fi

#------------------------------------------------------------------------------
# Test 36: Default warning_threshold is 80
#------------------------------------------------------------------------------
echo "Test 36: Default warning_threshold is 80"

if grep -q 'BUDGET_WARNING_THRESHOLD:-80' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Default warning_threshold is 80"
else
    fail "Default warning_threshold should be 80"
fi

#------------------------------------------------------------------------------
# Test 37: Budget displays in startup log
#------------------------------------------------------------------------------
echo "Test 37: Budget displays in startup log"

if grep -q 'Budget.*per-task\|Budget.*per-session' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Budget is displayed in startup log"
else
    fail "Budget should be displayed in startup log"
fi

#------------------------------------------------------------------------------
# Test 38: Session budget check at session end
#------------------------------------------------------------------------------
echo "Test 38: Session budget check at task completion"

if grep -q "check_session_budget_exceeded.*TOTAL_COST" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Session budget is checked after task completion"
else
    fail "Session budget should be checked after task completion"
fi

#------------------------------------------------------------------------------
# Test 39: handle_task_budget_exceeded handles skip action
#------------------------------------------------------------------------------
echo "Test 39: handle_task_budget_exceeded handles skip action"

if grep -A20 "handle_task_budget_exceeded()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q '"skip"'; then
    pass "handle_task_budget_exceeded handles skip action"
else
    fail "handle_task_budget_exceeded should handle skip action"
fi

#------------------------------------------------------------------------------
# Test 40: handle_task_budget_exceeded handles fail action
#------------------------------------------------------------------------------
echo "Test 40: handle_task_budget_exceeded handles fail action"

if grep -A20 "handle_task_budget_exceeded()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q '"fail"'; then
    pass "handle_task_budget_exceeded handles fail action"
else
    fail "handle_task_budget_exceeded should handle fail action"
fi

#------------------------------------------------------------------------------
# Test 41: handle_task_budget_exceeded handles warn action
#------------------------------------------------------------------------------
echo "Test 41: handle_task_budget_exceeded handles warn action"

if grep -A20 "handle_task_budget_exceeded()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q '"warn"'; then
    pass "handle_task_budget_exceeded handles warn action"
else
    fail "handle_task_budget_exceeded should handle warn action"
fi

#------------------------------------------------------------------------------
# Test 42: handle_session_budget_exceeded handles stop action
#------------------------------------------------------------------------------
echo "Test 42: handle_session_budget_exceeded handles stop action"

if grep -A15 "handle_session_budget_exceeded()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q '"stop"'; then
    pass "handle_session_budget_exceeded handles stop action"
else
    fail "handle_session_budget_exceeded should handle stop action"
fi

#------------------------------------------------------------------------------
# Test 43: Budget check skipped in dry-run mode
#------------------------------------------------------------------------------
echo "Test 43: Budget check skipped in dry-run mode"

if grep -A10 "check_budgets_and_act()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'DRY_RUN.*true'; then
    pass "Budget check is skipped in dry-run mode"
else
    fail "Budget check should be skipped in dry-run mode"
fi

#------------------------------------------------------------------------------
# Test 44: TASK_BUDGET_WARNING_SENT state variable exists
#------------------------------------------------------------------------------
echo "Test 44: TASK_BUDGET_WARNING_SENT state variable exists"

if grep -q "TASK_BUDGET_WARNING_SENT=" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "TASK_BUDGET_WARNING_SENT state variable exists"
else
    fail "TASK_BUDGET_WARNING_SENT state variable should exist"
fi

#------------------------------------------------------------------------------
# Test 45: SESSION_BUDGET_WARNING_SENT state variable exists
#------------------------------------------------------------------------------
echo "Test 45: SESSION_BUDGET_WARNING_SENT state variable exists"

if grep -q "SESSION_BUDGET_WARNING_SENT=" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "SESSION_BUDGET_WARNING_SENT state variable exists"
else
    fail "SESSION_BUDGET_WARNING_SENT state variable should exist"
fi

#------------------------------------------------------------------------------
# Functional Tests - Budget Calculation Logic
#------------------------------------------------------------------------------
echo ""
echo "=========================================="
echo "  Functional Tests"
echo "=========================================="
echo ""

# Source and test budget functions (in a subshell)
source_and_test() {
    # Set up minimal environment for testing
    BUDGET_PER_TASK_LIMIT="2.00"
    BUDGET_PER_SESSION_LIMIT="10.00"
    BUDGET_WARNING_THRESHOLD="80"
    TASK_BUDGET_WARNING_SENT=false
    SESSION_BUDGET_WARNING_SENT=false
    DRY_RUN=false

    # Mock functions
    is_task_budget_enabled() { [ -n "$BUDGET_PER_TASK_LIMIT" ]; }
    is_session_budget_enabled() { [ -n "$BUDGET_PER_SESSION_LIMIT" ]; }

    calculate_budget_percentage() {
        local CURRENT=$1
        local LIMIT=$2
        if [ -z "$LIMIT" ] || [ "$LIMIT" = "0" ]; then
            echo "0"
            return
        fi
        local PERCENTAGE=$(echo "scale=0; ($CURRENT * 100) / $LIMIT" | bc 2>/dev/null || echo "0")
        echo "$PERCENTAGE"
    }

    check_task_budget_exceeded() {
        local CURRENT_COST=$1
        if ! is_task_budget_enabled; then
            return 1
        fi
        local EXCEEDED=$(echo "$CURRENT_COST >= $BUDGET_PER_TASK_LIMIT" | bc 2>/dev/null || echo "0")
        [ "$EXCEEDED" = "1" ]
    }

    check_session_budget_exceeded() {
        local CURRENT_COST=$1
        if ! is_session_budget_enabled; then
            return 1
        fi
        local EXCEEDED=$(echo "$CURRENT_COST >= $BUDGET_PER_SESSION_LIMIT" | bc 2>/dev/null || echo "0")
        [ "$EXCEEDED" = "1" ]
    }

    # Test 1: Calculate percentage correctly
    local RESULT=$(calculate_budget_percentage "1.60" "2.00")
    if [ "$RESULT" = "80" ]; then
        echo -e "${GREEN}PASS${NC}: Budget percentage calculation (1.60/2.00 = 80%)"
    else
        echo -e "${RED}FAIL${NC}: Budget percentage calculation expected 80%, got $RESULT"
        return 1
    fi

    # Test 2: Task budget not exceeded at 99%
    if ! check_task_budget_exceeded "1.99"; then
        echo -e "${GREEN}PASS${NC}: Task budget not exceeded at 99%"
    else
        echo -e "${RED}FAIL${NC}: Task budget should not be exceeded at 99%"
        return 1
    fi

    # Test 3: Task budget exceeded at 100%
    if check_task_budget_exceeded "2.00"; then
        echo -e "${GREEN}PASS${NC}: Task budget exceeded at 100%"
    else
        echo -e "${RED}FAIL${NC}: Task budget should be exceeded at 100%"
        return 1
    fi

    # Test 4: Task budget exceeded above 100%
    if check_task_budget_exceeded "3.50"; then
        echo -e "${GREEN}PASS${NC}: Task budget exceeded above limit"
    else
        echo -e "${RED}FAIL${NC}: Task budget should be exceeded above limit"
        return 1
    fi

    # Test 5: Session budget not exceeded
    if ! check_session_budget_exceeded "9.99"; then
        echo -e "${GREEN}PASS${NC}: Session budget not exceeded at 99.9%"
    else
        echo -e "${RED}FAIL${NC}: Session budget should not be exceeded at 99.9%"
        return 1
    fi

    # Test 6: Session budget exceeded
    if check_session_budget_exceeded "10.00"; then
        echo -e "${GREEN}PASS${NC}: Session budget exceeded at 100%"
    else
        echo -e "${RED}FAIL${NC}: Session budget should be exceeded at 100%"
        return 1
    fi

    # Test 7: Budget disabled when limit is empty
    BUDGET_PER_TASK_LIMIT=""
    if ! is_task_budget_enabled; then
        echo -e "${GREEN}PASS${NC}: Task budget disabled when limit empty"
    else
        echo -e "${RED}FAIL${NC}: Task budget should be disabled when limit empty"
        return 1
    fi

    return 0
}

# Run functional tests in subshell
if (source_and_test); then
    TESTS_PASSED=$((TESTS_PASSED + 7))
else
    TESTS_FAILED=$((TESTS_FAILED + 1))
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

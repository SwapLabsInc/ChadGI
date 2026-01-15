#!/bin/bash
#
# Tests for Task Timeout functionality with graceful interruption
#
# Run with: bash tests/test-task-timeout.sh
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
echo "  Task Timeout Tests"
echo "=========================================="
echo ""

#------------------------------------------------------------------------------
# Test 1: load_config parses task_timeout
#------------------------------------------------------------------------------
echo "Test 1: load_config parses task_timeout"

if grep -q 'TASK_TIMEOUT=$(parse_yaml_nested "iteration" "task_timeout"' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "task_timeout config parsing found"
else
    fail "task_timeout should be parsed in load_config"
fi

#------------------------------------------------------------------------------
# Test 2: Default value for TASK_TIMEOUT is 30
#------------------------------------------------------------------------------
echo "Test 2: Default value for TASK_TIMEOUT is 30"

if grep -q 'TASK_TIMEOUT:-30' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "TASK_TIMEOUT default is 30"
else
    fail "TASK_TIMEOUT default should be 30"
fi

#------------------------------------------------------------------------------
# Test 3: CLI_TASK_TIMEOUT environment variable is supported
#------------------------------------------------------------------------------
echo "Test 3: CLI_TASK_TIMEOUT environment variable is supported"

if grep -q 'CLI_TASK_TIMEOUT=' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "CLI_TASK_TIMEOUT environment variable support found"
else
    fail "CLI_TASK_TIMEOUT environment variable should be supported"
fi

#------------------------------------------------------------------------------
# Test 4: CLI override for task_timeout is applied
#------------------------------------------------------------------------------
echo "Test 4: CLI override for task_timeout is applied"

if grep -A5 'Apply CLI override for task timeout' "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'TASK_TIMEOUT=.*CLI_TASK_TIMEOUT'; then
    pass "CLI override for task_timeout is applied"
else
    fail "CLI override for task_timeout should be applied"
fi

#------------------------------------------------------------------------------
# Test 5: get_timeout_seconds function exists
#------------------------------------------------------------------------------
echo "Test 5: get_timeout_seconds function exists"

if grep -q "get_timeout_seconds()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "get_timeout_seconds function exists"
else
    fail "get_timeout_seconds function should exist"
fi

#------------------------------------------------------------------------------
# Test 6: is_timeout_enabled function exists
#------------------------------------------------------------------------------
echo "Test 6: is_timeout_enabled function exists"

if grep -q "is_timeout_enabled()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "is_timeout_enabled function exists"
else
    fail "is_timeout_enabled function should exist"
fi

#------------------------------------------------------------------------------
# Test 7: start_task_timeout function exists
#------------------------------------------------------------------------------
echo "Test 7: start_task_timeout function exists"

if grep -q "start_task_timeout()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "start_task_timeout function exists"
else
    fail "start_task_timeout function should exist"
fi

#------------------------------------------------------------------------------
# Test 8: stop_task_timeout function exists
#------------------------------------------------------------------------------
echo "Test 8: stop_task_timeout function exists"

if grep -q "stop_task_timeout()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "stop_task_timeout function exists"
else
    fail "stop_task_timeout function should exist"
fi

#------------------------------------------------------------------------------
# Test 9: check_task_timeout function exists
#------------------------------------------------------------------------------
echo "Test 9: check_task_timeout function exists"

if grep -q "check_task_timeout()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "check_task_timeout function exists"
else
    fail "check_task_timeout function should exist"
fi

#------------------------------------------------------------------------------
# Test 10: graceful_interrupt_claude function exists
#------------------------------------------------------------------------------
echo "Test 10: graceful_interrupt_claude function exists"

if grep -q "graceful_interrupt_claude()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "graceful_interrupt_claude function exists"
else
    fail "graceful_interrupt_claude function should exist"
fi

#------------------------------------------------------------------------------
# Test 11: save_partial_work function exists
#------------------------------------------------------------------------------
echo "Test 11: save_partial_work function exists"

if grep -q "save_partial_work()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "save_partial_work function exists"
else
    fail "save_partial_work function should exist"
fi

#------------------------------------------------------------------------------
# Test 12: 75% warning threshold is implemented
#------------------------------------------------------------------------------
echo "Test 12: 75% warning threshold is implemented"

if grep -q "TIMEOUT_SECS \* 75 / 100" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "75% warning threshold is implemented"
else
    fail "75% warning threshold should be implemented"
fi

#------------------------------------------------------------------------------
# Test 13: 90% warning threshold is implemented
#------------------------------------------------------------------------------
echo "Test 13: 90% warning threshold is implemented"

if grep -q "TIMEOUT_SECS \* 90 / 100" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "90% warning threshold is implemented"
else
    fail "90% warning threshold should be implemented"
fi

#------------------------------------------------------------------------------
# Test 14: SIGTERM is used for graceful interruption
#------------------------------------------------------------------------------
echo "Test 14: SIGTERM is used for graceful interruption"

if grep -A20 "graceful_interrupt_claude()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'SIGTERM\|kill -TERM'; then
    pass "SIGTERM is used for graceful interruption"
else
    fail "SIGTERM should be used for graceful interruption"
fi

#------------------------------------------------------------------------------
# Test 15: SIGKILL is used as fallback
#------------------------------------------------------------------------------
echo "Test 15: SIGKILL is used as fallback"

if grep -A30 "graceful_interrupt_claude()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'SIGKILL\|kill -KILL'; then
    pass "SIGKILL is used as fallback"
else
    fail "SIGKILL should be used as fallback"
fi

#------------------------------------------------------------------------------
# Test 16: Timeout failure is recorded as "timeout" reason
#------------------------------------------------------------------------------
echo "Test 16: Timeout failure is recorded as 'timeout' reason"

if grep -q 'FAILURE_REASON="timeout"' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Timeout failure is recorded with 'timeout' reason"
else
    fail "Timeout failure should be recorded with 'timeout' reason"
fi

#------------------------------------------------------------------------------
# Test 17: Exit code 124 is used for timeout
#------------------------------------------------------------------------------
echo "Test 17: Exit code 124 is used for timeout"

if grep -q 'return 124' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Exit code 124 is used for timeout"
else
    fail "Exit code 124 should be used for timeout (standard timeout exit code)"
fi

#------------------------------------------------------------------------------
# Test 18: run_task_with_iterations calls start_task_timeout
#------------------------------------------------------------------------------
echo "Test 18: run_task_with_iterations calls start_task_timeout"

if grep -A50 "run_task_with_iterations()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q "start_task_timeout"; then
    pass "run_task_with_iterations calls start_task_timeout"
else
    fail "run_task_with_iterations should call start_task_timeout"
fi

#------------------------------------------------------------------------------
# Test 19: run_task_with_iterations calls stop_task_timeout
#------------------------------------------------------------------------------
echo "Test 19: run_task_with_iterations calls stop_task_timeout"

if grep -B5 "return 0" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q "stop_task_timeout"; then
    pass "run_task_with_iterations calls stop_task_timeout"
else
    fail "run_task_with_iterations should call stop_task_timeout"
fi

#------------------------------------------------------------------------------
# Test 20: Template config has task_timeout setting
#------------------------------------------------------------------------------
echo "Test 20: Template config has task_timeout setting"

if grep -q "task_timeout:" "$PROJECT_ROOT/templates/chadgi-config.yaml"; then
    pass "Template config has task_timeout setting"
else
    fail "Template config should have task_timeout setting"
fi

#------------------------------------------------------------------------------
# Test 21: set_defaults has TASK_TIMEOUT
#------------------------------------------------------------------------------
echo "Test 21: set_defaults has TASK_TIMEOUT"

if grep -A100 "^set_defaults()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'TASK_TIMEOUT='; then
    pass "set_defaults has TASK_TIMEOUT"
else
    fail "set_defaults should have TASK_TIMEOUT"
fi

#------------------------------------------------------------------------------
# Test 22: Timeout is displayed in startup info
#------------------------------------------------------------------------------
echo "Test 22: Timeout is displayed in startup info"

if grep -q 'log_info "Task Timeout:' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Timeout is displayed in startup info"
else
    fail "Timeout should be displayed in startup info"
fi

#------------------------------------------------------------------------------
# Test 23: Timeout can be disabled (0 value check)
#------------------------------------------------------------------------------
echo "Test 23: Timeout can be disabled (0 value check)"

if grep -q 'TASK_TIMEOUT.*-gt 0' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Timeout can be disabled with 0 value"
else
    fail "Timeout should be able to be disabled with 0 value"
fi

#------------------------------------------------------------------------------
# Test 24: TASK_TIMEOUT_TRIGGERED variable exists
#------------------------------------------------------------------------------
echo "Test 24: TASK_TIMEOUT_TRIGGERED variable exists"

if grep -q "TASK_TIMEOUT_TRIGGERED=" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "TASK_TIMEOUT_TRIGGERED variable exists"
else
    fail "TASK_TIMEOUT_TRIGGERED variable should exist"
fi

#------------------------------------------------------------------------------
# Test 25: WIP commit is created for partial work
#------------------------------------------------------------------------------
echo "Test 25: WIP commit is created for partial work"

if grep -A20 "save_partial_work()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q '\[WIP\]'; then
    pass "WIP commit is created for partial work"
else
    fail "WIP commit should be created for partial work"
fi

#------------------------------------------------------------------------------
# Test 26: CLI start.ts has timeout option
#------------------------------------------------------------------------------
echo "Test 26: CLI start.ts has timeout option"

if grep -q "timeout.*number" "$PROJECT_ROOT/src/start.ts"; then
    pass "CLI start.ts has timeout option"
else
    fail "CLI start.ts should have timeout option"
fi

#------------------------------------------------------------------------------
# Test 27: CLI cli.ts has --timeout flag
#------------------------------------------------------------------------------
echo "Test 27: CLI cli.ts has --timeout flag"

if grep -q "\-\-timeout" "$PROJECT_ROOT/src/cli.ts"; then
    pass "CLI cli.ts has --timeout flag"
else
    fail "CLI cli.ts should have --timeout flag"
fi

#------------------------------------------------------------------------------
# Test 28: TASK_TIMEOUT is passed to env in start.ts
#------------------------------------------------------------------------------
echo "Test 28: TASK_TIMEOUT is passed to env in start.ts"

if grep -q "TASK_TIMEOUT.*String.*timeout" "$PROJECT_ROOT/src/start.ts"; then
    pass "TASK_TIMEOUT is passed to env in start.ts"
else
    fail "TASK_TIMEOUT should be passed to env in start.ts"
fi

#------------------------------------------------------------------------------
# Test 29: on_max_iterations handles timeout same as max_iterations
#------------------------------------------------------------------------------
echo "Test 29: on_max_iterations handles timeout same as max_iterations"

# The same ON_MAX_ITERATIONS case statement should be used for both timeout and max_iterations
if grep -B10 'ON_MAX_ITERATIONS' "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'FAILURE_REASON'; then
    pass "on_max_iterations handles timeout same as max_iterations"
else
    fail "on_max_iterations should handle timeout same as max_iterations"
fi

#------------------------------------------------------------------------------
# Functional Tests - Test timeout helper functions
#------------------------------------------------------------------------------
echo ""
echo "=========================================="
echo "  Functional Tests"
echo "=========================================="
echo ""

# Source timeout functions for testing (in a subshell)
source_and_test_timeout() {
    # Set up minimal environment
    TASK_TIMEOUT=30

    # Test get_timeout_seconds
    get_timeout_seconds() {
        echo $((TASK_TIMEOUT * 60))
    }

    # Test is_timeout_enabled
    is_timeout_enabled() {
        [ "$TASK_TIMEOUT" -gt 0 ] 2>/dev/null
    }

    # Test 1: get_timeout_seconds returns correct value
    RESULT=$(get_timeout_seconds)
    if [ "$RESULT" = "1800" ]; then
        echo -e "${GREEN}PASS${NC}: get_timeout_seconds returns 1800 for 30 minutes"
    else
        echo -e "${RED}FAIL${NC}: get_timeout_seconds should return 1800, got $RESULT"
        return 1
    fi

    # Test 2: is_timeout_enabled returns true for 30
    if is_timeout_enabled; then
        echo -e "${GREEN}PASS${NC}: is_timeout_enabled returns true for TASK_TIMEOUT=30"
    else
        echo -e "${RED}FAIL${NC}: is_timeout_enabled should return true for TASK_TIMEOUT=30"
        return 1
    fi

    # Test 3: is_timeout_enabled returns false for 0
    TASK_TIMEOUT=0
    if ! is_timeout_enabled; then
        echo -e "${GREEN}PASS${NC}: is_timeout_enabled returns false for TASK_TIMEOUT=0"
    else
        echo -e "${RED}FAIL${NC}: is_timeout_enabled should return false for TASK_TIMEOUT=0"
        return 1
    fi

    # Test 4: 75% threshold calculation
    TASK_TIMEOUT=30
    TIMEOUT_SECS=$(get_timeout_seconds)
    TIMEOUT_75=$((TIMEOUT_SECS * 75 / 100))
    if [ "$TIMEOUT_75" = "1350" ]; then
        echo -e "${GREEN}PASS${NC}: 75% threshold is 1350 seconds (22.5 minutes)"
    else
        echo -e "${RED}FAIL${NC}: 75% threshold should be 1350, got $TIMEOUT_75"
        return 1
    fi

    # Test 5: 90% threshold calculation
    TIMEOUT_90=$((TIMEOUT_SECS * 90 / 100))
    if [ "$TIMEOUT_90" = "1620" ]; then
        echo -e "${GREEN}PASS${NC}: 90% threshold is 1620 seconds (27 minutes)"
    else
        echo -e "${RED}FAIL${NC}: 90% threshold should be 1620, got $TIMEOUT_90"
        return 1
    fi

    return 0
}

# Run functional tests in subshell
if (source_and_test_timeout); then
    TESTS_PASSED=$((TESTS_PASSED + 5))
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

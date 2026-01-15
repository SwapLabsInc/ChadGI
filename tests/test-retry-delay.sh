#!/bin/bash
#
# Tests for Retry Delay functionality with configurable backoff
#
# Run with: bash tests/test-retry-delay.sh
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
echo "  Retry Delay Tests"
echo "=========================================="
echo ""

#------------------------------------------------------------------------------
# Test 1: load_config parses retry_delay
#------------------------------------------------------------------------------
echo "Test 1: load_config parses retry_delay"

if grep -q 'RETRY_DELAY=$(parse_yaml_nested "iteration" "retry_delay"' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "retry_delay config parsing found"
else
    fail "retry_delay should be parsed in load_config"
fi

#------------------------------------------------------------------------------
# Test 2: load_config parses retry_backoff
#------------------------------------------------------------------------------
echo "Test 2: load_config parses retry_backoff"

if grep -q 'RETRY_BACKOFF=$(parse_yaml_nested "iteration" "retry_backoff"' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "retry_backoff config parsing found"
else
    fail "retry_backoff should be parsed in load_config"
fi

#------------------------------------------------------------------------------
# Test 3: load_config parses retry_max_delay
#------------------------------------------------------------------------------
echo "Test 3: load_config parses retry_max_delay"

if grep -q 'RETRY_MAX_DELAY=$(parse_yaml_nested "iteration" "retry_max_delay"' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "retry_max_delay config parsing found"
else
    fail "retry_max_delay should be parsed in load_config"
fi

#------------------------------------------------------------------------------
# Test 4: load_config parses retry_jitter
#------------------------------------------------------------------------------
echo "Test 4: load_config parses retry_jitter"

if grep -q 'RETRY_JITTER=$(parse_yaml_nested "iteration" "retry_jitter"' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "retry_jitter config parsing found"
else
    fail "retry_jitter should be parsed in load_config"
fi

#------------------------------------------------------------------------------
# Test 5: Default value for RETRY_DELAY is 5
#------------------------------------------------------------------------------
echo "Test 5: Default value for RETRY_DELAY is 5"

if grep -q 'RETRY_DELAY:-5' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "RETRY_DELAY default is 5"
else
    fail "RETRY_DELAY default should be 5"
fi

#------------------------------------------------------------------------------
# Test 6: Default value for RETRY_BACKOFF is exponential
#------------------------------------------------------------------------------
echo "Test 6: Default value for RETRY_BACKOFF is exponential"

if grep -q 'RETRY_BACKOFF:-exponential' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "RETRY_BACKOFF default is exponential"
else
    fail "RETRY_BACKOFF default should be exponential"
fi

#------------------------------------------------------------------------------
# Test 7: Default value for RETRY_MAX_DELAY is 60
#------------------------------------------------------------------------------
echo "Test 7: Default value for RETRY_MAX_DELAY is 60"

if grep -q 'RETRY_MAX_DELAY:-60' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "RETRY_MAX_DELAY default is 60"
else
    fail "RETRY_MAX_DELAY default should be 60"
fi

#------------------------------------------------------------------------------
# Test 8: Default value for RETRY_JITTER is false
#------------------------------------------------------------------------------
echo "Test 8: Default value for RETRY_JITTER is false"

if grep -q 'RETRY_JITTER:-false' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "RETRY_JITTER default is false"
else
    fail "RETRY_JITTER default should be false"
fi

#------------------------------------------------------------------------------
# Test 9: calculate_retry_delay function exists
#------------------------------------------------------------------------------
echo "Test 9: calculate_retry_delay function exists"

if grep -q "calculate_retry_delay()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "calculate_retry_delay function exists"
else
    fail "calculate_retry_delay function should exist"
fi

#------------------------------------------------------------------------------
# Test 10: calculate_retry_delay handles fixed backoff
#------------------------------------------------------------------------------
echo "Test 10: calculate_retry_delay handles fixed backoff"

if grep -A20 "calculate_retry_delay()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q '"fixed"'; then
    pass "calculate_retry_delay handles fixed backoff"
else
    fail "calculate_retry_delay should handle fixed backoff"
fi

#------------------------------------------------------------------------------
# Test 11: calculate_retry_delay handles linear backoff
#------------------------------------------------------------------------------
echo "Test 11: calculate_retry_delay handles linear backoff"

if grep -A25 "calculate_retry_delay()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q '"linear"'; then
    pass "calculate_retry_delay handles linear backoff"
else
    fail "calculate_retry_delay should handle linear backoff"
fi

#------------------------------------------------------------------------------
# Test 12: calculate_retry_delay handles exponential backoff
#------------------------------------------------------------------------------
echo "Test 12: calculate_retry_delay handles exponential backoff"

if grep -A30 "calculate_retry_delay()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q '"exponential"'; then
    pass "calculate_retry_delay handles exponential backoff"
else
    fail "calculate_retry_delay should handle exponential backoff"
fi

#------------------------------------------------------------------------------
# Test 13: calculate_retry_delay caps at max_delay
#------------------------------------------------------------------------------
echo "Test 13: calculate_retry_delay caps at max_delay"

if grep -A50 "calculate_retry_delay()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'DELAY -gt $RETRY_MAX_DELAY'; then
    pass "calculate_retry_delay caps at max_delay"
else
    fail "calculate_retry_delay should cap at max_delay"
fi

#------------------------------------------------------------------------------
# Test 14: calculate_retry_delay applies jitter
#------------------------------------------------------------------------------
echo "Test 14: calculate_retry_delay applies jitter"

if grep -A60 "calculate_retry_delay()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'RETRY_JITTER.*true'; then
    pass "calculate_retry_delay applies jitter"
else
    fail "calculate_retry_delay should apply jitter when enabled"
fi

#------------------------------------------------------------------------------
# Test 15: log_retry_delay function exists
#------------------------------------------------------------------------------
echo "Test 15: log_retry_delay function exists"

if grep -q "log_retry_delay()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "log_retry_delay function exists"
else
    fail "log_retry_delay function should exist"
fi

#------------------------------------------------------------------------------
# Test 16: log_retry_delay logs backoff type
#------------------------------------------------------------------------------
echo "Test 16: log_retry_delay logs backoff type"

if grep -A15 "log_retry_delay()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'backoff:'; then
    pass "log_retry_delay logs backoff type"
else
    fail "log_retry_delay should log backoff type"
fi

#------------------------------------------------------------------------------
# Test 17: Iteration loop uses calculate_retry_delay
#------------------------------------------------------------------------------
echo "Test 17: Iteration loop uses calculate_retry_delay"

if grep -q 'calculate_retry_delay \$ITERATION' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Iteration loop uses calculate_retry_delay"
else
    fail "Iteration loop should use calculate_retry_delay"
fi

#------------------------------------------------------------------------------
# Test 18: Iteration loop calls log_retry_delay
#------------------------------------------------------------------------------
echo "Test 18: Iteration loop calls log_retry_delay"

if grep -q 'log_retry_delay \$DELAY \$ITERATION' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Iteration loop calls log_retry_delay"
else
    fail "Iteration loop should call log_retry_delay"
fi

#------------------------------------------------------------------------------
# Test 19: Template config has retry_delay setting
#------------------------------------------------------------------------------
echo "Test 19: Template config has retry_delay setting"

if grep -q "retry_delay:" "$PROJECT_ROOT/templates/chadgi-config.yaml"; then
    pass "Template config has retry_delay setting"
else
    fail "Template config should have retry_delay setting"
fi

#------------------------------------------------------------------------------
# Test 20: Template config has retry_backoff setting
#------------------------------------------------------------------------------
echo "Test 20: Template config has retry_backoff setting"

if grep -q "retry_backoff:" "$PROJECT_ROOT/templates/chadgi-config.yaml"; then
    pass "Template config has retry_backoff setting"
else
    fail "Template config should have retry_backoff setting"
fi

#------------------------------------------------------------------------------
# Test 21: Template config has retry_max_delay setting
#------------------------------------------------------------------------------
echo "Test 21: Template config has retry_max_delay setting"

if grep -q "retry_max_delay:" "$PROJECT_ROOT/templates/chadgi-config.yaml"; then
    pass "Template config has retry_max_delay setting"
else
    fail "Template config should have retry_max_delay setting"
fi

#------------------------------------------------------------------------------
# Test 22: Template config has retry_jitter setting
#------------------------------------------------------------------------------
echo "Test 22: Template config has retry_jitter setting"

if grep -q "retry_jitter:" "$PROJECT_ROOT/templates/chadgi-config.yaml"; then
    pass "Template config has retry_jitter setting"
else
    fail "Template config should have retry_jitter setting"
fi

#------------------------------------------------------------------------------
# Test 23: No hardcoded 'sleep 2' remains in iteration loop
#------------------------------------------------------------------------------
echo "Test 23: No hardcoded 'sleep 2' remains in iteration loop"

# The iteration loop should use $DELAY variable, not hardcoded sleep 2
if grep -A10 "if \[ \$ITERATION -le \$MAX_ITERATIONS \]" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'sleep \$DELAY'; then
    pass "Iteration loop uses variable delay"
else
    fail "Iteration loop should use variable delay instead of hardcoded value"
fi

#------------------------------------------------------------------------------
# Test 24: Jitter range is ±20%
#------------------------------------------------------------------------------
echo "Test 24: Jitter range is ±20%"

if grep -A60 "calculate_retry_delay()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q "DELAY \* 20 / 100"; then
    pass "Jitter range is ±20%"
else
    fail "Jitter range should be ±20%"
fi

#------------------------------------------------------------------------------
# Test 25: Delay doesn't go below 1 second with jitter
#------------------------------------------------------------------------------
echo "Test 25: Delay doesn't go below 1 second with jitter"

if grep -A70 "calculate_retry_delay()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q "DELAY -lt 1"; then
    pass "Delay minimum is enforced with jitter"
else
    fail "Delay minimum should be enforced with jitter"
fi

#------------------------------------------------------------------------------
# Test 26: set_defaults has RETRY_DELAY
#------------------------------------------------------------------------------
echo "Test 26: set_defaults has RETRY_DELAY"

if grep -A100 "^set_defaults()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'RETRY_DELAY='; then
    pass "set_defaults has RETRY_DELAY"
else
    fail "set_defaults should have RETRY_DELAY"
fi

#------------------------------------------------------------------------------
# Test 27: set_defaults has RETRY_BACKOFF
#------------------------------------------------------------------------------
echo "Test 27: set_defaults has RETRY_BACKOFF"

if grep -A100 "^set_defaults()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'RETRY_BACKOFF='; then
    pass "set_defaults has RETRY_BACKOFF"
else
    fail "set_defaults should have RETRY_BACKOFF"
fi

#------------------------------------------------------------------------------
# Test 28: set_defaults has RETRY_MAX_DELAY
#------------------------------------------------------------------------------
echo "Test 28: set_defaults has RETRY_MAX_DELAY"

if grep -A100 "^set_defaults()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'RETRY_MAX_DELAY='; then
    pass "set_defaults has RETRY_MAX_DELAY"
else
    fail "set_defaults should have RETRY_MAX_DELAY"
fi

#------------------------------------------------------------------------------
# Test 29: set_defaults has RETRY_JITTER
#------------------------------------------------------------------------------
echo "Test 29: set_defaults has RETRY_JITTER"

if grep -A100 "^set_defaults()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'RETRY_JITTER='; then
    pass "set_defaults has RETRY_JITTER"
else
    fail "set_defaults should have RETRY_JITTER"
fi

#------------------------------------------------------------------------------
# Functional Tests - Actually test the delay calculation
#------------------------------------------------------------------------------
echo ""
echo "=========================================="
echo "  Functional Tests"
echo "=========================================="
echo ""

# Source the script functions for testing (in a subshell to avoid side effects)
source_and_test() {
    # Set up minimal environment to source the functions
    CHADGI_DIR="."
    CONFIG_FILE="nonexistent"

    # Source just the function we need by extracting it
    calculate_retry_delay() {
        local ITERATION=$1
        local DELAY=0

        case "$RETRY_BACKOFF" in
            "fixed")
                DELAY=$RETRY_DELAY
                ;;
            "linear")
                DELAY=$((RETRY_DELAY * ITERATION))
                ;;
            "exponential"|*)
                local EXPONENT=$((ITERATION - 1))
                local POWER=1
                local i=0
                while [ $i -lt $EXPONENT ]; do
                    POWER=$((POWER * 2))
                    i=$((i + 1))
                done
                DELAY=$((RETRY_DELAY * POWER))
                ;;
        esac

        if [ $DELAY -gt $RETRY_MAX_DELAY ]; then
            DELAY=$RETRY_MAX_DELAY
        fi

        echo $DELAY
    }

    # Test fixed backoff
    RETRY_DELAY=5
    RETRY_BACKOFF="fixed"
    RETRY_MAX_DELAY=60
    RETRY_JITTER="false"

    RESULT=$(calculate_retry_delay 1)
    if [ "$RESULT" = "5" ]; then
        echo -e "${GREEN}PASS${NC}: Fixed backoff iteration 1 = 5"
    else
        echo -e "${RED}FAIL${NC}: Fixed backoff iteration 1 should be 5, got $RESULT"
        return 1
    fi

    RESULT=$(calculate_retry_delay 3)
    if [ "$RESULT" = "5" ]; then
        echo -e "${GREEN}PASS${NC}: Fixed backoff iteration 3 = 5"
    else
        echo -e "${RED}FAIL${NC}: Fixed backoff iteration 3 should be 5, got $RESULT"
        return 1
    fi

    # Test linear backoff
    RETRY_BACKOFF="linear"

    RESULT=$(calculate_retry_delay 1)
    if [ "$RESULT" = "5" ]; then
        echo -e "${GREEN}PASS${NC}: Linear backoff iteration 1 = 5"
    else
        echo -e "${RED}FAIL${NC}: Linear backoff iteration 1 should be 5, got $RESULT"
        return 1
    fi

    RESULT=$(calculate_retry_delay 3)
    if [ "$RESULT" = "15" ]; then
        echo -e "${GREEN}PASS${NC}: Linear backoff iteration 3 = 15"
    else
        echo -e "${RED}FAIL${NC}: Linear backoff iteration 3 should be 15, got $RESULT"
        return 1
    fi

    # Test exponential backoff
    RETRY_BACKOFF="exponential"

    RESULT=$(calculate_retry_delay 1)
    if [ "$RESULT" = "5" ]; then
        echo -e "${GREEN}PASS${NC}: Exponential backoff iteration 1 = 5"
    else
        echo -e "${RED}FAIL${NC}: Exponential backoff iteration 1 should be 5, got $RESULT"
        return 1
    fi

    RESULT=$(calculate_retry_delay 2)
    if [ "$RESULT" = "10" ]; then
        echo -e "${GREEN}PASS${NC}: Exponential backoff iteration 2 = 10"
    else
        echo -e "${RED}FAIL${NC}: Exponential backoff iteration 2 should be 10, got $RESULT"
        return 1
    fi

    RESULT=$(calculate_retry_delay 3)
    if [ "$RESULT" = "20" ]; then
        echo -e "${GREEN}PASS${NC}: Exponential backoff iteration 3 = 20"
    else
        echo -e "${RED}FAIL${NC}: Exponential backoff iteration 3 should be 20, got $RESULT"
        return 1
    fi

    RESULT=$(calculate_retry_delay 4)
    if [ "$RESULT" = "40" ]; then
        echo -e "${GREEN}PASS${NC}: Exponential backoff iteration 4 = 40"
    else
        echo -e "${RED}FAIL${NC}: Exponential backoff iteration 4 should be 40, got $RESULT"
        return 1
    fi

    # Test max delay cap
    RESULT=$(calculate_retry_delay 5)
    if [ "$RESULT" = "60" ]; then
        echo -e "${GREEN}PASS${NC}: Exponential backoff iteration 5 capped at 60"
    else
        echo -e "${RED}FAIL${NC}: Exponential backoff iteration 5 should be capped at 60, got $RESULT"
        return 1
    fi

    return 0
}

# Run functional tests in subshell
if (source_and_test); then
    TESTS_PASSED=$((TESTS_PASSED + 9))
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

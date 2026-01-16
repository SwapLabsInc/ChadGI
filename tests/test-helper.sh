#!/bin/bash
#
# Shared test helper functions
# Source this file at the start of test scripts
#
# Usage: source "$(dirname "${BASH_SOURCE[0]}")/test-helper.sh"
#
# Set QUIET=1 to only show failures and summary (for CI/agent use)
#

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

TESTS_PASSED=0
TESTS_FAILED=0
FAILED_TESTS=""

# Test helper functions
pass() {
    TESTS_PASSED=$((TESTS_PASSED + 1))
    if [ "${QUIET:-0}" != "1" ]; then
        echo -e "${GREEN}PASS${NC}: $1"
    fi
}

fail() {
    TESTS_FAILED=$((TESTS_FAILED + 1))
    FAILED_TESTS="${FAILED_TESTS}\n  - $1"
    echo -e "${RED}FAIL${NC}: $1"
}

# Print test header (suppressed in quiet mode)
test_header() {
    if [ "${QUIET:-0}" != "1" ]; then
        echo "=========================================="
        echo "  $1"
        echo "=========================================="
        echo ""
    fi
}

# Print test name (suppressed in quiet mode)
test_name() {
    if [ "${QUIET:-0}" != "1" ]; then
        echo "$1"
    fi
}

# Print test summary
test_summary() {
    local test_file="${1:-tests}"

    if [ "${QUIET:-0}" = "1" ]; then
        # Minimal output for CI/agent
        if [ $TESTS_FAILED -eq 0 ]; then
            echo -e "${GREEN}PASS${NC} ${test_file}: ${TESTS_PASSED} passed"
        else
            echo -e "${RED}FAIL${NC} ${test_file}: ${TESTS_PASSED} passed, ${TESTS_FAILED} failed"
            echo -e "Failed tests:${FAILED_TESTS}"
        fi
    else
        # Verbose output
        echo ""
        echo "=========================================="
        echo "  Test Results"
        echo "=========================================="
        echo -e "Passed: ${GREEN}${TESTS_PASSED}${NC}"
        echo -e "Failed: ${RED}${TESTS_FAILED}${NC}"
        echo ""
        if [ $TESTS_FAILED -gt 0 ]; then
            echo -e "${RED}Some tests failed!${NC}"
        else
            echo -e "${GREEN}All tests passed!${NC}"
        fi
    fi

    # Exit with failure if any tests failed
    [ $TESTS_FAILED -eq 0 ]
}

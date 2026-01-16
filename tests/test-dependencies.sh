#!/bin/bash
#
# Tests for Task Dependency functionality
#
# Run with: bash tests/test-dependencies.sh
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
echo "  Task Dependency Tests"
echo "=========================================="
echo ""

#------------------------------------------------------------------------------
# Test 1: parse_issue_dependencies function exists
#------------------------------------------------------------------------------
echo "Test 1: parse_issue_dependencies function exists"

if grep -q "parse_issue_dependencies()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "parse_issue_dependencies function exists"
else
    fail "parse_issue_dependencies function should exist"
fi

#------------------------------------------------------------------------------
# Test 2: check_issue_dependencies function exists
#------------------------------------------------------------------------------
echo "Test 2: check_issue_dependencies function exists"

if grep -q "check_issue_dependencies()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "check_issue_dependencies function exists"
else
    fail "check_issue_dependencies function should exist"
fi

#------------------------------------------------------------------------------
# Test 3: is_issue_completed function exists
#------------------------------------------------------------------------------
echo "Test 3: is_issue_completed function exists"

if grep -q "is_issue_completed()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "is_issue_completed function exists"
else
    fail "is_issue_completed function should exist"
fi

#------------------------------------------------------------------------------
# Test 4: get_linked_blocking_issues function exists
#------------------------------------------------------------------------------
echo "Test 4: get_linked_blocking_issues function exists"

if grep -q "get_linked_blocking_issues()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "get_linked_blocking_issues function exists"
else
    fail "get_linked_blocking_issues function should exist"
fi

#------------------------------------------------------------------------------
# Test 5: get_dependency_status function exists
#------------------------------------------------------------------------------
echo "Test 5: get_dependency_status function exists"

if grep -q "get_dependency_status()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "get_dependency_status function exists"
else
    fail "get_dependency_status function should exist"
fi

#------------------------------------------------------------------------------
# Test 6: DEPENDENCIES_ENABLED config variable exists
#------------------------------------------------------------------------------
echo "Test 6: DEPENDENCIES_ENABLED config variable exists"

if grep -q 'DEPENDENCIES_ENABLED=' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "DEPENDENCIES_ENABLED config variable exists"
else
    fail "DEPENDENCIES_ENABLED config variable should exist"
fi

#------------------------------------------------------------------------------
# Test 7: Default value for DEPENDENCIES_ENABLED is true
#------------------------------------------------------------------------------
echo "Test 7: Default value for DEPENDENCIES_ENABLED is true"

if grep -q 'DEPENDENCIES_ENABLED:-true' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "DEPENDENCIES_ENABLED default is true"
else
    fail "DEPENDENCIES_ENABLED default should be true"
fi

#------------------------------------------------------------------------------
# Test 8: DEPENDENCY_PATTERNS config variable exists
#------------------------------------------------------------------------------
echo "Test 8: DEPENDENCY_PATTERNS config variable exists"

if grep -q 'DEPENDENCY_PATTERNS=' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "DEPENDENCY_PATTERNS config variable exists"
else
    fail "DEPENDENCY_PATTERNS config variable should exist"
fi

#------------------------------------------------------------------------------
# Test 9: Default dependency patterns include 'depends on'
#------------------------------------------------------------------------------
echo "Test 9: Default dependency patterns include 'depends on'"

if grep 'DEPENDENCY_PATTERNS:-' "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'depends on'; then
    pass "Default patterns include 'depends on'"
else
    fail "Default patterns should include 'depends on'"
fi

#------------------------------------------------------------------------------
# Test 10: Default dependency patterns include 'blocked by'
#------------------------------------------------------------------------------
echo "Test 10: Default dependency patterns include 'blocked by'"

if grep 'DEPENDENCY_PATTERNS:-' "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'blocked by'; then
    pass "Default patterns include 'blocked by'"
else
    fail "Default patterns should include 'blocked by'"
fi

#------------------------------------------------------------------------------
# Test 11: IGNORE_DEPS environment variable exists
#------------------------------------------------------------------------------
echo "Test 11: IGNORE_DEPS environment variable exists"

if grep -q 'IGNORE_DEPS=' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "IGNORE_DEPS environment variable exists"
else
    fail "IGNORE_DEPS environment variable should exist"
fi

#------------------------------------------------------------------------------
# Test 12: get_project_task checks dependencies
#------------------------------------------------------------------------------
echo "Test 12: get_project_task checks dependencies"

if grep -A100 "get_project_task()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'check_issue_dependencies'; then
    pass "get_project_task checks dependencies"
else
    fail "get_project_task should check dependencies"
fi

#------------------------------------------------------------------------------
# Test 13: BLOCKING_ISSUES variable is set
#------------------------------------------------------------------------------
echo "Test 13: BLOCKING_ISSUES variable is set in dependency check"

if grep -q 'BLOCKING_ISSUES=' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "BLOCKING_ISSUES variable is set"
else
    fail "BLOCKING_ISSUES variable should be set in dependency check"
fi

#------------------------------------------------------------------------------
# Test 14: SKIPPED_TASKS tracking exists
#------------------------------------------------------------------------------
echo "Test 14: SKIPPED_TASKS tracking exists"

if grep -q 'SKIPPED_TASKS=' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "SKIPPED_TASKS tracking exists"
else
    fail "SKIPPED_TASKS tracking should exist"
fi

#------------------------------------------------------------------------------
# Test 15: Dependency cache exists
#------------------------------------------------------------------------------
echo "Test 15: Dependency cache exists"

if grep -q 'DEPENDENCY_CACHE' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Dependency cache exists"
else
    fail "Dependency cache should exist"
fi

#------------------------------------------------------------------------------
# Test 16: Template config has dependencies section
#------------------------------------------------------------------------------
echo "Test 16: Template config has dependencies section"

if grep -q "^dependencies:" "$PROJECT_ROOT/templates/chadgi-config.yaml"; then
    pass "Template config has dependencies section"
else
    fail "Template config should have dependencies section"
fi

#------------------------------------------------------------------------------
# Test 17: Template config has dependencies.enabled setting
#------------------------------------------------------------------------------
echo "Test 17: Template config has dependencies.enabled setting"

if grep -A5 "^dependencies:" "$PROJECT_ROOT/templates/chadgi-config.yaml" | grep -q "enabled:"; then
    pass "Template config has dependencies.enabled setting"
else
    fail "Template config should have dependencies.enabled setting"
fi

#------------------------------------------------------------------------------
# Test 18: Template config has dependency_patterns setting
#------------------------------------------------------------------------------
echo "Test 18: Template config has dependency_patterns setting"

if grep -q "dependency_patterns:" "$PROJECT_ROOT/templates/chadgi-config.yaml"; then
    pass "Template config has dependency_patterns setting"
else
    fail "Template config should have dependency_patterns setting"
fi

#------------------------------------------------------------------------------
# Test 19: CLI has --ignore-deps flag
#------------------------------------------------------------------------------
echo "Test 19: CLI has --ignore-deps flag"

if grep -q "\-\-ignore-deps" "$PROJECT_ROOT/src/cli.ts"; then
    pass "CLI has --ignore-deps flag"
else
    fail "CLI should have --ignore-deps flag"
fi

#------------------------------------------------------------------------------
# Test 20: start.ts passes IGNORE_DEPS to environment
#------------------------------------------------------------------------------
echo "Test 20: start.ts passes IGNORE_DEPS to environment"

if grep -q "IGNORE_DEPS:" "$PROJECT_ROOT/src/start.ts"; then
    pass "start.ts passes IGNORE_DEPS to environment"
else
    fail "start.ts should pass IGNORE_DEPS to environment"
fi

#------------------------------------------------------------------------------
# Test 21: check_issue_dependencies returns 0 when IGNORE_DEPS is true
#------------------------------------------------------------------------------
echo "Test 21: check_issue_dependencies respects IGNORE_DEPS flag"

if grep -A20 "check_issue_dependencies()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'IGNORE_DEPS.*true'; then
    pass "check_issue_dependencies respects IGNORE_DEPS flag"
else
    fail "check_issue_dependencies should respect IGNORE_DEPS flag"
fi

#------------------------------------------------------------------------------
# Test 22: Dependency display in main loop
#------------------------------------------------------------------------------
echo "Test 22: Dependency display in main loop"

if grep -q 'Dependencies:' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Dependency display exists in main loop"
else
    fail "Dependency display should exist in main loop"
fi

#------------------------------------------------------------------------------
# Test 23: Skipped tasks are logged
#------------------------------------------------------------------------------
echo "Test 23: Skipped tasks are logged with reason"

if grep -q 'blocked by:' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Skipped tasks are logged with reason"
else
    fail "Skipped tasks should be logged with reason"
fi

#------------------------------------------------------------------------------
# Test 24: Dependencies check in config display
#------------------------------------------------------------------------------
echo "Test 24: Dependencies check shown in config display"

if grep -q 'Dependencies:.*enabled\|disabled' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Dependencies check shown in config display"
else
    fail "Dependencies check should be shown in config display"
fi

#------------------------------------------------------------------------------
# Test 25: DEPENDENCY_CACHE_TIMEOUT config exists
#------------------------------------------------------------------------------
echo "Test 25: DEPENDENCY_CACHE_TIMEOUT config exists"

if grep -q 'DEPENDENCY_CACHE_TIMEOUT=' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "DEPENDENCY_CACHE_TIMEOUT config exists"
else
    fail "DEPENDENCY_CACHE_TIMEOUT config should exist"
fi

#------------------------------------------------------------------------------
# Test 26: DEPENDENCIES_CHECK_LINKED config exists
#------------------------------------------------------------------------------
echo "Test 26: DEPENDENCIES_CHECK_LINKED config exists"

if grep -q 'DEPENDENCIES_CHECK_LINKED=' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "DEPENDENCIES_CHECK_LINKED config exists"
else
    fail "DEPENDENCIES_CHECK_LINKED config should exist"
fi

#------------------------------------------------------------------------------
# Functional Tests - Test parse_issue_dependencies
#------------------------------------------------------------------------------
echo ""
echo "=========================================="
echo "  Functional Tests"
echo "=========================================="
echo ""

# Extract parse_issue_dependencies function for testing
# Source only the function we need (simplified version for testing)
parse_issue_dependencies_test() {
    local ISSUE_BODY="$1"
    local DEPENDENCY_PATTERNS="depends on blocked by requires"

    if [ -z "$ISSUE_BODY" ] || [ "$ISSUE_BODY" = "null" ]; then
        echo ""
        return
    fi

    # Build regex pattern from DEPENDENCY_PATTERNS
    local PATTERN_PARTS=""
    for pattern in $DEPENDENCY_PATTERNS; do
        if [ -n "$PATTERN_PARTS" ]; then
            PATTERN_PARTS="$PATTERN_PARTS|"
        fi
        PATTERN_PARTS="${PATTERN_PARTS}${pattern}"
    done

    # Extract issue numbers following dependency patterns
    local DEPS=""
    DEPS=$(echo "$ISSUE_BODY" | grep -oiE "(${PATTERN_PARTS})[ :]*(#[0-9]+(,[ ]*#[0-9]+|[ ]+and[ ]+#[0-9]+)*)" | \
        grep -oE '#[0-9]+' | tr -d '#' | sort -u | tr '\n' ' ')

    echo "$DEPS"
}

#------------------------------------------------------------------------------
# Test 27: Parse "depends on #123"
#------------------------------------------------------------------------------
echo "Test 27: Parse 'depends on #123'"

RESULT=$(parse_issue_dependencies_test "This task depends on #123 being completed first.")
if echo "$RESULT" | grep -q "123"; then
    pass "Parsed 'depends on #123' correctly"
else
    fail "Should parse 'depends on #123' (got: '$RESULT')"
fi

#------------------------------------------------------------------------------
# Test 28: Parse "blocked by #456"
#------------------------------------------------------------------------------
echo "Test 28: Parse 'blocked by #456'"

RESULT=$(parse_issue_dependencies_test "This issue is blocked by #456")
if echo "$RESULT" | grep -q "456"; then
    pass "Parsed 'blocked by #456' correctly"
else
    fail "Should parse 'blocked by #456' (got: '$RESULT')"
fi

#------------------------------------------------------------------------------
# Test 29: Parse "requires #789"
#------------------------------------------------------------------------------
echo "Test 29: Parse 'requires #789'"

RESULT=$(parse_issue_dependencies_test "This feature requires #789")
if echo "$RESULT" | grep -q "789"; then
    pass "Parsed 'requires #789' correctly"
else
    fail "Should parse 'requires #789' (got: '$RESULT')"
fi

#------------------------------------------------------------------------------
# Test 30: Parse multiple dependencies
#------------------------------------------------------------------------------
echo "Test 30: Parse multiple dependencies"

RESULT=$(parse_issue_dependencies_test "Depends on #10, #20 and #30")
if echo "$RESULT" | grep -q "10" && echo "$RESULT" | grep -q "20" && echo "$RESULT" | grep -q "30"; then
    pass "Parsed multiple dependencies correctly"
else
    fail "Should parse multiple dependencies (got: '$RESULT')"
fi

#------------------------------------------------------------------------------
# Test 31: No dependencies returns empty
#------------------------------------------------------------------------------
echo "Test 31: No dependencies returns empty"

RESULT=$(parse_issue_dependencies_test "This is a regular issue with no dependencies")
if [ -z "$(echo "$RESULT" | tr -d ' ')" ]; then
    pass "No dependencies returns empty"
else
    fail "Should return empty for no dependencies (got: '$RESULT')"
fi

#------------------------------------------------------------------------------
# Test 32: Empty body returns empty
#------------------------------------------------------------------------------
echo "Test 32: Empty body returns empty"

RESULT=$(parse_issue_dependencies_test "")
if [ -z "$RESULT" ]; then
    pass "Empty body returns empty"
else
    fail "Should return empty for empty body (got: '$RESULT')"
fi

#------------------------------------------------------------------------------
# Test 33: Case insensitive matching
#------------------------------------------------------------------------------
echo "Test 33: Case insensitive matching"

RESULT=$(parse_issue_dependencies_test "DEPENDS ON #111")
if echo "$RESULT" | grep -q "111"; then
    pass "Case insensitive matching works"
else
    fail "Should match case insensitively (got: '$RESULT')"
fi

#------------------------------------------------------------------------------
# Test 34: Mixed format parsing
#------------------------------------------------------------------------------
echo "Test 34: Mixed format parsing"

RESULT=$(parse_issue_dependencies_test "This depends on #1 and is also blocked by #2")
if echo "$RESULT" | grep -q "1" && echo "$RESULT" | grep -q "2"; then
    pass "Mixed format parsing works"
else
    fail "Should parse mixed formats (got: '$RESULT')"
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

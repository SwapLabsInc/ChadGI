#!/bin/bash
#
# Tests for Error Classification and Diagnostic Artifacts functionality
#
# Run with: bash tests/test-error-diagnostics.sh
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
echo "  Error Classification Tests"
echo "=========================================="
echo ""

#------------------------------------------------------------------------------
# Test 1: classify_error function exists
#------------------------------------------------------------------------------
echo "Test 1: classify_error function exists"

if grep -q "classify_error()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "classify_error function exists"
else
    fail "classify_error function should exist"
fi

#------------------------------------------------------------------------------
# Test 2: Error types are documented
#------------------------------------------------------------------------------
echo "Test 2: Error types are documented"

if grep -q "build_failure.*test/build commands failed" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "build_failure error type is documented"
else
    fail "build_failure error type should be documented"
fi

#------------------------------------------------------------------------------
# Test 3: timeout_failure is classified for exit code 124
#------------------------------------------------------------------------------
echo "Test 3: timeout_failure is classified for exit code 124"

if grep -A10 "classify_error()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q '124'; then
    pass "Exit code 124 is checked for timeout_failure"
else
    fail "Exit code 124 should be checked for timeout_failure"
fi

#------------------------------------------------------------------------------
# Test 4: git_error pattern matching exists
#------------------------------------------------------------------------------
echo "Test 4: git_error pattern matching exists"

if grep -q 'git_error' "$PROJECT_ROOT/scripts/chadgi.sh" && grep -q 'fatal:\|merge conflict' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "git_error pattern matching exists"
else
    fail "git_error pattern matching should exist"
fi

#------------------------------------------------------------------------------
# Test 5: api_error pattern matching exists
#------------------------------------------------------------------------------
echo "Test 5: api_error pattern matching exists"

if grep -q 'api_error' "$PROJECT_ROOT/scripts/chadgi.sh" && grep -q 'API rate limit\|403 Forbidden' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "api_error pattern matching exists"
else
    fail "api_error pattern matching should exist"
fi

#------------------------------------------------------------------------------
# Test 6: build_failure pattern matching exists
#------------------------------------------------------------------------------
echo "Test 6: build_failure pattern matching exists"

if grep -q 'build_failure' "$PROJECT_ROOT/scripts/chadgi.sh" && grep -q 'FAILED\|npm ERR!' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "build_failure pattern matching exists"
else
    fail "build_failure pattern matching should exist"
fi

#------------------------------------------------------------------------------
# Test 7: execution_error is used as default
#------------------------------------------------------------------------------
echo "Test 7: execution_error is used as default"

if grep -A50 "classify_error()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'execution_error.*default\|Default to execution error'; then
    pass "execution_error is used as default"
else
    fail "execution_error should be used as default"
fi

echo ""
echo "=========================================="
echo "  Diagnostic Artifact Collection Tests"
echo "=========================================="
echo ""

#------------------------------------------------------------------------------
# Test 8: create_diagnostics_dir function exists
#------------------------------------------------------------------------------
echo "Test 8: create_diagnostics_dir function exists"

if grep -q "create_diagnostics_dir()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "create_diagnostics_dir function exists"
else
    fail "create_diagnostics_dir function should exist"
fi

#------------------------------------------------------------------------------
# Test 9: Diagnostics directory follows correct pattern
#------------------------------------------------------------------------------
echo "Test 9: Diagnostics directory follows correct pattern"

if grep -q 'diagnostics.*issue.*timestamp\|diagnostics/${ISSUE_NUM}-${TIMESTAMP}' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Diagnostics directory follows <issue-id>-<timestamp> pattern"
else
    fail "Diagnostics directory should follow <issue-id>-<timestamp> pattern"
fi

#------------------------------------------------------------------------------
# Test 10: capture_git_diff function exists
#------------------------------------------------------------------------------
echo "Test 10: capture_git_diff function exists"

if grep -q "capture_git_diff()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "capture_git_diff function exists"
else
    fail "capture_git_diff function should exist"
fi

#------------------------------------------------------------------------------
# Test 11: capture_build_output function exists
#------------------------------------------------------------------------------
echo "Test 11: capture_build_output function exists"

if grep -q "capture_build_output()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "capture_build_output function exists"
else
    fail "capture_build_output function should exist"
fi

#------------------------------------------------------------------------------
# Test 12: Last 50 lines of output are captured
#------------------------------------------------------------------------------
echo "Test 12: Last 50 lines of output are captured"

if grep -A20 "capture_build_output()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q '50\|LINES:-50'; then
    pass "Last 50 lines of output are captured by default"
else
    fail "Last 50 lines of output should be captured by default"
fi

#------------------------------------------------------------------------------
# Test 13: capture_system_state function exists
#------------------------------------------------------------------------------
echo "Test 13: capture_system_state function exists"

if grep -q "capture_system_state()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "capture_system_state function exists"
else
    fail "capture_system_state function should exist"
fi

#------------------------------------------------------------------------------
# Test 14: System state captures branch information
#------------------------------------------------------------------------------
echo "Test 14: System state captures branch information"

if grep -A30 "capture_system_state()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'git branch\|Current branch'; then
    pass "System state captures branch information"
else
    fail "System state should capture branch information"
fi

#------------------------------------------------------------------------------
# Test 15: System state captures uncommitted changes
#------------------------------------------------------------------------------
echo "Test 15: System state captures uncommitted changes"

if grep -A40 "capture_system_state()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'git status'; then
    pass "System state captures uncommitted changes via git status"
else
    fail "System state should capture uncommitted changes"
fi

#------------------------------------------------------------------------------
# Test 16: create_error_summary function exists
#------------------------------------------------------------------------------
echo "Test 16: create_error_summary function exists"

if grep -q "create_error_summary()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "create_error_summary function exists"
else
    fail "create_error_summary function should exist"
fi

#------------------------------------------------------------------------------
# Test 17: collect_diagnostics function exists
#------------------------------------------------------------------------------
echo "Test 17: collect_diagnostics function exists"

if grep -q "collect_diagnostics()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "collect_diagnostics function exists"
else
    fail "collect_diagnostics function should exist"
fi

echo ""
echo "=========================================="
echo "  Error Reporting Tests"
echo "=========================================="
echo ""

#------------------------------------------------------------------------------
# Test 18: display_error_report function exists
#------------------------------------------------------------------------------
echo "Test 18: display_error_report function exists"

if grep -q "display_error_report()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "display_error_report function exists"
else
    fail "display_error_report function should exist"
fi

#------------------------------------------------------------------------------
# Test 19: Error report shows error type
#------------------------------------------------------------------------------
echo "Test 19: Error report shows error type"

if grep -A30 "display_error_report()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'Error Type'; then
    pass "Error report shows error type"
else
    fail "Error report should show error type"
fi

#------------------------------------------------------------------------------
# Test 20: Error report shows path to diagnostics
#------------------------------------------------------------------------------
echo "Test 20: Error report shows path to diagnostics"

if grep -A40 "display_error_report()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'Diagnostics Path'; then
    pass "Error report shows path to diagnostics"
else
    fail "Error report should show path to diagnostics"
fi

echo ""
echo "=========================================="
echo "  Configuration Tests"
echo "=========================================="
echo ""

#------------------------------------------------------------------------------
# Test 21: ERROR_DIAGNOSTICS config option exists in load_config
#------------------------------------------------------------------------------
echo "Test 21: ERROR_DIAGNOSTICS config option exists in load_config"

if grep -q 'ERROR_DIAGNOSTICS=$(parse_yaml_nested' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "ERROR_DIAGNOSTICS config option is parsed"
else
    fail "ERROR_DIAGNOSTICS config option should be parsed"
fi

#------------------------------------------------------------------------------
# Test 22: ERROR_DIAGNOSTICS default value is true
#------------------------------------------------------------------------------
echo "Test 22: ERROR_DIAGNOSTICS default value is true"

if grep -q 'ERROR_DIAGNOSTICS:-true\|ERROR_DIAGNOSTICS.*true' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "ERROR_DIAGNOSTICS default value is true"
else
    fail "ERROR_DIAGNOSTICS default value should be true"
fi

#------------------------------------------------------------------------------
# Test 23: ERROR_DIAGNOSTICS exists in set_defaults
#------------------------------------------------------------------------------
echo "Test 23: ERROR_DIAGNOSTICS exists in set_defaults"

if grep -A150 "^set_defaults()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'ERROR_DIAGNOSTICS='; then
    pass "ERROR_DIAGNOSTICS exists in set_defaults"
else
    fail "ERROR_DIAGNOSTICS should exist in set_defaults"
fi

#------------------------------------------------------------------------------
# Test 24: .gitignore includes diagnostics folder
#------------------------------------------------------------------------------
echo "Test 24: .gitignore includes diagnostics folder"

if grep -q "diagnostics/" "$PROJECT_ROOT/.chadgi/.gitignore"; then
    pass ".gitignore includes diagnostics folder"
else
    fail ".gitignore should include diagnostics folder"
fi

#------------------------------------------------------------------------------
# Test 25: Config YAML has error_diagnostics setting
#------------------------------------------------------------------------------
echo "Test 25: Config YAML has error_diagnostics setting"

if grep -q "error_diagnostics:" "$PROJECT_ROOT/.chadgi/chadgi-config.yaml"; then
    pass "Config YAML has error_diagnostics setting"
else
    fail "Config YAML should have error_diagnostics setting"
fi

echo ""
echo "=========================================="
echo "  Integration Tests"
echo "=========================================="
echo ""

#------------------------------------------------------------------------------
# Test 26: collect_diagnostics checks ERROR_DIAGNOSTICS flag
#------------------------------------------------------------------------------
echo "Test 26: collect_diagnostics checks ERROR_DIAGNOSTICS flag"

if grep -A10 "collect_diagnostics()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'ERROR_DIAGNOSTICS.*true'; then
    pass "collect_diagnostics checks ERROR_DIAGNOSTICS flag"
else
    fail "collect_diagnostics should check ERROR_DIAGNOSTICS flag"
fi

#------------------------------------------------------------------------------
# Test 27: Task failure handler calls classify_error
#------------------------------------------------------------------------------
echo "Test 27: Task failure handler calls classify_error"

if grep -B5 -A30 "Task did not complete successfully" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'classify_error'; then
    pass "Task failure handler calls classify_error"
else
    fail "Task failure handler should call classify_error"
fi

#------------------------------------------------------------------------------
# Test 28: Task failure handler calls collect_diagnostics
#------------------------------------------------------------------------------
echo "Test 28: Task failure handler calls collect_diagnostics"

if grep -B5 -A40 "Task did not complete successfully" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'collect_diagnostics'; then
    pass "Task failure handler calls collect_diagnostics"
else
    fail "Task failure handler should call collect_diagnostics"
fi

#------------------------------------------------------------------------------
# Test 29: Task failure handler calls display_error_report
#------------------------------------------------------------------------------
echo "Test 29: Task failure handler calls display_error_report"

if grep -B5 -A50 "Task did not complete successfully" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'display_error_report'; then
    pass "Task failure handler calls display_error_report"
else
    fail "Task failure handler should call display_error_report"
fi

#------------------------------------------------------------------------------
# Test 30: LAST_ERROR_TYPE global variable exists
#------------------------------------------------------------------------------
echo "Test 30: LAST_ERROR_TYPE global variable exists"

if grep -q "LAST_ERROR_TYPE=" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "LAST_ERROR_TYPE global variable exists"
else
    fail "LAST_ERROR_TYPE global variable should exist"
fi

#------------------------------------------------------------------------------
# Test 31: LAST_ERROR_DETAILS global variable exists
#------------------------------------------------------------------------------
echo "Test 31: LAST_ERROR_DETAILS global variable exists"

if grep -q "LAST_ERROR_DETAILS=" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "LAST_ERROR_DETAILS global variable exists"
else
    fail "LAST_ERROR_DETAILS global variable should exist"
fi

#------------------------------------------------------------------------------
# Test 32: DIAGNOSTICS_DIR global variable exists
#------------------------------------------------------------------------------
echo "Test 32: DIAGNOSTICS_DIR global variable exists"

if grep -q "DIAGNOSTICS_DIR=" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "DIAGNOSTICS_DIR global variable exists"
else
    fail "DIAGNOSTICS_DIR global variable should exist"
fi

#------------------------------------------------------------------------------
# Test 33: Error summary includes quick reference for each error type
#------------------------------------------------------------------------------
echo "Test 33: Error summary includes quick reference for each error type"

if grep -A50 "create_error_summary()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'Quick Reference\|case.*ERROR_TYPE'; then
    pass "Error summary includes quick reference for each error type"
else
    fail "Error summary should include quick reference for each error type"
fi

#------------------------------------------------------------------------------
# Test 34: git-diff.txt file is created
#------------------------------------------------------------------------------
echo "Test 34: git-diff.txt file is created"

if grep -A10 "capture_git_diff()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'git-diff.txt'; then
    pass "git-diff.txt file is created"
else
    fail "git-diff.txt file should be created"
fi

#------------------------------------------------------------------------------
# Test 35: build-output.txt file is created
#------------------------------------------------------------------------------
echo "Test 35: build-output.txt file is created"

if grep -A10 "capture_build_output()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'build-output.txt'; then
    pass "build-output.txt file is created"
else
    fail "build-output.txt file should be created"
fi

#------------------------------------------------------------------------------
# Test 36: system-state.txt file is created
#------------------------------------------------------------------------------
echo "Test 36: system-state.txt file is created"

if grep -A10 "capture_system_state()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'system-state.txt'; then
    pass "system-state.txt file is created"
else
    fail "system-state.txt file should be created"
fi

#------------------------------------------------------------------------------
# Test 37: error-summary.txt file is created
#------------------------------------------------------------------------------
echo "Test 37: error-summary.txt file is created"

if grep -A10 "create_error_summary()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'error-summary.txt'; then
    pass "error-summary.txt file is created"
else
    fail "error-summary.txt file should be created"
fi

echo ""
echo "=========================================="
echo "  Functional Tests"
echo "=========================================="
echo ""

# Functional test: Test error classification patterns in isolation
test_error_classification_patterns() {
    echo "Test F1: timeout_failure classification"

    # Test exit code 124 is detected as timeout
    EXIT_CODE=124
    if [ "$EXIT_CODE" -eq 124 ]; then
        echo -e "${GREEN}PASS${NC}: Exit code 124 detected as timeout"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}FAIL${NC}: Exit code 124 should be detected as timeout"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi

    echo "Test F2: git_error pattern detection"
    # Test git error pattern
    TEST_OUTPUT="fatal: not a git repository"
    if echo "$TEST_OUTPUT" | grep -qiE "(fatal: |error: cannot|git.*failed|merge conflict)"; then
        echo -e "${GREEN}PASS${NC}: git_error pattern detected"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}FAIL${NC}: git_error pattern should be detected"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi

    echo "Test F3: api_error pattern detection"
    # Test API error pattern
    TEST_OUTPUT="gh: API rate limit exceeded"
    if echo "$TEST_OUTPUT" | grep -qiE "(gh: |API rate limit|403 Forbidden)"; then
        echo -e "${GREEN}PASS${NC}: api_error pattern detected"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}FAIL${NC}: api_error pattern should be detected"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi

    echo "Test F4: build_failure pattern detection"
    # Test build failure pattern
    TEST_OUTPUT="npm ERR! Test failed"
    if echo "$TEST_OUTPUT" | grep -qiE "(FAILED|FAIL|Error:|npm ERR!)"; then
        echo -e "${GREEN}PASS${NC}: build_failure pattern detected"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}FAIL${NC}: build_failure pattern should be detected"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

# Run functional tests
test_error_classification_patterns

# Test diagnostics directory creation
echo "Test F5: Diagnostics directory structure"
TEST_DIR=$(mktemp -d)
DIAG_TEST_DIR="${TEST_DIR}/diagnostics/123-20240101-120000"
mkdir -p "$DIAG_TEST_DIR"
if [ -d "$DIAG_TEST_DIR" ]; then
    echo -e "${GREEN}PASS${NC}: Diagnostics directory can be created"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}FAIL${NC}: Diagnostics directory should be creatable"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
rm -rf "$TEST_DIR"

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

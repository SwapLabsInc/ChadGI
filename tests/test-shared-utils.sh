#!/bin/bash
#
# Tests for Shared Utilities Module
#
# Run with: bash tests/test-shared-utils.sh
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
echo "  Shared Utilities Tests"
echo "=========================================="
echo ""

#------------------------------------------------------------------------------
# Test 1: utils directory exists
#------------------------------------------------------------------------------
echo "Test 1: utils directory exists"

if [ -d "$PROJECT_ROOT/src/utils" ]; then
    pass "src/utils directory exists"
else
    fail "src/utils directory should exist"
fi

#------------------------------------------------------------------------------
# Test 2: types directory exists
#------------------------------------------------------------------------------
echo "Test 2: types directory exists"

if [ -d "$PROJECT_ROOT/src/types" ]; then
    pass "src/types directory exists"
else
    fail "src/types directory should exist"
fi

#------------------------------------------------------------------------------
# Test 3: colors.ts exists
#------------------------------------------------------------------------------
echo "Test 3: colors.ts exists"

if [ -f "$PROJECT_ROOT/src/utils/colors.ts" ]; then
    pass "src/utils/colors.ts exists"
else
    fail "src/utils/colors.ts should exist"
fi

#------------------------------------------------------------------------------
# Test 4: config.ts exists
#------------------------------------------------------------------------------
echo "Test 4: config.ts exists"

if [ -f "$PROJECT_ROOT/src/utils/config.ts" ]; then
    pass "src/utils/config.ts exists"
else
    fail "src/utils/config.ts should exist"
fi

#------------------------------------------------------------------------------
# Test 5: errors.ts exists
#------------------------------------------------------------------------------
echo "Test 5: errors.ts exists"

if [ -f "$PROJECT_ROOT/src/utils/errors.ts" ]; then
    pass "src/utils/errors.ts exists"
else
    fail "src/utils/errors.ts should exist"
fi

#------------------------------------------------------------------------------
# Test 6: github.ts exists
#------------------------------------------------------------------------------
echo "Test 6: github.ts exists"

if [ -f "$PROJECT_ROOT/src/utils/github.ts" ]; then
    pass "src/utils/github.ts exists"
else
    fail "src/utils/github.ts should exist"
fi

#------------------------------------------------------------------------------
# Test 7: formatting.ts exists
#------------------------------------------------------------------------------
echo "Test 7: formatting.ts exists"

if [ -f "$PROJECT_ROOT/src/utils/formatting.ts" ]; then
    pass "src/utils/formatting.ts exists"
else
    fail "src/utils/formatting.ts should exist"
fi

#------------------------------------------------------------------------------
# Test 8: data.ts exists
#------------------------------------------------------------------------------
echo "Test 8: data.ts exists"

if [ -f "$PROJECT_ROOT/src/utils/data.ts" ]; then
    pass "src/utils/data.ts exists"
else
    fail "src/utils/data.ts should exist"
fi

#------------------------------------------------------------------------------
# Test 9: types/index.ts exists
#------------------------------------------------------------------------------
echo "Test 9: types/index.ts exists"

if [ -f "$PROJECT_ROOT/src/types/index.ts" ]; then
    pass "src/types/index.ts exists"
else
    fail "src/types/index.ts should exist"
fi

#------------------------------------------------------------------------------
# Test 10: utils/index.ts exists
#------------------------------------------------------------------------------
echo "Test 10: utils/index.ts exists"

if [ -f "$PROJECT_ROOT/src/utils/index.ts" ]; then
    pass "src/utils/index.ts exists"
else
    fail "src/utils/index.ts should exist"
fi

#------------------------------------------------------------------------------
# Test 11: colors.ts exports colors object
#------------------------------------------------------------------------------
echo "Test 11: colors.ts exports colors object"

if grep -q "export const colors" "$PROJECT_ROOT/src/utils/colors.ts"; then
    pass "colors object is exported"
else
    fail "colors object should be exported"
fi

#------------------------------------------------------------------------------
# Test 12: colors.ts has reset color
#------------------------------------------------------------------------------
echo "Test 12: colors.ts has reset color"

if grep -q "reset:" "$PROJECT_ROOT/src/utils/colors.ts"; then
    pass "reset color defined"
else
    fail "reset color should be defined"
fi

#------------------------------------------------------------------------------
# Test 13: colors.ts has common colors
#------------------------------------------------------------------------------
echo "Test 13: colors.ts has common colors (red, green, yellow)"

if grep -q "red:" "$PROJECT_ROOT/src/utils/colors.ts" && \
   grep -q "green:" "$PROJECT_ROOT/src/utils/colors.ts" && \
   grep -q "yellow:" "$PROJECT_ROOT/src/utils/colors.ts"; then
    pass "common colors defined"
else
    fail "common colors (red, green, yellow) should be defined"
fi

#------------------------------------------------------------------------------
# Test 14: config.ts exports parseYamlValue
#------------------------------------------------------------------------------
echo "Test 14: config.ts exports parseYamlValue"

if grep -q "export function parseYamlValue" "$PROJECT_ROOT/src/utils/config.ts"; then
    pass "parseYamlValue function is exported"
else
    fail "parseYamlValue function should be exported"
fi

#------------------------------------------------------------------------------
# Test 15: config.ts exports parseYamlNested
#------------------------------------------------------------------------------
echo "Test 15: config.ts exports parseYamlNested"

if grep -q "export function parseYamlNested" "$PROJECT_ROOT/src/utils/config.ts"; then
    pass "parseYamlNested function is exported"
else
    fail "parseYamlNested function should be exported"
fi

#------------------------------------------------------------------------------
# Test 16: config.ts exports parseYamlBoolean
#------------------------------------------------------------------------------
echo "Test 16: config.ts exports parseYamlBoolean"

if grep -q "export function parseYamlBoolean" "$PROJECT_ROOT/src/utils/config.ts"; then
    pass "parseYamlBoolean function is exported"
else
    fail "parseYamlBoolean function should be exported"
fi

#------------------------------------------------------------------------------
# Test 17: config.ts exports resolveConfigPath
#------------------------------------------------------------------------------
echo "Test 17: config.ts exports resolveConfigPath"

if grep -q "export function resolveConfigPath" "$PROJECT_ROOT/src/utils/config.ts"; then
    pass "resolveConfigPath function is exported"
else
    fail "resolveConfigPath function should be exported"
fi

#------------------------------------------------------------------------------
# Test 18: config.ts exports loadConfig
#------------------------------------------------------------------------------
echo "Test 18: config.ts exports loadConfig"

if grep -q "export function loadConfig" "$PROJECT_ROOT/src/utils/config.ts"; then
    pass "loadConfig function is exported"
else
    fail "loadConfig function should be exported"
fi

#------------------------------------------------------------------------------
# Test 19: errors.ts exports ChadGIError base class
#------------------------------------------------------------------------------
echo "Test 19: errors.ts exports ChadGIError base class"

if grep -q "export class ChadGIError" "$PROJECT_ROOT/src/utils/errors.ts"; then
    pass "ChadGIError base class is exported"
else
    fail "ChadGIError base class should be exported"
fi

#------------------------------------------------------------------------------
# Test 20: errors.ts exports ConfigError
#------------------------------------------------------------------------------
echo "Test 20: errors.ts exports ConfigError"

if grep -q "export class ConfigError" "$PROJECT_ROOT/src/utils/errors.ts"; then
    pass "ConfigError class is exported"
else
    fail "ConfigError class should be exported"
fi

#------------------------------------------------------------------------------
# Test 21: errors.ts exports GitHubError
#------------------------------------------------------------------------------
echo "Test 21: errors.ts exports GitHubError"

if grep -q "export class GitHubError" "$PROJECT_ROOT/src/utils/errors.ts"; then
    pass "GitHubError class is exported"
else
    fail "GitHubError class should be exported"
fi

#------------------------------------------------------------------------------
# Test 22: errors.ts exports ValidationError
#------------------------------------------------------------------------------
echo "Test 22: errors.ts exports ValidationError"

if grep -q "export class ValidationError" "$PROJECT_ROOT/src/utils/errors.ts"; then
    pass "ValidationError class is exported"
else
    fail "ValidationError class should be exported"
fi

#------------------------------------------------------------------------------
# Test 23: github.ts exports fetchIssue
#------------------------------------------------------------------------------
echo "Test 23: github.ts exports fetchIssue"

if grep -q "export function fetchIssue" "$PROJECT_ROOT/src/utils/github.ts"; then
    pass "fetchIssue function is exported"
else
    fail "fetchIssue function should be exported"
fi

#------------------------------------------------------------------------------
# Test 24: github.ts exports fetchIssueLabels
#------------------------------------------------------------------------------
echo "Test 24: github.ts exports fetchIssueLabels"

if grep -q "export function fetchIssueLabels" "$PROJECT_ROOT/src/utils/github.ts"; then
    pass "fetchIssueLabels function is exported"
else
    fail "fetchIssueLabels function should be exported"
fi

#------------------------------------------------------------------------------
# Test 25: github.ts exports fetchPrUrl
#------------------------------------------------------------------------------
echo "Test 25: github.ts exports fetchPrUrl"

if grep -q "export function fetchPrUrl" "$PROJECT_ROOT/src/utils/github.ts"; then
    pass "fetchPrUrl function is exported"
else
    fail "fetchPrUrl function should be exported"
fi

#------------------------------------------------------------------------------
# Test 26: github.ts exports fetchProjectItems
#------------------------------------------------------------------------------
echo "Test 26: github.ts exports fetchProjectItems"

if grep -q "export function fetchProjectItems" "$PROJECT_ROOT/src/utils/github.ts"; then
    pass "fetchProjectItems function is exported"
else
    fail "fetchProjectItems function should be exported"
fi

#------------------------------------------------------------------------------
# Test 27: github.ts exports fetchRateLimit
#------------------------------------------------------------------------------
echo "Test 27: github.ts exports fetchRateLimit"

if grep -q "export function fetchRateLimit" "$PROJECT_ROOT/src/utils/github.ts"; then
    pass "fetchRateLimit function is exported"
else
    fail "fetchRateLimit function should be exported"
fi

#------------------------------------------------------------------------------
# Test 28: formatting.ts exports formatDuration
#------------------------------------------------------------------------------
echo "Test 28: formatting.ts exports formatDuration"

if grep -q "export function formatDuration" "$PROJECT_ROOT/src/utils/formatting.ts"; then
    pass "formatDuration function is exported"
else
    fail "formatDuration function should be exported"
fi

#------------------------------------------------------------------------------
# Test 29: formatting.ts exports formatDate
#------------------------------------------------------------------------------
echo "Test 29: formatting.ts exports formatDate"

if grep -q "export function formatDate" "$PROJECT_ROOT/src/utils/formatting.ts"; then
    pass "formatDate function is exported"
else
    fail "formatDate function should be exported"
fi

#------------------------------------------------------------------------------
# Test 30: formatting.ts exports formatCost
#------------------------------------------------------------------------------
echo "Test 30: formatting.ts exports formatCost"

if grep -q "export function formatCost" "$PROJECT_ROOT/src/utils/formatting.ts"; then
    pass "formatCost function is exported"
else
    fail "formatCost function should be exported"
fi

#------------------------------------------------------------------------------
# Test 31: formatting.ts exports parseSince
#------------------------------------------------------------------------------
echo "Test 31: formatting.ts exports parseSince"

if grep -q "export function parseSince" "$PROJECT_ROOT/src/utils/formatting.ts"; then
    pass "parseSince function is exported"
else
    fail "parseSince function should be exported"
fi

#------------------------------------------------------------------------------
# Test 32: formatting.ts exports truncate
#------------------------------------------------------------------------------
echo "Test 32: formatting.ts exports truncate"

if grep -q "export function truncate" "$PROJECT_ROOT/src/utils/formatting.ts"; then
    pass "truncate function is exported"
else
    fail "truncate function should be exported"
fi

#------------------------------------------------------------------------------
# Test 33: data.ts exports loadSessionStats
#------------------------------------------------------------------------------
echo "Test 33: data.ts exports loadSessionStats"

if grep -q "export function loadSessionStats" "$PROJECT_ROOT/src/utils/data.ts"; then
    pass "loadSessionStats function is exported"
else
    fail "loadSessionStats function should be exported"
fi

#------------------------------------------------------------------------------
# Test 34: data.ts exports loadTaskMetrics
#------------------------------------------------------------------------------
echo "Test 34: data.ts exports loadTaskMetrics"

if grep -q "export function loadTaskMetrics" "$PROJECT_ROOT/src/utils/data.ts"; then
    pass "loadTaskMetrics function is exported"
else
    fail "loadTaskMetrics function should be exported"
fi

#------------------------------------------------------------------------------
# Test 35: data.ts exports loadProgressData
#------------------------------------------------------------------------------
echo "Test 35: data.ts exports loadProgressData"

if grep -q "export function loadProgressData" "$PROJECT_ROOT/src/utils/data.ts"; then
    pass "loadProgressData function is exported"
else
    fail "loadProgressData function should be exported"
fi

#------------------------------------------------------------------------------
# Test 36: data.ts exports loadPauseLock
#------------------------------------------------------------------------------
echo "Test 36: data.ts exports loadPauseLock"

if grep -q "export function loadPauseLock" "$PROJECT_ROOT/src/utils/data.ts"; then
    pass "loadPauseLock function is exported"
else
    fail "loadPauseLock function should be exported"
fi

#------------------------------------------------------------------------------
# Test 37: types/index.ts exports TaskMetrics
#------------------------------------------------------------------------------
echo "Test 37: types/index.ts exports TaskMetrics"

if grep -q "export interface TaskMetrics" "$PROJECT_ROOT/src/types/index.ts"; then
    pass "TaskMetrics interface is exported"
else
    fail "TaskMetrics interface should be exported"
fi

#------------------------------------------------------------------------------
# Test 38: types/index.ts exports SessionStats
#------------------------------------------------------------------------------
echo "Test 38: types/index.ts exports SessionStats"

if grep -q "export interface SessionStats" "$PROJECT_ROOT/src/types/index.ts"; then
    pass "SessionStats interface is exported"
else
    fail "SessionStats interface should be exported"
fi

#------------------------------------------------------------------------------
# Test 39: types/index.ts exports HistoryEntry
#------------------------------------------------------------------------------
echo "Test 39: types/index.ts exports HistoryEntry"

if grep -q "export interface HistoryEntry" "$PROJECT_ROOT/src/types/index.ts"; then
    pass "HistoryEntry interface is exported"
else
    fail "HistoryEntry interface should be exported"
fi

#------------------------------------------------------------------------------
# Test 40: types/index.ts exports ProgressData
#------------------------------------------------------------------------------
echo "Test 40: types/index.ts exports ProgressData"

if grep -q "export interface ProgressData" "$PROJECT_ROOT/src/types/index.ts"; then
    pass "ProgressData interface is exported"
else
    fail "ProgressData interface should be exported"
fi

#------------------------------------------------------------------------------
# Test 41: types/index.ts exports QueueTask
#------------------------------------------------------------------------------
echo "Test 41: types/index.ts exports QueueTask"

if grep -q "export interface QueueTask" "$PROJECT_ROOT/src/types/index.ts"; then
    pass "QueueTask interface is exported"
else
    fail "QueueTask interface should be exported"
fi

#------------------------------------------------------------------------------
# Test 42: types/index.ts exports HealthCheck
#------------------------------------------------------------------------------
echo "Test 42: types/index.ts exports HealthCheck"

if grep -q "export interface HealthCheck" "$PROJECT_ROOT/src/types/index.ts"; then
    pass "HealthCheck interface is exported"
else
    fail "HealthCheck interface should be exported"
fi

#------------------------------------------------------------------------------
# Test 43: types/index.ts exports StatusInfo
#------------------------------------------------------------------------------
echo "Test 43: types/index.ts exports StatusInfo"

if grep -q "export interface StatusInfo" "$PROJECT_ROOT/src/types/index.ts"; then
    pass "StatusInfo interface is exported"
else
    fail "StatusInfo interface should be exported"
fi

#------------------------------------------------------------------------------
# Test 44: history.ts imports from shared utilities
#------------------------------------------------------------------------------
echo "Test 44: history.ts imports from shared utilities"

if grep -q "import.*from '\./utils/" "$PROJECT_ROOT/src/history.ts"; then
    pass "history.ts imports from shared utilities"
else
    fail "history.ts should import from shared utilities"
fi

#------------------------------------------------------------------------------
# Test 45: status.ts imports from shared utilities
#------------------------------------------------------------------------------
echo "Test 45: status.ts imports from shared utilities"

if grep -q "import.*from '\./utils/" "$PROJECT_ROOT/src/status.ts"; then
    pass "status.ts imports from shared utilities"
else
    fail "status.ts should import from shared utilities"
fi

#------------------------------------------------------------------------------
# Test 46: Project compiles successfully
#------------------------------------------------------------------------------
echo "Test 46: Project compiles successfully"

cd "$PROJECT_ROOT"
if npm run build > /dev/null 2>&1; then
    pass "Project compiles without errors"
else
    fail "Project should compile without errors"
fi

#------------------------------------------------------------------------------
# Test 47: errors.ts exports GitError
#------------------------------------------------------------------------------
echo "Test 47: errors.ts exports GitError"

if grep -q "export class GitError" "$PROJECT_ROOT/src/utils/errors.ts"; then
    pass "GitError class is exported"
else
    fail "GitError class should be exported"
fi

#------------------------------------------------------------------------------
# Test 48: errors.ts exports NotInitializedError
#------------------------------------------------------------------------------
echo "Test 48: errors.ts exports NotInitializedError"

if grep -q "export class NotInitializedError" "$PROJECT_ROOT/src/utils/errors.ts"; then
    pass "NotInitializedError class is exported"
else
    fail "NotInitializedError class should be exported"
fi

#------------------------------------------------------------------------------
# Test 49: formatting.ts exports formatRelativeTime
#------------------------------------------------------------------------------
echo "Test 49: formatting.ts exports formatRelativeTime"

if grep -q "export function formatRelativeTime" "$PROJECT_ROOT/src/utils/formatting.ts"; then
    pass "formatRelativeTime function is exported"
else
    fail "formatRelativeTime function should be exported"
fi

#------------------------------------------------------------------------------
# Test 50: data.ts exports findPendingApproval
#------------------------------------------------------------------------------
echo "Test 50: data.ts exports findPendingApproval"

if grep -q "export function findPendingApproval" "$PROJECT_ROOT/src/utils/data.ts"; then
    pass "findPendingApproval function is exported"
else
    fail "findPendingApproval function should be exported"
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

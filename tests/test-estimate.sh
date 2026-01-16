#!/bin/bash
#
# Tests for Estimate command functionality
#
# Run with: bash tests/test-estimate.sh
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
echo "  Estimate Command Tests"
echo "=========================================="
echo ""

#------------------------------------------------------------------------------
# Test 1: estimate.ts file exists
#------------------------------------------------------------------------------
echo "Test 1: estimate.ts file exists"

if [ -f "$PROJECT_ROOT/src/estimate.ts" ]; then
    pass "estimate.ts file exists"
else
    fail "estimate.ts should exist"
fi

#------------------------------------------------------------------------------
# Test 2: CLI has estimate command
#------------------------------------------------------------------------------
echo "Test 2: CLI has estimate command"

if grep -q "command('estimate')" "$PROJECT_ROOT/src/cli.ts"; then
    pass "estimate command exists in CLI"
else
    fail "estimate command should exist in CLI"
fi

#------------------------------------------------------------------------------
# Test 3: CLI imports estimate module
#------------------------------------------------------------------------------
echo "Test 3: CLI imports estimate module"

if grep -q "import { estimate }" "$PROJECT_ROOT/src/cli.ts"; then
    pass "estimate module imported in CLI"
else
    fail "estimate module should be imported in CLI"
fi

#------------------------------------------------------------------------------
# Test 4: estimate command has --json option
#------------------------------------------------------------------------------
echo "Test 4: estimate command has --json option"

if grep -A10 "command('estimate')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-json"; then
    pass "--json option exists for estimate command"
else
    fail "estimate command should have --json option"
fi

#------------------------------------------------------------------------------
# Test 5: estimate command has --budget option
#------------------------------------------------------------------------------
echo "Test 5: estimate command has --budget option"

if grep -A10 "command('estimate')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-budget"; then
    pass "--budget option exists for estimate command"
else
    fail "estimate command should have --budget option"
fi

#------------------------------------------------------------------------------
# Test 6: estimate command has --days option
#------------------------------------------------------------------------------
echo "Test 6: estimate command has --days option"

if grep -A10 "command('estimate')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-days"; then
    pass "--days option exists for estimate command"
else
    fail "estimate command should have --days option"
fi

#------------------------------------------------------------------------------
# Test 7: estimate command has --category option
#------------------------------------------------------------------------------
echo "Test 7: estimate command has --category option"

if grep -A10 "command('estimate')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-category"; then
    pass "--category option exists for estimate command"
else
    fail "estimate command should have --category option"
fi

#------------------------------------------------------------------------------
# Test 8: estimate.ts exports estimate function
#------------------------------------------------------------------------------
echo "Test 8: estimate.ts exports estimate function"

if grep -q 'export async function estimate' "$PROJECT_ROOT/src/estimate.ts"; then
    pass "estimate function is exported"
else
    fail "estimate function should be exported"
fi

#------------------------------------------------------------------------------
# Test 9: estimate.ts handles JSON output
#------------------------------------------------------------------------------
echo "Test 9: estimate.ts handles JSON output"

if grep -q 'options.json' "$PROJECT_ROOT/src/estimate.ts"; then
    pass "JSON output is handled"
else
    fail "estimate should handle JSON output"
fi

#------------------------------------------------------------------------------
# Test 10: estimate.ts handles budget option
#------------------------------------------------------------------------------
echo "Test 10: estimate.ts handles budget option"

if grep -q 'options.budget' "$PROJECT_ROOT/src/estimate.ts"; then
    pass "Budget option is handled"
else
    fail "estimate should handle budget option"
fi

#------------------------------------------------------------------------------
# Test 11: estimate.ts reads metrics file
#------------------------------------------------------------------------------
echo "Test 11: estimate.ts reads metrics file"

if grep -q 'chadgi-metrics.json' "$PROJECT_ROOT/src/estimate.ts"; then
    pass "Metrics file is read"
else
    fail "estimate should read chadgi-metrics.json"
fi

#------------------------------------------------------------------------------
# Test 12: estimate.ts reads stats file
#------------------------------------------------------------------------------
echo "Test 12: estimate.ts reads stats file"

if grep -q 'chadgi-stats.json' "$PROJECT_ROOT/src/estimate.ts"; then
    pass "Stats file is read"
else
    fail "estimate should read chadgi-stats.json"
fi

#------------------------------------------------------------------------------
# Test 13: estimate.ts has default cost estimates
#------------------------------------------------------------------------------
echo "Test 13: estimate.ts has default cost estimates"

if grep -q 'DEFAULT_ESTIMATES' "$PROJECT_ROOT/src/estimate.ts"; then
    pass "Default cost estimates exist"
else
    fail "estimate should have default cost estimates"
fi

#------------------------------------------------------------------------------
# Test 14: estimate.ts has default duration estimates
#------------------------------------------------------------------------------
echo "Test 14: estimate.ts has default duration estimates"

if grep -q 'DEFAULT_DURATION_ESTIMATES' "$PROJECT_ROOT/src/estimate.ts"; then
    pass "Default duration estimates exist"
else
    fail "estimate should have default duration estimates"
fi

#------------------------------------------------------------------------------
# Test 15: estimate.ts calculates category-based estimates
#------------------------------------------------------------------------------
echo "Test 15: estimate.ts calculates category-based estimates"

if grep -q 'calculateCategoryEstimates' "$PROJECT_ROOT/src/estimate.ts"; then
    pass "Category-based estimates are calculated"
else
    fail "estimate should calculate category-based estimates"
fi

#------------------------------------------------------------------------------
# Test 16: estimate.ts calculates overall estimates
#------------------------------------------------------------------------------
echo "Test 16: estimate.ts calculates overall estimates"

if grep -q 'calculateOverallEstimate' "$PROJECT_ROOT/src/estimate.ts"; then
    pass "Overall estimates are calculated"
else
    fail "estimate should calculate overall estimates"
fi

#------------------------------------------------------------------------------
# Test 17: estimate.ts queries GitHub for ready tasks
#------------------------------------------------------------------------------
echo "Test 17: estimate.ts queries GitHub for ready tasks"

if grep -q 'getReadyTasks' "$PROJECT_ROOT/src/estimate.ts"; then
    pass "Ready tasks are queried from GitHub"
else
    fail "estimate should query ready tasks from GitHub"
fi

#------------------------------------------------------------------------------
# Test 18: estimate.ts uses gh project item-list
#------------------------------------------------------------------------------
echo "Test 18: estimate.ts uses gh project item-list"

if grep -q 'gh project item-list' "$PROJECT_ROOT/src/estimate.ts"; then
    pass "Uses gh project item-list command"
else
    fail "estimate should use gh project item-list"
fi

#------------------------------------------------------------------------------
# Test 19: estimate.ts calculates confidence levels
#------------------------------------------------------------------------------
echo "Test 19: estimate.ts calculates confidence levels"

if grep -q 'confidenceLevel' "$PROJECT_ROOT/src/estimate.ts"; then
    pass "Confidence levels are calculated"
else
    fail "estimate should calculate confidence levels"
fi

#------------------------------------------------------------------------------
# Test 20: estimate.ts calculates standard deviation
#------------------------------------------------------------------------------
echo "Test 20: estimate.ts calculates standard deviation"

if grep -q 'calculateStdDev\|stdDevCost' "$PROJECT_ROOT/src/estimate.ts"; then
    pass "Standard deviation is calculated"
else
    fail "estimate should calculate standard deviation for confidence intervals"
fi

#------------------------------------------------------------------------------
# Test 21: estimate.ts supports task categorization
#------------------------------------------------------------------------------
echo "Test 21: estimate.ts supports task categorization"

if grep -q 'categoryBreakdown' "$PROJECT_ROOT/src/estimate.ts"; then
    pass "Task categorization is supported"
else
    fail "estimate should support task categorization"
fi

#------------------------------------------------------------------------------
# Test 22: estimate.ts handles category filter
#------------------------------------------------------------------------------
echo "Test 22: estimate.ts handles category filter"

if grep -q 'options.category' "$PROJECT_ROOT/src/estimate.ts"; then
    pass "Category filter is handled"
else
    fail "estimate should handle category filter option"
fi

#------------------------------------------------------------------------------
# Test 23: estimate.ts handles days filter
#------------------------------------------------------------------------------
echo "Test 23: estimate.ts handles days filter"

if grep -q 'options.days' "$PROJECT_ROOT/src/estimate.ts"; then
    pass "Days filter is handled"
else
    fail "estimate should handle days filter option"
fi

#------------------------------------------------------------------------------
# Test 24: estimate.ts calculates min/max cost ranges
#------------------------------------------------------------------------------
echo "Test 24: estimate.ts calculates min/max cost ranges"

if grep -q 'minCost' "$PROJECT_ROOT/src/estimate.ts" && grep -q 'maxCost' "$PROJECT_ROOT/src/estimate.ts"; then
    pass "Min/max cost ranges are calculated"
else
    fail "estimate should calculate min/max cost ranges"
fi

#------------------------------------------------------------------------------
# Test 25: estimate.ts calculates tasks within budget
#------------------------------------------------------------------------------
echo "Test 25: estimate.ts calculates tasks within budget"

if grep -q 'tasksWithinBudget' "$PROJECT_ROOT/src/estimate.ts"; then
    pass "Tasks within budget are calculated"
else
    fail "estimate should calculate tasks within budget"
fi

#------------------------------------------------------------------------------
# Test 26: estimate.ts parses config file for GitHub settings
#------------------------------------------------------------------------------
echo "Test 26: estimate.ts parses config file for GitHub settings"

if grep -q 'parseYamlNested' "$PROJECT_ROOT/src/estimate.ts"; then
    pass "Config file parsing is implemented"
else
    fail "estimate should parse config file for GitHub settings"
fi

#------------------------------------------------------------------------------
# Test 27: estimate.ts has EstimateResult interface
#------------------------------------------------------------------------------
echo "Test 27: estimate.ts has EstimateResult interface"

if grep -q 'interface EstimateResult' "$PROJECT_ROOT/src/estimate.ts"; then
    pass "EstimateResult interface exists"
else
    fail "estimate should have EstimateResult interface"
fi

#------------------------------------------------------------------------------
# Test 28: estimate.ts has TaskEstimate interface
#------------------------------------------------------------------------------
echo "Test 28: estimate.ts has TaskEstimate interface"

if grep -q 'interface TaskEstimate' "$PROJECT_ROOT/src/estimate.ts"; then
    pass "TaskEstimate interface exists"
else
    fail "estimate should have TaskEstimate interface"
fi

#------------------------------------------------------------------------------
# Test 29: estimate.ts includes expected cost in output
#------------------------------------------------------------------------------
echo "Test 29: estimate.ts includes expected cost in output"

if grep -q 'expectedCost' "$PROJECT_ROOT/src/estimate.ts"; then
    pass "Expected cost is included"
else
    fail "estimate should include expected cost"
fi

#------------------------------------------------------------------------------
# Test 30: estimate.ts uses historical sample size
#------------------------------------------------------------------------------
echo "Test 30: estimate.ts uses historical sample size"

if grep -q 'historicalSampleSize' "$PROJECT_ROOT/src/estimate.ts"; then
    pass "Historical sample size is used"
else
    fail "estimate should use historical sample size"
fi

#------------------------------------------------------------------------------
# Test 31: estimate.ts handles feature category
#------------------------------------------------------------------------------
echo "Test 31: estimate.ts handles feature category"

if grep -q "feature" "$PROJECT_ROOT/src/estimate.ts"; then
    pass "Feature category is handled"
else
    fail "estimate should handle feature category"
fi

#------------------------------------------------------------------------------
# Test 32: estimate.ts handles bug category
#------------------------------------------------------------------------------
echo "Test 32: estimate.ts handles bug category"

if grep -q "bug" "$PROJECT_ROOT/src/estimate.ts"; then
    pass "Bug category is handled"
else
    fail "estimate should handle bug category"
fi

#------------------------------------------------------------------------------
# Test 33: estimate.ts handles refactor category
#------------------------------------------------------------------------------
echo "Test 33: estimate.ts handles refactor category"

if grep -q "refactor" "$PROJECT_ROOT/src/estimate.ts"; then
    pass "Refactor category is handled"
else
    fail "estimate should handle refactor category"
fi

#------------------------------------------------------------------------------
# Test 34: estimate.ts fetches issue labels for category detection
#------------------------------------------------------------------------------
echo "Test 34: estimate.ts fetches issue labels for category detection"

if grep -q 'gh issue view' "$PROJECT_ROOT/src/estimate.ts"; then
    pass "Issue labels are fetched for category detection"
else
    fail "estimate should fetch issue labels for category detection"
fi

#------------------------------------------------------------------------------
# Test 35: estimate.ts uses body length as complexity heuristic
#------------------------------------------------------------------------------
echo "Test 35: estimate.ts uses body length as complexity heuristic"

if grep -q 'bodyLength' "$PROJECT_ROOT/src/estimate.ts"; then
    pass "Body length is used as complexity heuristic"
else
    fail "estimate should use body length as complexity heuristic"
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

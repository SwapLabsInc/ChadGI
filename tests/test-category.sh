#!/bin/bash
#
# Tests for Task Categorization functionality
#
# Run with: bash tests/test-category.sh
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
echo "  Task Categorization Tests"
echo "=========================================="
echo ""

#------------------------------------------------------------------------------
# Test 1: Category config exists in template
#------------------------------------------------------------------------------
echo "Test 1: Category config exists in template"

if grep -q "^category:" "$PROJECT_ROOT/templates/chadgi-config.yaml"; then
    pass "category section exists in template config"
else
    fail "category section should exist in template config"
fi

#------------------------------------------------------------------------------
# Test 2: Category enabled option exists
#------------------------------------------------------------------------------
echo "Test 2: Category enabled option exists"

if grep -q "enabled:" "$PROJECT_ROOT/templates/chadgi-config.yaml" | grep -A1 "^category:" | grep -q "enabled"; then
    pass "category enabled option exists"
else
    # Alternative check
    if grep -A5 "^category:" "$PROJECT_ROOT/templates/chadgi-config.yaml" | grep -q "enabled:"; then
        pass "category enabled option exists"
    else
        fail "category enabled option should exist"
    fi
fi

#------------------------------------------------------------------------------
# Test 3: Category mappings section exists
#------------------------------------------------------------------------------
echo "Test 3: Category mappings section exists"

if grep -A10 "^category:" "$PROJECT_ROOT/templates/chadgi-config.yaml" | grep -q "mappings:"; then
    pass "category mappings section exists"
else
    fail "category mappings section should exist"
fi

#------------------------------------------------------------------------------
# Test 4: Bug category mapping exists
#------------------------------------------------------------------------------
echo "Test 4: Bug category mapping exists"

if grep -A20 "^category:" "$PROJECT_ROOT/templates/chadgi-config.yaml" | grep -q "bug:"; then
    pass "bug category mapping exists"
else
    fail "bug category mapping should exist"
fi

#------------------------------------------------------------------------------
# Test 5: Feature category mapping exists
#------------------------------------------------------------------------------
echo "Test 5: Feature category mapping exists"

if grep -A20 "^category:" "$PROJECT_ROOT/templates/chadgi-config.yaml" | grep -q "feature:"; then
    pass "feature category mapping exists"
else
    fail "feature category mapping should exist"
fi

#------------------------------------------------------------------------------
# Test 6: Refactor category mapping exists
#------------------------------------------------------------------------------
echo "Test 6: Refactor category mapping exists"

if grep -A20 "^category:" "$PROJECT_ROOT/templates/chadgi-config.yaml" | grep -q "refactor:"; then
    pass "refactor category mapping exists"
else
    fail "refactor category mapping should exist"
fi

#------------------------------------------------------------------------------
# Test 7: parse_category_mappings function exists in chadgi.sh
#------------------------------------------------------------------------------
echo "Test 7: parse_category_mappings function exists in chadgi.sh"

if grep -q "parse_category_mappings()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "parse_category_mappings function exists"
else
    fail "parse_category_mappings function should exist"
fi

#------------------------------------------------------------------------------
# Test 8: parse_category_mappings_merged function exists in chadgi.sh
#------------------------------------------------------------------------------
echo "Test 8: parse_category_mappings_merged function exists in chadgi.sh"

if grep -q "parse_category_mappings_merged()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "parse_category_mappings_merged function exists"
else
    fail "parse_category_mappings_merged function should exist"
fi

#------------------------------------------------------------------------------
# Test 9: get_issue_category function exists in chadgi.sh
#------------------------------------------------------------------------------
echo "Test 9: get_issue_category function exists in chadgi.sh"

if grep -q "get_issue_category()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "get_issue_category function exists"
else
    fail "get_issue_category function should exist"
fi

#------------------------------------------------------------------------------
# Test 10: CATEGORY_ENABLED variable is loaded
#------------------------------------------------------------------------------
echo "Test 10: CATEGORY_ENABLED variable is loaded"

if grep -q 'CATEGORY_ENABLED=' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "CATEGORY_ENABLED variable is loaded"
else
    fail "CATEGORY_ENABLED variable should be loaded"
fi

#------------------------------------------------------------------------------
# Test 11: CATEGORY_LABELS_BUG variable is loaded
#------------------------------------------------------------------------------
echo "Test 11: CATEGORY_LABELS_BUG variable is loaded"

if grep -q 'CATEGORY_LABELS_BUG=' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "CATEGORY_LABELS_BUG variable is loaded"
else
    fail "CATEGORY_LABELS_BUG variable should be loaded"
fi

#------------------------------------------------------------------------------
# Test 12: CATEGORY_LABELS_FEATURE variable is loaded
#------------------------------------------------------------------------------
echo "Test 12: CATEGORY_LABELS_FEATURE variable is loaded"

if grep -q 'CATEGORY_LABELS_FEATURE=' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "CATEGORY_LABELS_FEATURE variable is loaded"
else
    fail "CATEGORY_LABELS_FEATURE variable should be loaded"
fi

#------------------------------------------------------------------------------
# Test 13: CURRENT_TASK_CATEGORY variable is set
#------------------------------------------------------------------------------
echo "Test 13: CURRENT_TASK_CATEGORY variable is set"

if grep -q 'CURRENT_TASK_CATEGORY=' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "CURRENT_TASK_CATEGORY variable is set"
else
    fail "CURRENT_TASK_CATEGORY variable should be set"
fi

#------------------------------------------------------------------------------
# Test 14: Category is stored in metrics JSON
#------------------------------------------------------------------------------
echo "Test 14: Category is stored in metrics JSON"

if grep -q '"category":' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "category field is stored in metrics JSON"
else
    fail "category field should be stored in metrics JSON"
fi

#------------------------------------------------------------------------------
# Test 15: TaskMetrics interface includes category field
#------------------------------------------------------------------------------
echo "Test 15: TaskMetrics interface includes category field"

if grep -q "category?: string" "$PROJECT_ROOT/src/insights.ts"; then
    pass "TaskMetrics interface includes category field"
else
    fail "TaskMetrics interface should include category field"
fi

#------------------------------------------------------------------------------
# Test 16: CategoryStats interface exists
#------------------------------------------------------------------------------
echo "Test 16: CategoryStats interface exists"

if grep -q "interface CategoryStats" "$PROJECT_ROOT/src/insights.ts"; then
    pass "CategoryStats interface exists"
else
    fail "CategoryStats interface should exist"
fi

#------------------------------------------------------------------------------
# Test 17: categoryBreakdown in AnalysisResults
#------------------------------------------------------------------------------
echo "Test 17: categoryBreakdown in AnalysisResults"

if grep -q "categoryBreakdown:" "$PROJECT_ROOT/src/insights.ts"; then
    pass "categoryBreakdown exists in AnalysisResults"
else
    fail "categoryBreakdown should exist in AnalysisResults"
fi

#------------------------------------------------------------------------------
# Test 18: Category breakdown is computed in analyzeData
#------------------------------------------------------------------------------
echo "Test 18: Category breakdown is computed in analyzeData"

if grep -q "const categoryBreakdown:" "$PROJECT_ROOT/src/insights.ts"; then
    pass "Category breakdown is computed in analyzeData"
else
    fail "Category breakdown should be computed in analyzeData"
fi

#------------------------------------------------------------------------------
# Test 19: Category Breakdown section in printInsights
#------------------------------------------------------------------------------
echo "Test 19: Category Breakdown section in printInsights"

if grep -q "Category Breakdown" "$PROJECT_ROOT/src/insights.ts"; then
    pass "Category Breakdown section exists in printInsights"
else
    fail "Category Breakdown section should exist in printInsights"
fi

#------------------------------------------------------------------------------
# Test 20: --category option in CLI
#------------------------------------------------------------------------------
echo "Test 20: --category option in CLI"

if grep -A15 "command('insights')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-category"; then
    pass "--category option exists in insights command"
else
    fail "--category option should exist in insights command"
fi

#------------------------------------------------------------------------------
# Test 21: InsightsOptions includes category field
#------------------------------------------------------------------------------
echo "Test 21: InsightsOptions includes category field"

if grep -A10 "interface InsightsOptions" "$PROJECT_ROOT/src/insights.ts" | grep -q "category?:"; then
    pass "InsightsOptions includes category field"
else
    fail "InsightsOptions should include category field"
fi

#------------------------------------------------------------------------------
# Test 22: Category filtering logic exists
#------------------------------------------------------------------------------
echo "Test 22: Category filtering logic exists"

if grep -q "options.category" "$PROJECT_ROOT/src/insights.ts"; then
    pass "Category filtering logic exists"
else
    fail "Category filtering logic should exist"
fi

#------------------------------------------------------------------------------
# Test 23: get_issue_category is called in get_project_task
#------------------------------------------------------------------------------
echo "Test 23: get_issue_category is called in get_project_task"

if grep -A100 "get_project_task()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q "get_issue_category"; then
    pass "get_issue_category is called when fetching task"
else
    fail "get_issue_category should be called when fetching task"
fi

#------------------------------------------------------------------------------
# Test 24: Default category mappings in set_defaults
#------------------------------------------------------------------------------
echo "Test 24: Default category mappings in set_defaults"

if grep -A150 "set_defaults()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q "CATEGORY_LABELS_BUG="; then
    pass "Default category mappings exist in set_defaults"
else
    fail "Default category mappings should exist in set_defaults"
fi

#------------------------------------------------------------------------------
# Test 25: Docs category mapping exists
#------------------------------------------------------------------------------
echo "Test 25: Docs category mapping exists"

if grep -A20 "^category:" "$PROJECT_ROOT/templates/chadgi-config.yaml" | grep -q "docs:"; then
    pass "docs category mapping exists"
else
    fail "docs category mapping should exist"
fi

#------------------------------------------------------------------------------
# Test 26: Test category mapping exists
#------------------------------------------------------------------------------
echo "Test 26: Test category mapping exists"

if grep -A20 "^category:" "$PROJECT_ROOT/templates/chadgi-config.yaml" | grep -q "test:"; then
    pass "test category mapping exists"
else
    fail "test category mapping should exist"
fi

#------------------------------------------------------------------------------
# Test 27: Chore category mapping exists
#------------------------------------------------------------------------------
echo "Test 27: Chore category mapping exists"

if grep -A20 "^category:" "$PROJECT_ROOT/templates/chadgi-config.yaml" | grep -q "chore:"; then
    pass "chore category mapping exists"
else
    fail "chore category mapping should exist"
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

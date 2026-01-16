#!/bin/bash
#
# Tests for Insights command functionality
#
# Run with: bash tests/test-insights.sh
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
echo "  Insights Command Tests"
echo "=========================================="
echo ""

#------------------------------------------------------------------------------
# Test 1: insights.ts file exists
#------------------------------------------------------------------------------
echo "Test 1: insights.ts file exists"

if [ -f "$PROJECT_ROOT/src/insights.ts" ]; then
    pass "insights.ts file exists"
else
    fail "insights.ts should exist"
fi

#------------------------------------------------------------------------------
# Test 2: CLI has insights command
#------------------------------------------------------------------------------
echo "Test 2: CLI has insights command"

if grep -q "command('insights')" "$PROJECT_ROOT/src/cli.ts"; then
    pass "insights command exists in CLI"
else
    fail "insights command should exist in CLI"
fi

#------------------------------------------------------------------------------
# Test 3: CLI imports insights module
#------------------------------------------------------------------------------
echo "Test 3: CLI imports insights module"

# Accept either direct import or middleware import pattern
if grep -q "import { insights }" "$PROJECT_ROOT/src/cli.ts" || \
   grep -q "import { insightsMiddleware }" "$PROJECT_ROOT/src/cli.ts"; then
    pass "insights module imported in CLI"
else
    fail "insights module should be imported in CLI"
fi

#------------------------------------------------------------------------------
# Test 4: insights command has --json option
#------------------------------------------------------------------------------
echo "Test 4: insights command has --json option"

if grep -A10 "command('insights')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-json"; then
    pass "--json option exists for insights command"
else
    fail "insights command should have --json option"
fi

#------------------------------------------------------------------------------
# Test 5: insights command has --export option
#------------------------------------------------------------------------------
echo "Test 5: insights command has --export option"

if grep -A10 "command('insights')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-export"; then
    pass "--export option exists for insights command"
else
    fail "insights command should have --export option"
fi

#------------------------------------------------------------------------------
# Test 6: insights command has --days option
#------------------------------------------------------------------------------
echo "Test 6: insights command has --days option"

if grep -A10 "command('insights')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-days"; then
    pass "--days option exists for insights command"
else
    fail "insights command should have --days option"
fi

#------------------------------------------------------------------------------
# Test 7: Task metrics tracking variables exist in chadgi.sh
#------------------------------------------------------------------------------
echo "Test 7: Task metrics tracking variables exist in chadgi.sh"

if grep -q 'TASK_PHASE1_START=' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "TASK_PHASE1_START variable exists"
else
    fail "TASK_PHASE1_START should exist"
fi

#------------------------------------------------------------------------------
# Test 8: reset_task_metrics function exists
#------------------------------------------------------------------------------
echo "Test 8: reset_task_metrics function exists"

if grep -q 'reset_task_metrics()' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "reset_task_metrics function exists"
else
    fail "reset_task_metrics function should exist"
fi

#------------------------------------------------------------------------------
# Test 9: save_task_metrics function exists
#------------------------------------------------------------------------------
echo "Test 9: save_task_metrics function exists"

if grep -q 'save_task_metrics()' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "save_task_metrics function exists"
else
    fail "save_task_metrics function should exist"
fi

#------------------------------------------------------------------------------
# Test 10: Phase 1 timing is tracked
#------------------------------------------------------------------------------
echo "Test 10: Phase 1 timing is tracked"

if grep -q 'TASK_PHASE1_START=$(date +%s)' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Phase 1 start time is tracked"
else
    fail "Phase 1 start time should be tracked"
fi

#------------------------------------------------------------------------------
# Test 11: Phase 2 timing is tracked
#------------------------------------------------------------------------------
echo "Test 11: Phase 2 timing is tracked"

if grep -q 'TASK_PHASE2_START=$(date +%s)' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Phase 2 start time is tracked"
else
    fail "Phase 2 start time should be tracked"
fi

#------------------------------------------------------------------------------
# Test 12: Iteration count is tracked
#------------------------------------------------------------------------------
echo "Test 12: Iteration count is tracked"

if grep -q 'TASK_ITERATIONS=' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Iteration count is tracked"
else
    fail "Iteration count should be tracked"
fi

#------------------------------------------------------------------------------
# Test 13: Verification time is tracked
#------------------------------------------------------------------------------
echo "Test 13: Verification time is tracked"

if grep -q 'TASK_VERIFICATION_TIME=' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Verification time is tracked"
else
    fail "Verification time should be tracked"
fi

#------------------------------------------------------------------------------
# Test 14: Error recovery time is tracked
#------------------------------------------------------------------------------
echo "Test 14: Error recovery time is tracked"

if grep -q 'TASK_ERROR_RECOVERY_TIME=' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Error recovery time is tracked"
else
    fail "Error recovery time should be tracked"
fi

#------------------------------------------------------------------------------
# Test 15: Task cost is tracked
#------------------------------------------------------------------------------
echo "Test 15: Task cost is tracked"

if grep -q 'TASK_COST=' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Task cost is tracked"
else
    fail "Task cost should be tracked"
fi

#------------------------------------------------------------------------------
# Test 16: Retry count is tracked
#------------------------------------------------------------------------------
echo "Test 16: Retry count is tracked"

if grep -q 'TASK_RETRY_COUNT=' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Retry count is tracked"
else
    fail "Retry count should be tracked"
fi

#------------------------------------------------------------------------------
# Test 17: Task metrics are saved on success
#------------------------------------------------------------------------------
echo "Test 17: Task metrics are saved on success"

if grep -q 'save_task_metrics.*"completed"' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Task metrics saved on successful completion"
else
    fail "Task metrics should be saved on success"
fi

#------------------------------------------------------------------------------
# Test 18: Task metrics are saved on failure
#------------------------------------------------------------------------------
echo "Test 18: Task metrics are saved on failure"

if grep -q 'save_task_metrics.*"failed"' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Task metrics saved on failure"
else
    fail "Task metrics should be saved on failure"
fi

#------------------------------------------------------------------------------
# Test 19: reset_task_metrics is called at task start
#------------------------------------------------------------------------------
echo "Test 19: reset_task_metrics is called at task start"

# Check that reset_task_metrics is called somewhere (not just defined)
if grep 'reset_task_metrics$' "$PROJECT_ROOT/scripts/chadgi.sh" | grep -v '()' > /dev/null; then
    pass "reset_task_metrics is called at task start"
else
    fail "reset_task_metrics should be called at task start"
fi

#------------------------------------------------------------------------------
# Test 20: insights.ts exports insights function
#------------------------------------------------------------------------------
echo "Test 20: insights.ts exports insights function"

if grep -q 'export async function insights' "$PROJECT_ROOT/src/insights.ts"; then
    pass "insights function is exported"
else
    fail "insights function should be exported"
fi

#------------------------------------------------------------------------------
# Test 21: insights.ts handles JSON output
#------------------------------------------------------------------------------
echo "Test 21: insights.ts handles JSON output"

if grep -q 'options.json' "$PROJECT_ROOT/src/insights.ts"; then
    pass "JSON output is handled"
else
    fail "insights should handle JSON output"
fi

#------------------------------------------------------------------------------
# Test 22: insights.ts handles export option
#------------------------------------------------------------------------------
echo "Test 22: insights.ts handles export option"

if grep -q 'options.export' "$PROJECT_ROOT/src/insights.ts"; then
    pass "Export option is handled"
else
    fail "insights should handle export option"
fi

#------------------------------------------------------------------------------
# Test 23: insights.ts reads metrics file
#------------------------------------------------------------------------------
echo "Test 23: insights.ts reads metrics file"

if grep -q 'chadgi-metrics.json' "$PROJECT_ROOT/src/insights.ts"; then
    pass "Metrics file is read"
else
    fail "insights should read chadgi-metrics.json"
fi

#------------------------------------------------------------------------------
# Test 24: insights.ts reads stats file
#------------------------------------------------------------------------------
echo "Test 24: insights.ts reads stats file"

if grep -q 'chadgi-stats.json' "$PROJECT_ROOT/src/insights.ts"; then
    pass "Stats file is read"
else
    fail "insights should read chadgi-stats.json"
fi

#------------------------------------------------------------------------------
# Test 25: insights.ts calculates success rate
#------------------------------------------------------------------------------
echo "Test 25: insights.ts calculates success rate"

if grep -q 'successRate' "$PROJECT_ROOT/src/insights.ts"; then
    pass "Success rate is calculated"
else
    fail "insights should calculate success rate"
fi

#------------------------------------------------------------------------------
# Test 26: insights.ts calculates average duration
#------------------------------------------------------------------------------
echo "Test 26: insights.ts calculates average duration"

if grep -q 'avgDuration' "$PROJECT_ROOT/src/insights.ts"; then
    pass "Average duration is calculated"
else
    fail "insights should calculate average duration"
fi

#------------------------------------------------------------------------------
# Test 27: insights.ts calculates median duration
#------------------------------------------------------------------------------
echo "Test 27: insights.ts calculates median duration"

if grep -q 'medianDuration' "$PROJECT_ROOT/src/insights.ts"; then
    pass "Median duration is calculated"
else
    fail "insights should calculate median duration"
fi

#------------------------------------------------------------------------------
# Test 28: insights.ts tracks failure reasons
#------------------------------------------------------------------------------
echo "Test 28: insights.ts tracks failure reasons"

if grep -q 'failuresByReason' "$PROJECT_ROOT/src/insights.ts"; then
    pass "Failure reasons are tracked"
else
    fail "insights should track failure reasons"
fi

#------------------------------------------------------------------------------
# Test 29: insights.ts generates optimization suggestions
#------------------------------------------------------------------------------
echo "Test 29: insights.ts generates optimization suggestions"

if grep -q 'generateSuggestions' "$PROJECT_ROOT/src/insights.ts"; then
    pass "Optimization suggestions are generated"
else
    fail "insights should generate optimization suggestions"
fi

#------------------------------------------------------------------------------
# Test 30: insights.ts handles retention/days filtering
#------------------------------------------------------------------------------
echo "Test 30: insights.ts handles retention/days filtering"

if grep -q 'options.days' "$PROJECT_ROOT/src/insights.ts"; then
    pass "Days filtering is handled"
else
    fail "insights should handle days filtering"
fi

#------------------------------------------------------------------------------
# Test 31: Metrics file uses proper JSON structure
#------------------------------------------------------------------------------
echo "Test 31: Metrics file uses proper JSON structure"

if grep -q '"version":' "$PROJECT_ROOT/scripts/chadgi.sh" && \
   grep -q '"retention_days":' "$PROJECT_ROOT/scripts/chadgi.sh" && \
   grep -q '"tasks":' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Metrics file uses proper JSON structure"
else
    fail "Metrics file should use proper JSON structure with version, retention_days, and tasks"
fi

#------------------------------------------------------------------------------
# Test 32: Phase timing data is stored in metrics
#------------------------------------------------------------------------------
echo "Test 32: Phase timing data is stored in metrics"

if grep -q 'phase1_duration_secs' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Phase timing data is stored"
else
    fail "Phase timing data should be stored in metrics"
fi

#------------------------------------------------------------------------------
# Test 33: Files modified count is tracked
#------------------------------------------------------------------------------
echo "Test 33: Files modified count is tracked"

if grep -q 'files_modified' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Files modified count is tracked"
else
    fail "Files modified count should be tracked"
fi

#------------------------------------------------------------------------------
# Test 34: Lines changed count is tracked
#------------------------------------------------------------------------------
echo "Test 34: Lines changed count is tracked"

if grep -q 'lines_changed' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Lines changed count is tracked"
else
    fail "Lines changed count should be tracked"
fi

#------------------------------------------------------------------------------
# Test 35: apply_metrics_retention function exists
#------------------------------------------------------------------------------
echo "Test 35: apply_metrics_retention function exists"

if grep -q 'apply_metrics_retention()' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "apply_metrics_retention function exists"
else
    fail "apply_metrics_retention function should exist"
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

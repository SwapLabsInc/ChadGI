#!/bin/bash
#
# Tests for Benchmark command functionality
#
# Run with: bash tests/test-benchmark.sh
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
echo "  Benchmark Command Tests"
echo "=========================================="
echo ""

#------------------------------------------------------------------------------
# Test 1: benchmark.ts file exists
#------------------------------------------------------------------------------
echo "Test 1: benchmark.ts file exists"

if [ -f "$PROJECT_ROOT/src/benchmark.ts" ]; then
    pass "benchmark.ts file exists"
else
    fail "benchmark.ts should exist"
fi

#------------------------------------------------------------------------------
# Test 2: CLI has benchmark command
#------------------------------------------------------------------------------
echo "Test 2: CLI has benchmark command"

if grep -q "command('benchmark')" "$PROJECT_ROOT/src/cli.ts"; then
    pass "benchmark command exists in CLI"
else
    fail "benchmark command should exist in CLI"
fi

#------------------------------------------------------------------------------
# Test 3: CLI imports benchmark module
#------------------------------------------------------------------------------
echo "Test 3: CLI imports benchmark module"

if grep -q "import { benchmark }" "$PROJECT_ROOT/src/cli.ts"; then
    pass "benchmark module imported in CLI"
else
    fail "benchmark module should be imported in CLI"
fi

#------------------------------------------------------------------------------
# Test 4: benchmark command has --json option
#------------------------------------------------------------------------------
echo "Test 4: benchmark command has --json option"

if grep -A20 "command('benchmark')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-json"; then
    pass "--json option exists for benchmark command"
else
    fail "benchmark command should have --json option"
fi

#------------------------------------------------------------------------------
# Test 5: benchmark command has --quick option
#------------------------------------------------------------------------------
echo "Test 5: benchmark command has --quick option"

if grep -A20 "command('benchmark')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-quick"; then
    pass "--quick option exists for benchmark command"
else
    fail "benchmark command should have --quick option"
fi

#------------------------------------------------------------------------------
# Test 6: benchmark command has --full option
#------------------------------------------------------------------------------
echo "Test 6: benchmark command has --full option"

if grep -A20 "command('benchmark')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-full"; then
    pass "--full option exists for benchmark command"
else
    fail "benchmark command should have --full option"
fi

#------------------------------------------------------------------------------
# Test 7: benchmark command has --model option
#------------------------------------------------------------------------------
echo "Test 7: benchmark command has --model option"

if grep -A20 "command('benchmark')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-model"; then
    pass "--model option exists for benchmark command"
else
    fail "benchmark command should have --model option"
fi

#------------------------------------------------------------------------------
# Test 8: benchmark command has --tasks option
#------------------------------------------------------------------------------
echo "Test 8: benchmark command has --tasks option"

if grep -A20 "command('benchmark')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-tasks"; then
    pass "--tasks option exists for benchmark command"
else
    fail "benchmark command should have --tasks option"
fi

#------------------------------------------------------------------------------
# Test 9: benchmark command has --output option
#------------------------------------------------------------------------------
echo "Test 9: benchmark command has --output option"

if grep -A20 "command('benchmark')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-output"; then
    pass "--output option exists for benchmark command"
else
    fail "benchmark command should have --output option"
fi

#------------------------------------------------------------------------------
# Test 10: benchmark command has --compare option
#------------------------------------------------------------------------------
echo "Test 10: benchmark command has --compare option"

if grep -A20 "command('benchmark')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-compare"; then
    pass "--compare option exists for benchmark command"
else
    fail "benchmark command should have --compare option"
fi

#------------------------------------------------------------------------------
# Test 11: benchmark command has --list option
#------------------------------------------------------------------------------
echo "Test 11: benchmark command has --list option"

if grep -A20 "command('benchmark')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-list"; then
    pass "--list option exists for benchmark command"
else
    fail "benchmark command should have --list option"
fi

#------------------------------------------------------------------------------
# Test 12: benchmark command has --iterations option
#------------------------------------------------------------------------------
echo "Test 12: benchmark command has --iterations option"

if grep -A20 "command('benchmark')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-iterations"; then
    pass "--iterations option exists for benchmark command"
else
    fail "benchmark command should have --iterations option"
fi

#------------------------------------------------------------------------------
# Test 13: benchmark command has --dry-run option
#------------------------------------------------------------------------------
echo "Test 13: benchmark command has --dry-run option"

if grep -A20 "command('benchmark')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-dry-run"; then
    pass "--dry-run option exists for benchmark command"
else
    fail "benchmark command should have --dry-run option"
fi

#------------------------------------------------------------------------------
# Test 14: benchmark.ts exports benchmark function
#------------------------------------------------------------------------------
echo "Test 14: benchmark.ts exports benchmark function"

if grep -q 'export async function benchmark' "$PROJECT_ROOT/src/benchmark.ts"; then
    pass "benchmark function is exported"
else
    fail "benchmark function should be exported"
fi

#------------------------------------------------------------------------------
# Test 15: benchmark.ts handles JSON output
#------------------------------------------------------------------------------
echo "Test 15: benchmark.ts handles JSON output"

if grep -q 'options.json' "$PROJECT_ROOT/src/benchmark.ts"; then
    pass "JSON output is handled"
else
    fail "benchmark should handle JSON output"
fi

#------------------------------------------------------------------------------
# Test 16: benchmark.ts has BenchmarkTask interface
#------------------------------------------------------------------------------
echo "Test 16: benchmark.ts has BenchmarkTask interface"

if grep -q 'interface BenchmarkTask' "$PROJECT_ROOT/src/benchmark.ts"; then
    pass "BenchmarkTask interface exists"
else
    fail "benchmark should have BenchmarkTask interface"
fi

#------------------------------------------------------------------------------
# Test 17: benchmark.ts has BenchmarkRunResult interface
#------------------------------------------------------------------------------
echo "Test 17: benchmark.ts has BenchmarkRunResult interface"

if grep -q 'interface BenchmarkRunResult' "$PROJECT_ROOT/src/benchmark.ts"; then
    pass "BenchmarkRunResult interface exists"
else
    fail "benchmark should have BenchmarkRunResult interface"
fi

#------------------------------------------------------------------------------
# Test 18: benchmark.ts has TaskRunResult interface
#------------------------------------------------------------------------------
echo "Test 18: benchmark.ts has TaskRunResult interface"

if grep -q 'interface TaskRunResult' "$PROJECT_ROOT/src/benchmark.ts"; then
    pass "TaskRunResult interface exists"
else
    fail "benchmark should have TaskRunResult interface"
fi

#------------------------------------------------------------------------------
# Test 19: benchmark.ts has quick benchmark tasks
#------------------------------------------------------------------------------
echo "Test 19: benchmark.ts has quick benchmark tasks"

if grep -q 'QUICK_BENCHMARK_TASKS' "$PROJECT_ROOT/src/benchmark.ts"; then
    pass "Quick benchmark tasks exist"
else
    fail "benchmark should have QUICK_BENCHMARK_TASKS"
fi

#------------------------------------------------------------------------------
# Test 20: benchmark.ts has full benchmark tasks
#------------------------------------------------------------------------------
echo "Test 20: benchmark.ts has full benchmark tasks"

if grep -q 'FULL_BENCHMARK_TASKS' "$PROJECT_ROOT/src/benchmark.ts"; then
    pass "Full benchmark tasks exist"
else
    fail "benchmark should have FULL_BENCHMARK_TASKS"
fi

#------------------------------------------------------------------------------
# Test 21: benchmark.ts tracks success rate
#------------------------------------------------------------------------------
echo "Test 21: benchmark.ts tracks success rate"

if grep -q 'successRate' "$PROJECT_ROOT/src/benchmark.ts"; then
    pass "Success rate tracking exists"
else
    fail "benchmark should track success rate"
fi

#------------------------------------------------------------------------------
# Test 22: benchmark.ts tracks token usage
#------------------------------------------------------------------------------
echo "Test 22: benchmark.ts tracks token usage"

if grep -q 'totalTokens' "$PROJECT_ROOT/src/benchmark.ts"; then
    pass "Token usage tracking exists"
else
    fail "benchmark should track token usage"
fi

#------------------------------------------------------------------------------
# Test 23: benchmark.ts tracks iteration count
#------------------------------------------------------------------------------
echo "Test 23: benchmark.ts tracks iteration count"

if grep -q 'iterationCount' "$PROJECT_ROOT/src/benchmark.ts"; then
    pass "Iteration count tracking exists"
else
    fail "benchmark should track iteration count"
fi

#------------------------------------------------------------------------------
# Test 24: benchmark.ts tracks duration
#------------------------------------------------------------------------------
echo "Test 24: benchmark.ts tracks duration"

if grep -q 'durationSecs' "$PROJECT_ROOT/src/benchmark.ts"; then
    pass "Duration tracking exists"
else
    fail "benchmark should track duration"
fi

#------------------------------------------------------------------------------
# Test 25: benchmark.ts tracks cost
#------------------------------------------------------------------------------
echo "Test 25: benchmark.ts tracks cost"

if grep -q 'costUsd' "$PROJECT_ROOT/src/benchmark.ts"; then
    pass "Cost tracking exists"
else
    fail "benchmark should track cost"
fi

#------------------------------------------------------------------------------
# Test 26: benchmark.ts generates markdown report
#------------------------------------------------------------------------------
echo "Test 26: benchmark.ts generates markdown report"

if grep -q 'generateMarkdownReport' "$PROJECT_ROOT/src/benchmark.ts"; then
    pass "Markdown report generation exists"
else
    fail "benchmark should generate markdown report"
fi

#------------------------------------------------------------------------------
# Test 27: benchmark.ts stores results in history
#------------------------------------------------------------------------------
echo "Test 27: benchmark.ts stores results in history"

if grep -q 'benchmark-results.json' "$PROJECT_ROOT/src/benchmark.ts"; then
    pass "Benchmark results storage exists"
else
    fail "benchmark should store results in benchmark-results.json"
fi

#------------------------------------------------------------------------------
# Test 28: benchmark.ts loads custom tasks
#------------------------------------------------------------------------------
echo "Test 28: benchmark.ts loads custom tasks"

if grep -q 'loadCustomTasks' "$PROJECT_ROOT/src/benchmark.ts"; then
    pass "Custom task loading exists"
else
    fail "benchmark should load custom tasks"
fi

#------------------------------------------------------------------------------
# Test 29: benchmark.ts supports category breakdown
#------------------------------------------------------------------------------
echo "Test 29: benchmark.ts supports category breakdown"

if grep -q 'categoryBreakdown' "$PROJECT_ROOT/src/benchmark.ts"; then
    pass "Category breakdown exists"
else
    fail "benchmark should support category breakdown"
fi

#------------------------------------------------------------------------------
# Test 30: benchmark.ts supports comparison
#------------------------------------------------------------------------------
echo "Test 30: benchmark.ts supports comparison"

if grep -q 'compareBenchmarks' "$PROJECT_ROOT/src/benchmark.ts"; then
    pass "Benchmark comparison exists"
else
    fail "benchmark should support comparison"
fi

#------------------------------------------------------------------------------
# Test 31: benchmark.ts has ComparisonResult interface
#------------------------------------------------------------------------------
echo "Test 31: benchmark.ts has ComparisonResult interface"

if grep -q 'interface ComparisonResult' "$PROJECT_ROOT/src/benchmark.ts"; then
    pass "ComparisonResult interface exists"
else
    fail "benchmark should have ComparisonResult interface"
fi

#------------------------------------------------------------------------------
# Test 32: benchmark.ts handles model option
#------------------------------------------------------------------------------
echo "Test 32: benchmark.ts handles model option"

if grep -q 'options.model\|config.model' "$PROJECT_ROOT/src/benchmark.ts"; then
    pass "Model option is handled"
else
    fail "benchmark should handle model option"
fi

#------------------------------------------------------------------------------
# Test 33: benchmark.ts handles dry-run mode
#------------------------------------------------------------------------------
echo "Test 33: benchmark.ts handles dry-run mode"

if grep -q 'dryRun\|dry-run' "$PROJECT_ROOT/src/benchmark.ts"; then
    pass "Dry-run mode is handled"
else
    fail "benchmark should handle dry-run mode"
fi

#------------------------------------------------------------------------------
# Test 34: benchmark.ts has code-review category tasks
#------------------------------------------------------------------------------
echo "Test 34: benchmark.ts has code-review category tasks"

if grep -q "'code-review'" "$PROJECT_ROOT/src/benchmark.ts"; then
    pass "Code-review category tasks exist"
else
    fail "benchmark should have code-review category tasks"
fi

#------------------------------------------------------------------------------
# Test 35: benchmark.ts has bug-fix category tasks
#------------------------------------------------------------------------------
echo "Test 35: benchmark.ts has bug-fix category tasks"

if grep -q "'bug-fix'" "$PROJECT_ROOT/src/benchmark.ts"; then
    pass "Bug-fix category tasks exist"
else
    fail "benchmark should have bug-fix category tasks"
fi

#------------------------------------------------------------------------------
# Test 36: benchmark.ts has refactor category tasks
#------------------------------------------------------------------------------
echo "Test 36: benchmark.ts has refactor category tasks"

if grep -q "'refactor'" "$PROJECT_ROOT/src/benchmark.ts"; then
    pass "Refactor category tasks exist"
else
    fail "benchmark should have refactor category tasks"
fi

#------------------------------------------------------------------------------
# Test 37: benchmark.ts has feature category tasks
#------------------------------------------------------------------------------
echo "Test 37: benchmark.ts has feature category tasks"

if grep -q "'feature'" "$PROJECT_ROOT/src/benchmark.ts"; then
    pass "Feature category tasks exist"
else
    fail "benchmark should have feature category tasks"
fi

#------------------------------------------------------------------------------
# Test 38: benchmark.ts has test category tasks
#------------------------------------------------------------------------------
echo "Test 38: benchmark.ts has test category tasks"

if grep -q "'test'" "$PROJECT_ROOT/src/benchmark.ts"; then
    pass "Test category tasks exist"
else
    fail "benchmark should have test category tasks"
fi

#------------------------------------------------------------------------------
# Test 39: benchmark.ts has docs category tasks
#------------------------------------------------------------------------------
echo "Test 39: benchmark.ts has docs category tasks"

if grep -q "'docs'" "$PROJECT_ROOT/src/benchmark.ts"; then
    pass "Docs category tasks exist"
else
    fail "benchmark should have docs category tasks"
fi

#------------------------------------------------------------------------------
# Test 40: templates/benchmarks directory exists
#------------------------------------------------------------------------------
echo "Test 40: templates/benchmarks directory exists"

if [ -d "$PROJECT_ROOT/templates/benchmarks" ]; then
    pass "templates/benchmarks directory exists"
else
    fail "templates/benchmarks directory should exist"
fi

#------------------------------------------------------------------------------
# Test 41: sample benchmark task exists
#------------------------------------------------------------------------------
echo "Test 41: sample benchmark task exists"

if [ -f "$PROJECT_ROOT/templates/benchmarks/sample.json" ]; then
    pass "Sample benchmark task exists"
else
    fail "templates/benchmarks/sample.json should exist"
fi

#------------------------------------------------------------------------------
# Test 42: sample benchmark is valid JSON
#------------------------------------------------------------------------------
echo "Test 42: sample benchmark is valid JSON"

if jq empty "$PROJECT_ROOT/templates/benchmarks/sample.json" 2>/dev/null; then
    pass "Sample benchmark is valid JSON"
else
    fail "Sample benchmark should be valid JSON"
fi

#------------------------------------------------------------------------------
# Test 43: benchmark.ts handles timeout option
#------------------------------------------------------------------------------
echo "Test 43: benchmark.ts handles timeout option"

if grep -q 'options.timeout\|config.timeout' "$PROJECT_ROOT/src/benchmark.ts"; then
    pass "Timeout option is handled"
else
    fail "benchmark should handle timeout option"
fi

#------------------------------------------------------------------------------
# Test 44: benchmark.ts handles iterations option
#------------------------------------------------------------------------------
echo "Test 44: benchmark.ts handles iterations option"

if grep -q 'options.iterations\|config.iterations' "$PROJECT_ROOT/src/benchmark.ts"; then
    pass "Iterations option is handled"
else
    fail "benchmark should handle iterations option"
fi

#------------------------------------------------------------------------------
# Test 45: benchmark.ts lists available tasks
#------------------------------------------------------------------------------
echo "Test 45: benchmark.ts lists available tasks"

if grep -q 'printAvailableTasks\|options.list' "$PROJECT_ROOT/src/benchmark.ts"; then
    pass "Task listing is supported"
else
    fail "benchmark should list available tasks"
fi

#------------------------------------------------------------------------------
# Test 46: benchmark.ts saves benchmark history
#------------------------------------------------------------------------------
echo "Test 46: benchmark.ts saves benchmark history"

if grep -q 'saveBenchmarkHistory' "$PROJECT_ROOT/src/benchmark.ts"; then
    pass "Benchmark history saving exists"
else
    fail "benchmark should save benchmark history"
fi

#------------------------------------------------------------------------------
# Test 47: benchmark.ts loads benchmark history
#------------------------------------------------------------------------------
echo "Test 47: benchmark.ts loads benchmark history"

if grep -q 'loadBenchmarkHistory' "$PROJECT_ROOT/src/benchmark.ts"; then
    pass "Benchmark history loading exists"
else
    fail "benchmark should load benchmark history"
fi

#------------------------------------------------------------------------------
# Test 48: benchmark.ts has BenchmarkHistory interface
#------------------------------------------------------------------------------
echo "Test 48: benchmark.ts has BenchmarkHistory interface"

if grep -q 'interface BenchmarkHistory' "$PROJECT_ROOT/src/benchmark.ts"; then
    pass "BenchmarkHistory interface exists"
else
    fail "benchmark should have BenchmarkHistory interface"
fi

#------------------------------------------------------------------------------
# Test 49: benchmark.ts calculates category metrics
#------------------------------------------------------------------------------
echo "Test 49: benchmark.ts calculates category metrics"

if grep -q 'calculateCategoryMetrics' "$PROJECT_ROOT/src/benchmark.ts"; then
    pass "Category metrics calculation exists"
else
    fail "benchmark should calculate category metrics"
fi

#------------------------------------------------------------------------------
# Test 50: benchmark.ts has CategoryMetrics interface
#------------------------------------------------------------------------------
echo "Test 50: benchmark.ts has CategoryMetrics interface"

if grep -q 'interface CategoryMetrics' "$PROJECT_ROOT/src/benchmark.ts"; then
    pass "CategoryMetrics interface exists"
else
    fail "benchmark should have CategoryMetrics interface"
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

#!/bin/bash
#
# Tests for Doctor Command functionality
#
# Run with: bash tests/test-doctor.sh
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
echo "  Doctor Command Tests"
echo "=========================================="
echo ""

#------------------------------------------------------------------------------
# Test 1: doctor.ts file exists
#------------------------------------------------------------------------------
echo "Test 1: doctor.ts file exists"

if [ -f "$PROJECT_ROOT/src/doctor.ts" ]; then
    pass "doctor.ts file exists"
else
    fail "doctor.ts should exist"
fi

#------------------------------------------------------------------------------
# Test 2: CLI has doctor command
#------------------------------------------------------------------------------
echo "Test 2: CLI has doctor command"

if grep -q "command('doctor')" "$PROJECT_ROOT/src/cli.ts"; then
    pass "doctor command exists in CLI"
else
    fail "doctor command should exist in CLI"
fi

#------------------------------------------------------------------------------
# Test 3: CLI imports doctor module
#------------------------------------------------------------------------------
echo "Test 3: CLI imports doctor module"

if grep -q "import { doctor }" "$PROJECT_ROOT/src/cli.ts"; then
    pass "doctor module imported in CLI"
else
    fail "doctor module should be imported in CLI"
fi

#------------------------------------------------------------------------------
# Test 4: Doctor command has --fix option
#------------------------------------------------------------------------------
echo "Test 4: Doctor command has --fix option"

if grep -q "\-\-fix" "$PROJECT_ROOT/src/cli.ts"; then
    pass "--fix option exists for doctor command"
else
    fail "doctor command should have --fix option"
fi

#------------------------------------------------------------------------------
# Test 5: Doctor command has --json option
#------------------------------------------------------------------------------
echo "Test 5: Doctor command has --json option"

if grep -A5 "command('doctor')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-json"; then
    pass "--json option exists for doctor command"
else
    fail "doctor command should have --json option"
fi

#------------------------------------------------------------------------------
# Test 6: Doctor command has --config option
#------------------------------------------------------------------------------
echo "Test 6: Doctor command has --config option"

if grep -A3 "command('doctor')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-config"; then
    pass "--config option exists for doctor command"
else
    fail "doctor command should have --config option"
fi

#------------------------------------------------------------------------------
# Test 7: doctor.ts checks GitHub API rate limit
#------------------------------------------------------------------------------
echo "Test 7: doctor.ts checks GitHub API rate limit"

if grep -q "rate_limit\|checkRateLimit\|Rate Limit" "$PROJECT_ROOT/src/doctor.ts"; then
    pass "doctor.ts checks GitHub API rate limit"
else
    fail "doctor.ts should check GitHub API rate limit"
fi

#------------------------------------------------------------------------------
# Test 8: doctor.ts checks for stale pause.lock files
#------------------------------------------------------------------------------
echo "Test 8: doctor.ts checks for stale pause.lock files"

if grep -q "pause.lock\|checkStaleLockFiles\|Stale Lock" "$PROJECT_ROOT/src/doctor.ts"; then
    pass "doctor.ts checks for stale pause.lock files"
else
    fail "doctor.ts should check for stale pause.lock files"
fi

#------------------------------------------------------------------------------
# Test 9: doctor.ts checks for orphaned branches
#------------------------------------------------------------------------------
echo "Test 9: doctor.ts checks for orphaned branches"

if grep -q "checkOrphanedBranches\|orphan.*branch\|Orphaned Branches" "$PROJECT_ROOT/src/doctor.ts"; then
    pass "doctor.ts checks for orphaned branches"
else
    fail "doctor.ts should check for orphaned branches"
fi

#------------------------------------------------------------------------------
# Test 10: doctor.ts verifies project board connectivity
#------------------------------------------------------------------------------
echo "Test 10: doctor.ts verifies project board connectivity"

if grep -q "checkProjectBoard\|Project Board\|projectV2" "$PROJECT_ROOT/src/doctor.ts"; then
    pass "doctor.ts verifies project board connectivity"
else
    fail "doctor.ts should verify project board connectivity"
fi

#------------------------------------------------------------------------------
# Test 11: doctor.ts tests template rendering
#------------------------------------------------------------------------------
echo "Test 11: doctor.ts tests template rendering"

if grep -q "checkTemplates\|validateTemplateVariables\|Template.*Syntax" "$PROJECT_ROOT/src/doctor.ts"; then
    pass "doctor.ts tests template rendering"
else
    fail "doctor.ts should test template rendering"
fi

#------------------------------------------------------------------------------
# Test 12: doctor.ts checks progress.json for interrupted tasks
#------------------------------------------------------------------------------
echo "Test 12: doctor.ts checks progress.json for interrupted tasks"

if grep -q "checkProgressFile\|progress.*json\|interrupted\|Progress File" "$PROJECT_ROOT/src/doctor.ts"; then
    pass "doctor.ts checks progress.json for interrupted tasks"
else
    fail "doctor.ts should check progress.json for interrupted tasks"
fi

#------------------------------------------------------------------------------
# Test 13: doctor.ts reports disk space
#------------------------------------------------------------------------------
echo "Test 13: doctor.ts reports disk space"

if grep -q "checkDiskSpace\|Disk Space\|df -h" "$PROJECT_ROOT/src/doctor.ts"; then
    pass "doctor.ts reports disk space"
else
    fail "doctor.ts should report disk space"
fi

#------------------------------------------------------------------------------
# Test 14: doctor.ts summarizes errors from diagnostics folder
#------------------------------------------------------------------------------
echo "Test 14: doctor.ts summarizes errors from diagnostics folder"

if grep -q "checkDiagnosticsFolder\|diagnostics\|Recent Errors" "$PROJECT_ROOT/src/doctor.ts"; then
    pass "doctor.ts summarizes errors from diagnostics folder"
else
    fail "doctor.ts should summarize errors from diagnostics folder"
fi

#------------------------------------------------------------------------------
# Test 15: doctor.ts outputs health score
#------------------------------------------------------------------------------
echo "Test 15: doctor.ts outputs health score"

if grep -q "healthScore\|Health Score\|calculateHealthScore" "$PROJECT_ROOT/src/doctor.ts"; then
    pass "doctor.ts outputs health score"
else
    fail "doctor.ts should output health score"
fi

#------------------------------------------------------------------------------
# Test 16: doctor.ts generates recommendations
#------------------------------------------------------------------------------
echo "Test 16: doctor.ts generates recommendations"

if grep -q "recommendations\|generateRecommendations\|Recommendations" "$PROJECT_ROOT/src/doctor.ts"; then
    pass "doctor.ts generates recommendations"
else
    fail "doctor.ts should generate recommendations"
fi

#------------------------------------------------------------------------------
# Test 17: doctor.ts has fixable checks support
#------------------------------------------------------------------------------
echo "Test 17: doctor.ts has fixable checks support"

if grep -q "fixable.*:\s*true\|fix.*boolean\|--fix" "$PROJECT_ROOT/src/doctor.ts"; then
    pass "doctor.ts supports fixable checks"
else
    fail "doctor.ts should support fixable checks"
fi

#------------------------------------------------------------------------------
# Test 18: doctor.ts checks graphql rate limit
#------------------------------------------------------------------------------
echo "Test 18: doctor.ts checks GraphQL rate limit"

if grep -q "graphql\|GraphQL" "$PROJECT_ROOT/src/doctor.ts"; then
    pass "doctor.ts checks GraphQL rate limit"
else
    fail "doctor.ts should check GraphQL rate limit"
fi

#------------------------------------------------------------------------------
# Test 19: doctor.ts uses colored output
#------------------------------------------------------------------------------
echo "Test 19: doctor.ts uses colored output"

if grep -q "colors\s*=\|\\\\x1b\[" "$PROJECT_ROOT/src/doctor.ts"; then
    pass "doctor.ts uses colored output"
else
    fail "doctor.ts should use colored output"
fi

#------------------------------------------------------------------------------
# Test 20: doctor.ts imports HealthCheck from types/index.ts
#------------------------------------------------------------------------------
echo "Test 20: doctor.ts imports HealthCheck from types/index.ts"

if grep -q "HealthCheck" "$PROJECT_ROOT/src/doctor.ts" && \
   grep -q "from './types/index.js'" "$PROJECT_ROOT/src/doctor.ts"; then
    pass "doctor.ts imports HealthCheck from types/index.ts"
else
    fail "doctor.ts should import HealthCheck from types/index.ts"
fi

#------------------------------------------------------------------------------
# Test 21: doctor.ts imports HealthReport from types/index.ts
#------------------------------------------------------------------------------
echo "Test 21: doctor.ts imports HealthReport from types/index.ts"

if grep -q "HealthReport" "$PROJECT_ROOT/src/doctor.ts" && \
   grep -q "from './types/index.js'" "$PROJECT_ROOT/src/doctor.ts"; then
    pass "doctor.ts imports HealthReport from types/index.ts"
else
    fail "doctor.ts should import HealthReport from types/index.ts"
fi

#------------------------------------------------------------------------------
# Test 22: doctor.ts exports doctor function
#------------------------------------------------------------------------------
echo "Test 22: doctor.ts exports doctor function"

if grep -q "export async function doctor" "$PROJECT_ROOT/src/doctor.ts"; then
    pass "doctor.ts exports doctor function"
else
    fail "doctor.ts should export doctor function"
fi

#------------------------------------------------------------------------------
# Test 23: doctor.ts handles DoctorOptions
#------------------------------------------------------------------------------
echo "Test 23: doctor.ts handles DoctorOptions"

if grep -q "interface DoctorOptions" "$PROJECT_ROOT/src/doctor.ts"; then
    pass "doctor.ts handles DoctorOptions"
else
    fail "doctor.ts should handle DoctorOptions interface"
fi

#------------------------------------------------------------------------------
# Test 24: doctor.ts checks for 24-hour stale threshold
#------------------------------------------------------------------------------
echo "Test 24: doctor.ts checks for 24-hour stale threshold"

if grep -q "24\s*\*\|ageHours.*>\s*24\|24.*hours" "$PROJECT_ROOT/src/doctor.ts"; then
    pass "doctor.ts uses 24-hour stale threshold"
else
    fail "doctor.ts should use 24-hour stale threshold for lock files"
fi

#------------------------------------------------------------------------------
# Test 25: doctor.ts has check categories
#------------------------------------------------------------------------------
echo "Test 25: doctor.ts has check categories"

if grep -q "category:\s*['\"]api['\"]" "$PROJECT_ROOT/src/doctor.ts" && \
   grep -q "category:\s*['\"]github['\"]" "$PROJECT_ROOT/src/doctor.ts" && \
   grep -q "category:\s*['\"]environment['\"]" "$PROJECT_ROOT/src/doctor.ts"; then
    pass "doctor.ts has check categories"
else
    fail "doctor.ts should have check categories (api, github, environment)"
fi

#------------------------------------------------------------------------------
# Test 26: doctor.ts supports JSON output
#------------------------------------------------------------------------------
echo "Test 26: doctor.ts supports JSON output"

if grep -q "options.json\|JSON.stringify.*report" "$PROJECT_ROOT/src/doctor.ts"; then
    pass "doctor.ts supports JSON output"
else
    fail "doctor.ts should support JSON output"
fi

#------------------------------------------------------------------------------
# Test 27: doctor.ts checks for open PRs when detecting orphaned branches
#------------------------------------------------------------------------------
echo "Test 27: doctor.ts checks for open PRs when detecting orphaned branches"

if grep -q "gh pr list\|open.*PR\|headRefName" "$PROJECT_ROOT/src/doctor.ts"; then
    pass "doctor.ts checks for open PRs"
else
    fail "doctor.ts should check for open PRs when detecting orphaned branches"
fi

#------------------------------------------------------------------------------
# Test 28: doctor.ts handles project board column verification
#------------------------------------------------------------------------------
echo "Test 28: doctor.ts handles project board column verification"

if grep -q "missingColumns\|requiredColumns\|columns.*filter\|Project Board Columns" "$PROJECT_ROOT/src/doctor.ts"; then
    pass "doctor.ts handles project board column verification"
else
    fail "doctor.ts should verify project board columns"
fi

#------------------------------------------------------------------------------
# Test 29: doctor.ts has summary statistics
#------------------------------------------------------------------------------
echo "Test 29: doctor.ts has summary statistics"

if grep -q "summary.*total\|summary.*passed\|summary.*warnings\|summary.*errors" "$PROJECT_ROOT/src/doctor.ts"; then
    pass "doctor.ts has summary statistics"
else
    fail "doctor.ts should have summary statistics"
fi

#------------------------------------------------------------------------------
# Test 30: doctor.ts handles unlinkSync for fix operations
#------------------------------------------------------------------------------
echo "Test 30: doctor.ts handles unlinkSync for fix operations"

if grep -q "unlinkSync" "$PROJECT_ROOT/src/doctor.ts"; then
    pass "doctor.ts uses unlinkSync for fix operations"
else
    fail "doctor.ts should use unlinkSync for auto-fix operations"
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

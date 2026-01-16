#!/bin/bash
#
# Tests for Replay functionality
#
# Run with: bash tests/test-replay.sh
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
echo "  Replay Command Tests"
echo "=========================================="
echo ""

#------------------------------------------------------------------------------
# Test 1: replay.ts file exists
#------------------------------------------------------------------------------
echo "Test 1: replay.ts file exists"

if [ -f "$PROJECT_ROOT/src/replay.ts" ]; then
    pass "replay.ts file exists"
else
    fail "replay.ts should exist"
fi

#------------------------------------------------------------------------------
# Test 2: CLI has replay command
#------------------------------------------------------------------------------
echo "Test 2: CLI has replay command"

if grep -q "command('replay" "$PROJECT_ROOT/src/cli.ts"; then
    pass "replay command exists in CLI"
else
    fail "replay command should exist in CLI"
fi

#------------------------------------------------------------------------------
# Test 3: CLI imports replay module
#------------------------------------------------------------------------------
echo "Test 3: CLI imports replay module"

if grep -q "import { replay" "$PROJECT_ROOT/src/cli.ts"; then
    pass "replay module imported in CLI"
else
    fail "replay module should be imported in CLI"
fi

#------------------------------------------------------------------------------
# Test 4: replay command has --json option
#------------------------------------------------------------------------------
echo "Test 4: replay command has --json option"

if grep -A20 "command('replay" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-json"; then
    pass "--json option exists for replay command"
else
    fail "replay command should have --json option"
fi

#------------------------------------------------------------------------------
# Test 5: replay command has --fresh option
#------------------------------------------------------------------------------
echo "Test 5: replay command has --fresh option"

if grep -A20 "command('replay" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-fresh"; then
    pass "--fresh option exists for replay command"
else
    fail "replay command should have --fresh option"
fi

#------------------------------------------------------------------------------
# Test 6: replay command has --continue option
#------------------------------------------------------------------------------
echo "Test 6: replay command has --continue option"

if grep -A20 "command('replay" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-continue"; then
    pass "--continue option exists for replay command"
else
    fail "replay command should have --continue option"
fi

#------------------------------------------------------------------------------
# Test 7: replay command has --last option
#------------------------------------------------------------------------------
echo "Test 7: replay command has --last option"

if grep -A20 "command('replay" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-last"; then
    pass "--last option exists for replay command"
else
    fail "replay command should have --last option"
fi

#------------------------------------------------------------------------------
# Test 8: replay command has --all-failed option
#------------------------------------------------------------------------------
echo "Test 8: replay command has --all-failed option"

if grep -A20 "command('replay" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-all-failed"; then
    pass "--all-failed option exists for replay command"
else
    fail "replay command should have --all-failed option"
fi

#------------------------------------------------------------------------------
# Test 9: replay command has --dry-run option
#------------------------------------------------------------------------------
echo "Test 9: replay command has --dry-run option"

if grep -A20 "command('replay" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-dry-run"; then
    pass "--dry-run option exists for replay command"
else
    fail "replay command should have --dry-run option"
fi

#------------------------------------------------------------------------------
# Test 10: replay command has --yes option
#------------------------------------------------------------------------------
echo "Test 10: replay command has --yes option"

if grep -A20 "command('replay" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-yes"; then
    pass "--yes option exists for replay command"
else
    fail "replay command should have --yes option"
fi

#------------------------------------------------------------------------------
# Test 11: replay command has --config option
#------------------------------------------------------------------------------
echo "Test 11: replay command has --config option"

if grep -A20 "command('replay" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-config"; then
    pass "--config option exists for replay command"
else
    fail "replay command should have --config option"
fi

#------------------------------------------------------------------------------
# Test 12: replay.ts imports FailedTask from types/index.ts
#------------------------------------------------------------------------------
echo "Test 12: replay.ts imports FailedTask from types/index.ts"

if grep -q "FailedTask" "$PROJECT_ROOT/src/replay.ts" && \
   grep -q "from './types/index.js'" "$PROJECT_ROOT/src/replay.ts"; then
    pass "FailedTask imported from types/index.ts"
else
    fail "FailedTask should be imported from types/index.ts"
fi

#------------------------------------------------------------------------------
# Test 13: types/index.ts FailedTask includes issueNumber
#------------------------------------------------------------------------------
echo "Test 13: types/index.ts FailedTask includes issueNumber"

if grep -A20 "interface FailedTask" "$PROJECT_ROOT/src/types/index.ts" | grep -q "issueNumber"; then
    pass "FailedTask includes issueNumber"
else
    fail "FailedTask should include issueNumber"
fi

#------------------------------------------------------------------------------
# Test 14: types/index.ts FailedTask includes failureReason
#------------------------------------------------------------------------------
echo "Test 14: types/index.ts FailedTask includes failureReason"

if grep -A20 "interface FailedTask" "$PROJECT_ROOT/src/types/index.ts" | grep -q "failureReason"; then
    pass "FailedTask includes failureReason"
else
    fail "FailedTask should include failureReason"
fi

#------------------------------------------------------------------------------
# Test 15: types/index.ts FailedTask includes retryCount
#------------------------------------------------------------------------------
echo "Test 15: types/index.ts FailedTask includes retryCount"

if grep -A20 "interface FailedTask" "$PROJECT_ROOT/src/types/index.ts" | grep -q "retryCount"; then
    pass "FailedTask includes retryCount"
else
    fail "FailedTask should include retryCount for tracking retry attempts"
fi

#------------------------------------------------------------------------------
# Test 16: replay.ts defines ReplayOptions interface
#------------------------------------------------------------------------------
echo "Test 16: replay.ts defines ReplayOptions interface"

if grep -q "interface ReplayOptions" "$PROJECT_ROOT/src/replay.ts"; then
    pass "ReplayOptions interface defined"
else
    fail "ReplayOptions interface should be defined"
fi

#------------------------------------------------------------------------------
# Test 17: replay.ts imports ReplayResult from types/index.ts
#------------------------------------------------------------------------------
echo "Test 17: replay.ts imports ReplayResult from types/index.ts"

if grep -q "ReplayResult" "$PROJECT_ROOT/src/replay.ts" && \
   grep -q "from './types/index.js'" "$PROJECT_ROOT/src/replay.ts"; then
    pass "ReplayResult imported from types/index.ts"
else
    fail "ReplayResult should be imported from types/index.ts"
fi

#------------------------------------------------------------------------------
# Test 18: replay.ts exports replay function
#------------------------------------------------------------------------------
echo "Test 18: replay.ts exports replay function"

if grep -q "export async function replay" "$PROJECT_ROOT/src/replay.ts"; then
    pass "replay function is exported"
else
    fail "replay function should be exported"
fi

#------------------------------------------------------------------------------
# Test 19: replay.ts exports replayLast function
#------------------------------------------------------------------------------
echo "Test 19: replay.ts exports replayLast function"

if grep -q "export async function replayLast" "$PROJECT_ROOT/src/replay.ts"; then
    pass "replayLast function is exported"
else
    fail "replayLast function should be exported"
fi

#------------------------------------------------------------------------------
# Test 20: replay.ts exports replayAllFailed function
#------------------------------------------------------------------------------
echo "Test 20: replay.ts exports replayAllFailed function"

if grep -q "export async function replayAllFailed" "$PROJECT_ROOT/src/replay.ts"; then
    pass "replayAllFailed function is exported"
else
    fail "replayAllFailed function should be exported"
fi

#------------------------------------------------------------------------------
# Test 21: replay.ts has loadTaskMetrics function
#------------------------------------------------------------------------------
echo "Test 21: replay.ts has loadTaskMetrics function"

if grep -q "function loadTaskMetrics" "$PROJECT_ROOT/src/replay.ts"; then
    pass "loadTaskMetrics function exists"
else
    fail "loadTaskMetrics function should exist"
fi

#------------------------------------------------------------------------------
# Test 22: replay.ts has loadSessionStats function
#------------------------------------------------------------------------------
echo "Test 22: replay.ts has loadSessionStats function"

if grep -q "function loadSessionStats" "$PROJECT_ROOT/src/replay.ts"; then
    pass "loadSessionStats function exists"
else
    fail "loadSessionStats function should exist"
fi

#------------------------------------------------------------------------------
# Test 23: replay.ts has getFailedTasks function
#------------------------------------------------------------------------------
echo "Test 23: replay.ts has getFailedTasks function"

if grep -q "function getFailedTasks" "$PROJECT_ROOT/src/replay.ts"; then
    pass "getFailedTasks function exists"
else
    fail "getFailedTasks function should exist"
fi

#------------------------------------------------------------------------------
# Test 24: replay.ts has moveIssueToReady function
#------------------------------------------------------------------------------
echo "Test 24: replay.ts has moveIssueToReady function"

if grep -q "function moveIssueToReady" "$PROJECT_ROOT/src/replay.ts"; then
    pass "moveIssueToReady function exists"
else
    fail "moveIssueToReady function should exist to queue task for retry"
fi

#------------------------------------------------------------------------------
# Test 25: replay.ts has incrementRetryCount function
#------------------------------------------------------------------------------
echo "Test 25: replay.ts has incrementRetryCount function"

if grep -q "function incrementRetryCount" "$PROJECT_ROOT/src/replay.ts"; then
    pass "incrementRetryCount function exists"
else
    fail "incrementRetryCount function should exist for tracking retries in metrics"
fi

#------------------------------------------------------------------------------
# Test 26: replay.ts loads from chadgi-metrics.json
#------------------------------------------------------------------------------
echo "Test 26: replay.ts loads from chadgi-metrics.json"

if grep -q "chadgi-metrics.json" "$PROJECT_ROOT/src/replay.ts"; then
    pass "Loads from chadgi-metrics.json"
else
    fail "Should load from chadgi-metrics.json"
fi

#------------------------------------------------------------------------------
# Test 27: replay.ts loads from chadgi-stats.json
#------------------------------------------------------------------------------
echo "Test 27: replay.ts loads from chadgi-stats.json"

if grep -q "chadgi-stats.json" "$PROJECT_ROOT/src/replay.ts"; then
    pass "Loads from chadgi-stats.json"
else
    fail "Should load from chadgi-stats.json"
fi

#------------------------------------------------------------------------------
# Test 28: replay.ts has branchExistsLocally function
#------------------------------------------------------------------------------
echo "Test 28: replay.ts has branchExistsLocally function"

if grep -q "function branchExistsLocally" "$PROJECT_ROOT/src/replay.ts"; then
    pass "branchExistsLocally function exists"
else
    fail "branchExistsLocally function should exist for branch management"
fi

#------------------------------------------------------------------------------
# Test 29: replay.ts has branchExistsRemote function
#------------------------------------------------------------------------------
echo "Test 29: replay.ts has branchExistsRemote function"

if grep -q "function branchExistsRemote" "$PROJECT_ROOT/src/replay.ts"; then
    pass "branchExistsRemote function exists"
else
    fail "branchExistsRemote function should exist for branch management"
fi

#------------------------------------------------------------------------------
# Test 30: replay.ts has deleteLocalBranch function
#------------------------------------------------------------------------------
echo "Test 30: replay.ts has deleteLocalBranch function"

if grep -q "function deleteLocalBranch" "$PROJECT_ROOT/src/replay.ts"; then
    pass "deleteLocalBranch function exists"
else
    fail "deleteLocalBranch function should exist for --fresh flag"
fi

#------------------------------------------------------------------------------
# Test 31: replay.ts has deleteRemoteBranch function
#------------------------------------------------------------------------------
echo "Test 31: replay.ts has deleteRemoteBranch function"

if grep -q "function deleteRemoteBranch" "$PROJECT_ROOT/src/replay.ts"; then
    pass "deleteRemoteBranch function exists"
else
    fail "deleteRemoteBranch function should exist for --fresh flag"
fi

#------------------------------------------------------------------------------
# Test 32: replay.ts has printFailedTaskHistory function
#------------------------------------------------------------------------------
echo "Test 32: replay.ts has printFailedTaskHistory function"

if grep -q "function printFailedTaskHistory" "$PROJECT_ROOT/src/replay.ts"; then
    pass "printFailedTaskHistory function exists"
else
    fail "printFailedTaskHistory function should exist for display"
fi

#------------------------------------------------------------------------------
# Test 33: replay.ts has getMostRecentSession function
#------------------------------------------------------------------------------
echo "Test 33: replay.ts has getMostRecentSession function"

if grep -q "function getMostRecentSession" "$PROJECT_ROOT/src/replay.ts"; then
    pass "getMostRecentSession function exists"
else
    fail "getMostRecentSession function should exist for --all-failed flag"
fi

#------------------------------------------------------------------------------
# Test 34: types/index.ts FailedTask includes hasBranch flag
#------------------------------------------------------------------------------
echo "Test 34: types/index.ts FailedTask includes hasBranch flag"

if grep -A25 "interface FailedTask" "$PROJECT_ROOT/src/types/index.ts" | grep -q "hasBranch"; then
    pass "FailedTask includes hasBranch"
else
    fail "FailedTask should include hasBranch flag"
fi

#------------------------------------------------------------------------------
# Test 35: types/index.ts FailedTask includes failurePhase
#------------------------------------------------------------------------------
echo "Test 35: types/index.ts FailedTask includes failurePhase"

if grep -A25 "interface FailedTask" "$PROJECT_ROOT/src/types/index.ts" | grep -q "failurePhase"; then
    pass "FailedTask includes failurePhase"
else
    fail "FailedTask should include failurePhase"
fi

#------------------------------------------------------------------------------
# Test 36: replay.ts has issueExists function
#------------------------------------------------------------------------------
echo "Test 36: replay.ts has issueExists function"

if grep -q "function issueExists" "$PROJECT_ROOT/src/replay.ts"; then
    pass "issueExists function exists"
else
    fail "issueExists function should exist to validate issues before replay"
fi

#------------------------------------------------------------------------------
# Test 37: replay.ts has promptConfirmation function
#------------------------------------------------------------------------------
echo "Test 37: replay.ts has promptConfirmation function"

if grep -q "function promptConfirmation" "$PROJECT_ROOT/src/replay.ts"; then
    pass "promptConfirmation function exists"
else
    fail "promptConfirmation function should exist for user confirmation"
fi

#------------------------------------------------------------------------------
# Test 38: replay command description is set
#------------------------------------------------------------------------------
echo "Test 38: replay command description is set"

if grep -A2 "command('replay" "$PROJECT_ROOT/src/cli.ts" | grep -q "description"; then
    pass "replay command has description"
else
    fail "replay command should have a description"
fi

#------------------------------------------------------------------------------
# Test 39: types/index.ts ReplayResult includes replayedTasks array
#------------------------------------------------------------------------------
echo "Test 39: types/index.ts ReplayResult includes replayedTasks array"

if grep -A10 "interface ReplayResult" "$PROJECT_ROOT/src/types/index.ts" | grep -q "replayedTasks"; then
    pass "ReplayResult includes replayedTasks"
else
    fail "ReplayResult should include replayedTasks array for JSON output"
fi

#------------------------------------------------------------------------------
# Test 40: replay.ts handles dry-run mode
#------------------------------------------------------------------------------
echo "Test 40: replay.ts handles dry-run mode"

if grep -q "dryRun" "$PROJECT_ROOT/src/replay.ts"; then
    pass "Handles dry-run mode"
else
    fail "Should handle dry-run mode"
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

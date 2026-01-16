#!/bin/bash
#
# Tests for Watch command functionality
#
# Run with: bash tests/test-watch.sh
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
echo "  Watch Command Tests"
echo "=========================================="
echo ""

#------------------------------------------------------------------------------
# Test 1: watch.ts file exists
#------------------------------------------------------------------------------
echo "Test 1: watch.ts file exists"

if [ -f "$PROJECT_ROOT/src/watch.ts" ]; then
    pass "watch.ts file exists"
else
    fail "watch.ts should exist"
fi

#------------------------------------------------------------------------------
# Test 2: CLI has watch command
#------------------------------------------------------------------------------
echo "Test 2: CLI has watch command"

if grep -q "command('watch')" "$PROJECT_ROOT/src/cli.ts"; then
    pass "watch command exists in CLI"
else
    fail "watch command should exist in CLI"
fi

#------------------------------------------------------------------------------
# Test 3: CLI imports watch module
#------------------------------------------------------------------------------
echo "Test 3: CLI imports watch module"

if grep -q "import { watch }" "$PROJECT_ROOT/src/cli.ts"; then
    pass "watch module imported in CLI"
else
    fail "watch module should be imported in CLI"
fi

#------------------------------------------------------------------------------
# Test 4: watch command has --once option
#------------------------------------------------------------------------------
echo "Test 4: watch command has --once option"

if grep -A10 "command('watch')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-once"; then
    pass "--once option exists for watch"
else
    fail "watch should have --once option"
fi

#------------------------------------------------------------------------------
# Test 5: watch command has --json option
#------------------------------------------------------------------------------
echo "Test 5: watch command has --json option"

if grep -A10 "command('watch')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-json"; then
    pass "--json option exists for watch"
else
    fail "watch should have --json option"
fi

#------------------------------------------------------------------------------
# Test 6: watch command has --interval option
#------------------------------------------------------------------------------
echo "Test 6: watch command has --interval option"

if grep -A10 "command('watch')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-interval"; then
    pass "--interval option exists for watch"
else
    fail "watch should have --interval option"
fi

#------------------------------------------------------------------------------
# Test 7: watch.ts exports watch function
#------------------------------------------------------------------------------
echo "Test 7: watch.ts exports watch function"

if grep -q 'export async function watch' "$PROJECT_ROOT/src/watch.ts"; then
    pass "watch function is exported"
else
    fail "watch function should be exported"
fi

#------------------------------------------------------------------------------
# Test 8: watch.ts has WatchOptions interface
#------------------------------------------------------------------------------
echo "Test 8: watch.ts has WatchOptions interface"

if grep -q 'interface WatchOptions' "$PROJECT_ROOT/src/watch.ts"; then
    pass "WatchOptions interface exists"
else
    fail "watch should have WatchOptions interface"
fi

#------------------------------------------------------------------------------
# Test 9: watch.ts has WatchStatus interface
#------------------------------------------------------------------------------
echo "Test 9: watch.ts has WatchStatus interface"

if grep -q 'interface WatchStatus' "$PROJECT_ROOT/src/watch.ts"; then
    pass "WatchStatus interface exists"
else
    fail "watch should have WatchStatus interface"
fi

#------------------------------------------------------------------------------
# Test 10: watch.ts handles JSON output
#------------------------------------------------------------------------------
echo "Test 10: watch.ts handles JSON output"

if grep -q 'options.json' "$PROJECT_ROOT/src/watch.ts"; then
    pass "JSON output is handled"
else
    fail "watch should handle JSON output"
fi

#------------------------------------------------------------------------------
# Test 11: watch.ts handles once option
#------------------------------------------------------------------------------
echo "Test 11: watch.ts handles once option"

if grep -q 'options.once' "$PROJECT_ROOT/src/watch.ts"; then
    pass "Once option is handled"
else
    fail "watch should handle once option"
fi

#------------------------------------------------------------------------------
# Test 12: watch.ts handles interval option
#------------------------------------------------------------------------------
echo "Test 12: watch.ts handles interval option"

if grep -q 'options.interval' "$PROJECT_ROOT/src/watch.ts"; then
    pass "Interval option is handled"
else
    fail "watch should handle interval option"
fi

#------------------------------------------------------------------------------
# Test 13: watch.ts reads progress file
#------------------------------------------------------------------------------
echo "Test 13: watch.ts reads progress file"

if grep -q 'chadgi-progress.json' "$PROJECT_ROOT/src/watch.ts"; then
    pass "Progress file is read"
else
    fail "watch should read progress file"
fi

#------------------------------------------------------------------------------
# Test 14: watch.ts has color constants
#------------------------------------------------------------------------------
echo "Test 14: watch.ts has color constants"

if grep -q "colors = {\|from './utils/colors.js'" "$PROJECT_ROOT/src/watch.ts"; then
    pass "Color constants exist"
else
    fail "watch should have color constants for output"
fi

#------------------------------------------------------------------------------
# Test 15: watch.ts has cursor control constants
#------------------------------------------------------------------------------
echo "Test 15: watch.ts has cursor control constants"

if grep -q "cursor = {" "$PROJECT_ROOT/src/watch.ts"; then
    pass "Cursor control constants exist"
else
    fail "watch should have cursor control constants"
fi

#------------------------------------------------------------------------------
# Test 16: watch.ts checks session active state
#------------------------------------------------------------------------------
echo "Test 16: watch.ts checks session active state"

if grep -q 'isSessionActive\|active:' "$PROJECT_ROOT/src/watch.ts"; then
    pass "Session active state is checked"
else
    fail "watch should check session active state"
fi

#------------------------------------------------------------------------------
# Test 17: watch.ts displays current task info
#------------------------------------------------------------------------------
echo "Test 17: watch.ts displays current task info"

if grep -q 'currentTask' "$PROJECT_ROOT/src/watch.ts"; then
    pass "Current task info is displayed"
else
    fail "watch should display current task info"
fi

#------------------------------------------------------------------------------
# Test 18: watch.ts displays phase info
#------------------------------------------------------------------------------
echo "Test 18: watch.ts displays phase info"

if grep -q 'phase' "$PROJECT_ROOT/src/watch.ts"; then
    pass "Phase info is displayed"
else
    fail "watch should display phase info"
fi

#------------------------------------------------------------------------------
# Test 19: watch.ts displays iteration info
#------------------------------------------------------------------------------
echo "Test 19: watch.ts displays iteration info"

if grep -q 'iteration' "$PROJECT_ROOT/src/watch.ts"; then
    pass "Iteration info is displayed"
else
    fail "watch should display iteration info"
fi

#------------------------------------------------------------------------------
# Test 20: watch.ts handles no session gracefully
#------------------------------------------------------------------------------
echo "Test 20: watch.ts handles no session gracefully"

if grep -q "no_session\|No active.*session" "$PROJECT_ROOT/src/watch.ts"; then
    pass "No session case is handled"
else
    fail "watch should handle no session gracefully"
fi

#------------------------------------------------------------------------------
# Test 21: watch.ts displays elapsed time
#------------------------------------------------------------------------------
echo "Test 21: watch.ts displays elapsed time"

if grep -q 'elapsedSeconds\|formatDuration' "$PROJECT_ROOT/src/watch.ts"; then
    pass "Elapsed time is displayed"
else
    fail "watch should display elapsed time"
fi

#------------------------------------------------------------------------------
# Test 22: watch.ts has formatDuration function
#------------------------------------------------------------------------------
echo "Test 22: watch.ts has formatDuration function"

if grep -q 'function formatDuration' "$PROJECT_ROOT/src/watch.ts"; then
    pass "formatDuration function exists"
else
    fail "watch should have formatDuration function"
fi

#------------------------------------------------------------------------------
# Test 23: watch.ts uses file watching
#------------------------------------------------------------------------------
echo "Test 23: watch.ts uses file watching"

if grep -q 'watchFile\|fs.watch' "$PROJECT_ROOT/src/watch.ts"; then
    pass "File watching is used"
else
    fail "watch should use file watching for updates"
fi

#------------------------------------------------------------------------------
# Test 24: watch.ts cleans up on exit
#------------------------------------------------------------------------------
echo "Test 24: watch.ts cleans up on exit"

if grep -q 'SIGINT\|SIGTERM\|cleanup' "$PROJECT_ROOT/src/watch.ts"; then
    pass "Cleanup on exit is handled"
else
    fail "watch should clean up on exit"
fi

#------------------------------------------------------------------------------
# Test 25: watch.ts renders dashboard
#------------------------------------------------------------------------------
echo "Test 25: watch.ts renders dashboard"

if grep -q 'renderDashboard\|CHADGI WATCH' "$PROJECT_ROOT/src/watch.ts"; then
    pass "Dashboard rendering exists"
else
    fail "watch should render dashboard"
fi

#------------------------------------------------------------------------------
# Test 26: watch.ts displays session stats
#------------------------------------------------------------------------------
echo "Test 26: watch.ts displays session stats"

if grep -q 'session\|tasksCompleted\|totalCostUsd' "$PROJECT_ROOT/src/watch.ts"; then
    pass "Session stats are displayed"
else
    fail "watch should display session stats"
fi

#------------------------------------------------------------------------------
# Test 27: watch.ts handles state colors
#------------------------------------------------------------------------------
echo "Test 27: watch.ts handles state colors"

if grep -q 'getStateColor' "$PROJECT_ROOT/src/watch.ts"; then
    pass "State colors are handled"
else
    fail "watch should handle state colors"
fi

#------------------------------------------------------------------------------
# Test 28: watch.ts handles phase colors
#------------------------------------------------------------------------------
echo "Test 28: watch.ts handles phase colors"

if grep -q 'getPhaseColor\|phaseColor' "$PROJECT_ROOT/src/watch.ts"; then
    pass "Phase colors are handled"
else
    fail "watch should handle phase colors"
fi

#------------------------------------------------------------------------------
# Test 29: watch.ts imports ProgressData from types/index.ts
#------------------------------------------------------------------------------
echo "Test 29: watch.ts imports ProgressData from types/index.ts"

if grep -q 'ProgressData' "$PROJECT_ROOT/src/watch.ts" && \
   grep -q "from './types/index.js'" "$PROJECT_ROOT/src/watch.ts"; then
    pass "ProgressData is imported from types/index.ts"
else
    fail "watch should import ProgressData from types/index.ts"
fi

#------------------------------------------------------------------------------
# Test 30: watch.ts builds watch status
#------------------------------------------------------------------------------
echo "Test 30: watch.ts builds watch status"

if grep -q 'buildWatchStatus' "$PROJECT_ROOT/src/watch.ts"; then
    pass "buildWatchStatus function exists"
else
    fail "watch should have buildWatchStatus function"
fi

#------------------------------------------------------------------------------
# Test 31: watch.ts reads progress file function
#------------------------------------------------------------------------------
echo "Test 31: watch.ts reads progress file function"

if grep -q 'readProgressFile' "$PROJECT_ROOT/src/watch.ts"; then
    pass "readProgressFile function exists"
else
    fail "watch should have readProgressFile function"
fi

#------------------------------------------------------------------------------
# Test 32: watch.ts handles different states
#------------------------------------------------------------------------------
echo "Test 32: watch.ts handles different states"

if grep -q "'running'\|'paused'\|'stopped'\|'idle'\|'error'" "$PROJECT_ROOT/src/watch.ts"; then
    pass "Different states are handled"
else
    fail "watch should handle different states"
fi

#------------------------------------------------------------------------------
# Test 33: watch.ts handles implementation phase
#------------------------------------------------------------------------------
echo "Test 33: watch.ts handles implementation phase"

if grep -q "'implementation'" "$PROJECT_ROOT/src/watch.ts"; then
    pass "Implementation phase is handled"
else
    fail "watch should handle implementation phase"
fi

#------------------------------------------------------------------------------
# Test 34: watch.ts handles verification phase
#------------------------------------------------------------------------------
echo "Test 34: watch.ts handles verification phase"

if grep -q "'verification'" "$PROJECT_ROOT/src/watch.ts"; then
    pass "Verification phase is handled"
else
    fail "watch should handle verification phase"
fi

#------------------------------------------------------------------------------
# Test 35: watch.ts handles pr_creation phase
#------------------------------------------------------------------------------
echo "Test 35: watch.ts handles pr_creation phase"

if grep -q "'pr_creation'" "$PROJECT_ROOT/src/watch.ts"; then
    pass "PR creation phase is handled"
else
    fail "watch should handle PR creation phase"
fi

#------------------------------------------------------------------------------
# Test 36: watch.ts has spinner animation
#------------------------------------------------------------------------------
echo "Test 36: watch.ts has spinner animation"

if grep -q 'getSpinner\|spinner' "$PROJECT_ROOT/src/watch.ts"; then
    pass "Spinner animation exists"
else
    fail "watch should have spinner animation for active state"
fi

#------------------------------------------------------------------------------
# Test 37: watch.ts truncates long strings
#------------------------------------------------------------------------------
echo "Test 37: watch.ts truncates long strings"

if grep -q 'truncate' "$PROJECT_ROOT/src/watch.ts"; then
    pass "String truncation function exists"
else
    fail "watch should truncate long strings"
fi

#------------------------------------------------------------------------------
# Test 38: watch.ts hides cursor during live mode
#------------------------------------------------------------------------------
echo "Test 38: watch.ts hides cursor during live mode"

if grep -q 'cursor.hide\|hide:' "$PROJECT_ROOT/src/watch.ts"; then
    pass "Cursor hiding is implemented"
else
    fail "watch should hide cursor during live mode"
fi

#------------------------------------------------------------------------------
# Test 39: watch.ts shows cursor on exit
#------------------------------------------------------------------------------
echo "Test 39: watch.ts shows cursor on exit"

if grep -q 'cursor.show\|show:' "$PROJECT_ROOT/src/watch.ts"; then
    pass "Cursor showing on exit is implemented"
else
    fail "watch should show cursor on exit"
fi

#------------------------------------------------------------------------------
# Test 40: watch.ts has progress bar rendering
#------------------------------------------------------------------------------
echo "Test 40: watch.ts has progress bar rendering"

if grep -q 'renderProgressBar\|progressBar' "$PROJECT_ROOT/src/watch.ts"; then
    pass "Progress bar rendering exists"
else
    fail "watch should have progress bar rendering"
fi

#------------------------------------------------------------------------------
# Test 41: watch.ts displays last updated time
#------------------------------------------------------------------------------
echo "Test 41: watch.ts displays last updated time"

if grep -q 'lastUpdated\|last_updated' "$PROJECT_ROOT/src/watch.ts"; then
    pass "Last updated time is displayed"
else
    fail "watch should display last updated time"
fi

#------------------------------------------------------------------------------
# Test 42: watch.ts has clear screen functionality
#------------------------------------------------------------------------------
echo "Test 42: watch.ts has clear screen functionality"

if grep -q 'clearScreen' "$PROJECT_ROOT/src/watch.ts"; then
    pass "Clear screen functionality exists"
else
    fail "watch should have clear screen functionality"
fi

#------------------------------------------------------------------------------
# Test 43: watch.ts handles recent tools display
#------------------------------------------------------------------------------
echo "Test 43: watch.ts handles recent tools display"

if grep -q 'recentTools\|recent_tools' "$PROJECT_ROOT/src/watch.ts"; then
    pass "Recent tools display is handled"
else
    fail "watch should handle recent tools display"
fi

#------------------------------------------------------------------------------
# Test 44: watch command has config option
#------------------------------------------------------------------------------
echo "Test 44: watch command has config option"

if grep -A10 "command('watch')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-config"; then
    pass "--config option exists for watch"
else
    fail "watch should have --config option"
fi

#------------------------------------------------------------------------------
# Test 45: watch.ts checks .chadgi directory
#------------------------------------------------------------------------------
echo "Test 45: watch.ts checks .chadgi directory"

if grep -q ".chadgi\|chadgiDir" "$PROJECT_ROOT/src/watch.ts"; then
    pass ".chadgi directory is checked"
else
    fail "watch should check .chadgi directory"
fi

#------------------------------------------------------------------------------
# Test 46: README documents watch command
#------------------------------------------------------------------------------
echo "Test 46: README documents watch command"

if grep -q "chadgi watch" "$PROJECT_ROOT/README.md"; then
    pass "watch command is documented in README"
else
    fail "watch command should be documented in README"
fi

#------------------------------------------------------------------------------
# Test 47: README documents --once flag
#------------------------------------------------------------------------------
echo "Test 47: README documents --once flag"

if grep -q "\-\-once" "$PROJECT_ROOT/README.md"; then
    pass "--once flag is documented in README"
else
    fail "--once flag should be documented in README"
fi

#------------------------------------------------------------------------------
# Test 48: README documents --json flag for watch
#------------------------------------------------------------------------------
echo "Test 48: README documents --json flag for watch"

if grep -q "chadgi watch.*json\|watch.*--json" "$PROJECT_ROOT/README.md"; then
    pass "--json flag for watch is documented in README"
else
    fail "--json flag for watch should be documented in README"
fi

#------------------------------------------------------------------------------
# Test 49: watch.ts unwatches file on cleanup
#------------------------------------------------------------------------------
echo "Test 49: watch.ts unwatches file on cleanup"

if grep -q 'unwatchFile' "$PROJECT_ROOT/src/watch.ts"; then
    pass "File unwatching on cleanup exists"
else
    fail "watch should unwatch file on cleanup"
fi

#------------------------------------------------------------------------------
# Test 50: watch.ts has formatDate function
#------------------------------------------------------------------------------
echo "Test 50: watch.ts has formatDate function"

if grep -q 'function formatDate\|formatDate(' "$PROJECT_ROOT/src/watch.ts"; then
    pass "formatDate function exists"
else
    fail "watch should have formatDate function"
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

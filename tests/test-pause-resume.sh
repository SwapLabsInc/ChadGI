#!/bin/bash
#
# Tests for Pause/Resume/Status functionality
#
# Run with: bash tests/test-pause-resume.sh
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
echo "  Pause/Resume/Status Tests"
echo "=========================================="
echo ""

#------------------------------------------------------------------------------
# Test 1: pause.ts file exists
#------------------------------------------------------------------------------
echo "Test 1: pause.ts file exists"

if [ -f "$PROJECT_ROOT/src/pause.ts" ]; then
    pass "pause.ts file exists"
else
    fail "pause.ts should exist"
fi

#------------------------------------------------------------------------------
# Test 2: resume.ts file exists
#------------------------------------------------------------------------------
echo "Test 2: resume.ts file exists"

if [ -f "$PROJECT_ROOT/src/resume.ts" ]; then
    pass "resume.ts file exists"
else
    fail "resume.ts should exist"
fi

#------------------------------------------------------------------------------
# Test 3: status.ts file exists
#------------------------------------------------------------------------------
echo "Test 3: status.ts file exists"

if [ -f "$PROJECT_ROOT/src/status.ts" ]; then
    pass "status.ts file exists"
else
    fail "status.ts should exist"
fi

#------------------------------------------------------------------------------
# Test 4: CLI has pause command
#------------------------------------------------------------------------------
echo "Test 4: CLI has pause command"

if grep -q "command('pause')" "$PROJECT_ROOT/src/cli.ts"; then
    pass "pause command exists in CLI"
else
    fail "pause command should exist in CLI"
fi

#------------------------------------------------------------------------------
# Test 5: CLI has resume command
#------------------------------------------------------------------------------
echo "Test 5: CLI has resume command"

if grep -q "command('resume')" "$PROJECT_ROOT/src/cli.ts"; then
    pass "resume command exists in CLI"
else
    fail "resume command should exist in CLI"
fi

#------------------------------------------------------------------------------
# Test 6: CLI has status command
#------------------------------------------------------------------------------
echo "Test 6: CLI has status command"

if grep -q "command('status')" "$PROJECT_ROOT/src/cli.ts"; then
    pass "status command exists in CLI"
else
    fail "status command should exist in CLI"
fi

#------------------------------------------------------------------------------
# Test 7: CLI imports pause module
#------------------------------------------------------------------------------
echo "Test 7: CLI imports pause module"

if grep -q "import { pause }" "$PROJECT_ROOT/src/cli.ts"; then
    pass "pause module imported in CLI"
else
    fail "pause module should be imported in CLI"
fi

#------------------------------------------------------------------------------
# Test 8: CLI imports resume module
#------------------------------------------------------------------------------
echo "Test 8: CLI imports resume module"

if grep -q "import { resume }" "$PROJECT_ROOT/src/cli.ts"; then
    pass "resume module imported in CLI"
else
    fail "resume module should be imported in CLI"
fi

#------------------------------------------------------------------------------
# Test 9: CLI imports status module
#------------------------------------------------------------------------------
echo "Test 9: CLI imports status module"

if grep -q "import { status }" "$PROJECT_ROOT/src/cli.ts"; then
    pass "status module imported in CLI"
else
    fail "status module should be imported in CLI"
fi

#------------------------------------------------------------------------------
# Test 10: PAUSE_LOCK_FILE variable exists in bash script
#------------------------------------------------------------------------------
echo "Test 10: PAUSE_LOCK_FILE variable exists in bash script"

if grep -q 'PAUSE_LOCK_FILE=' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "PAUSE_LOCK_FILE variable exists"
else
    fail "PAUSE_LOCK_FILE variable should exist in chadgi.sh"
fi

#------------------------------------------------------------------------------
# Test 11: check_pause_lock function exists
#------------------------------------------------------------------------------
echo "Test 11: check_pause_lock function exists"

if grep -q 'check_pause_lock()' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "check_pause_lock function exists"
else
    fail "check_pause_lock function should exist"
fi

#------------------------------------------------------------------------------
# Test 12: check_pause_lock is called in main loop
#------------------------------------------------------------------------------
echo "Test 12: check_pause_lock is called in main loop"

# Count occurrences of check_pause_lock - should be at least 3 (1 definition + 2 calls)
PAUSE_CALLS=$(grep -c 'check_pause_lock' "$PROJECT_ROOT/scripts/chadgi.sh" || echo "0")
if [ "$PAUSE_CALLS" -ge 3 ]; then
    pass "check_pause_lock is called in main loop ($PAUSE_CALLS occurrences)"
else
    fail "check_pause_lock should be called in main loop (found $PAUSE_CALLS occurrences)"
fi

#------------------------------------------------------------------------------
# Test 13: pause command has --for option
#------------------------------------------------------------------------------
echo "Test 13: pause command has --for option"

if grep -q "\-\-for" "$PROJECT_ROOT/src/cli.ts" || grep -q "'-f, --for'" "$PROJECT_ROOT/src/cli.ts"; then
    pass "--for option exists for pause command"
else
    fail "pause command should have --for option"
fi

#------------------------------------------------------------------------------
# Test 14: pause command has --reason option
#------------------------------------------------------------------------------
echo "Test 14: pause command has --reason option"

if grep -q "\-\-reason" "$PROJECT_ROOT/src/cli.ts" || grep -q "'-r, --reason'" "$PROJECT_ROOT/src/cli.ts"; then
    pass "--reason option exists for pause command"
else
    fail "pause command should have --reason option"
fi

#------------------------------------------------------------------------------
# Test 15: resume command has --restart option
#------------------------------------------------------------------------------
echo "Test 15: resume command has --restart option"

if grep -q "\-\-restart" "$PROJECT_ROOT/src/cli.ts"; then
    pass "--restart option exists for resume command"
else
    fail "resume command should have --restart option"
fi

#------------------------------------------------------------------------------
# Test 16: status command has --json option
#------------------------------------------------------------------------------
echo "Test 16: status command has --json option"

if grep -A10 "command('status')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-json"; then
    pass "--json option exists for status command"
else
    fail "status command should have --json option"
fi

#------------------------------------------------------------------------------
# Test 17: pause.ts creates pause.lock file
#------------------------------------------------------------------------------
echo "Test 17: pause.ts creates pause.lock file"

if grep -q "pause.lock" "$PROJECT_ROOT/src/pause.ts"; then
    pass "pause.ts references pause.lock file"
else
    fail "pause.ts should create pause.lock file"
fi

#------------------------------------------------------------------------------
# Test 18: resume.ts removes pause.lock file
#------------------------------------------------------------------------------
echo "Test 18: resume.ts removes pause.lock file"

if grep -q "unlinkSync\|unlink\|pause.lock" "$PROJECT_ROOT/src/resume.ts"; then
    pass "resume.ts removes pause.lock file"
else
    fail "resume.ts should remove pause.lock file"
fi

#------------------------------------------------------------------------------
# Test 19: status.ts checks for pause.lock
#------------------------------------------------------------------------------
echo "Test 19: status.ts checks for pause.lock"

if grep -q "pause.lock" "$PROJECT_ROOT/src/status.ts"; then
    pass "status.ts checks for pause.lock file"
else
    fail "status.ts should check for pause.lock file"
fi

#------------------------------------------------------------------------------
# Test 20: save_progress supports paused status
#------------------------------------------------------------------------------
echo "Test 20: Bash script supports 'paused' status"

if grep -q '"paused"' "$PROJECT_ROOT/scripts/chadgi.sh" || grep -q "'paused'" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Bash script supports paused status"
else
    fail "Bash script should support paused status"
fi

#------------------------------------------------------------------------------
# Test 21: Main loop checks for pause at start
#------------------------------------------------------------------------------
echo "Test 21: Main loop checks for pause at start"

# Check that check_pause_lock is called in the main loop (the one that searches for tasks)
# Use a broader grep to find the main loop section
if grep -B2 -A3 "SEARCHING FOR TASKS" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q "check_pause_lock"; then
    pass "Main loop checks for pause at start"
else
    fail "Main loop should check for pause at start of each iteration"
fi

#------------------------------------------------------------------------------
# Test 22: Pause check after task completion
#------------------------------------------------------------------------------
echo "Test 22: Pause check after task completion"

if grep -B5 -A15 "ISSUE #\$ISSUE_NUMBER COMPLETED" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q "PAUSE_LOCK_FILE\|pause"; then
    pass "Pause is checked after task completion"
else
    fail "Pause should be checked after task completion"
fi

#------------------------------------------------------------------------------
# Test 23: status.ts shows current task info
#------------------------------------------------------------------------------
echo "Test 23: status.ts shows current task info"

if grep -q "currentTask\|current_task" "$PROJECT_ROOT/src/status.ts"; then
    pass "status.ts shows current task info"
else
    fail "status.ts should show current task info"
fi

#------------------------------------------------------------------------------
# Test 24: status.ts shows tasks completed count
#------------------------------------------------------------------------------
echo "Test 24: status.ts shows tasks completed count"

if grep -q "tasksCompleted\|tasks_completed\|Completed" "$PROJECT_ROOT/src/status.ts"; then
    pass "status.ts shows tasks completed count"
else
    fail "status.ts should show tasks completed count"
fi

#------------------------------------------------------------------------------
# Test 25: status.ts shows elapsed time
#------------------------------------------------------------------------------
echo "Test 25: status.ts shows elapsed time"

if grep -q "elapsed\|Duration\|formatDuration" "$PROJECT_ROOT/src/status.ts"; then
    pass "status.ts shows elapsed time"
else
    fail "status.ts should show elapsed time"
fi

#------------------------------------------------------------------------------
# Test 26: pause.ts has parseDuration function for --for option
#------------------------------------------------------------------------------
echo "Test 26: pause.ts parses duration strings"

if grep -q "parseDuration\|parse.*[Dd]uration" "$PROJECT_ROOT/src/pause.ts"; then
    pass "pause.ts has duration parsing"
else
    fail "pause.ts should parse duration strings for --for option"
fi

#------------------------------------------------------------------------------
# Test 27: check_pause_lock displays waiting message
#------------------------------------------------------------------------------
echo "Test 27: check_pause_lock displays waiting message"

if grep -A30 "check_pause_lock()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q "PAUSED\|waiting"; then
    pass "check_pause_lock displays waiting message"
else
    fail "check_pause_lock should display waiting message"
fi

#------------------------------------------------------------------------------
# Test 28: check_pause_lock updates progress to paused status
#------------------------------------------------------------------------------
echo "Test 28: check_pause_lock updates progress to paused status"

if grep -A30 "check_pause_lock()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'save_progress "paused"'; then
    pass "check_pause_lock updates progress to paused status"
else
    fail "check_pause_lock should update progress to paused status"
fi

#------------------------------------------------------------------------------
# Test 29: status.ts reads progress file
#------------------------------------------------------------------------------
echo "Test 29: status.ts reads progress file"

if grep -q "chadgi-progress.json\|progressFile\|PROGRESS_FILE" "$PROJECT_ROOT/src/status.ts"; then
    pass "status.ts reads progress file"
else
    fail "status.ts should read progress file"
fi

#------------------------------------------------------------------------------
# Test 30: pause.ts checks if already paused
#------------------------------------------------------------------------------
echo "Test 30: pause.ts checks if already paused"

if grep -q "already paused\|existsSync.*pause" "$PROJECT_ROOT/src/pause.ts"; then
    pass "pause.ts checks if already paused"
else
    fail "pause.ts should check if already paused"
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

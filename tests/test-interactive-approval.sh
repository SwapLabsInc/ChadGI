#!/bin/bash
#
# Tests for Interactive Approval Mode functionality
#
# Run with: bash tests/test-interactive-approval.sh
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
echo "  Interactive Approval Mode Tests"
echo "=========================================="
echo ""

#------------------------------------------------------------------------------
# Test 1: approve.ts file exists
#------------------------------------------------------------------------------
echo "Test 1: approve.ts file exists"

if [ -f "$PROJECT_ROOT/src/approve.ts" ]; then
    pass "approve.ts file exists"
else
    fail "approve.ts should exist"
fi

#------------------------------------------------------------------------------
# Test 2: CLI has approve command
#------------------------------------------------------------------------------
echo "Test 2: CLI has approve command"

if grep -q "command.*approve" "$PROJECT_ROOT/src/cli.ts"; then
    pass "approve command exists in CLI"
else
    fail "approve command should exist in CLI"
fi

#------------------------------------------------------------------------------
# Test 3: CLI has reject command
#------------------------------------------------------------------------------
echo "Test 3: CLI has reject command"

if grep -q "command.*reject" "$PROJECT_ROOT/src/cli.ts"; then
    pass "reject command exists in CLI"
else
    fail "reject command should exist in CLI"
fi

#------------------------------------------------------------------------------
# Test 4: CLI imports approve module
#------------------------------------------------------------------------------
echo "Test 4: CLI imports approve module"

if grep -q "import { approve, reject }" "$PROJECT_ROOT/src/cli.ts"; then
    pass "approve module imported in CLI"
else
    fail "approve module should be imported in CLI"
fi

#------------------------------------------------------------------------------
# Test 5: Start command has --interactive flag
#------------------------------------------------------------------------------
echo "Test 5: Start command has --interactive flag"

if grep -q "\-\-interactive\|'-i, --interactive'" "$PROJECT_ROOT/src/cli.ts"; then
    pass "--interactive flag exists for start command"
else
    fail "start command should have --interactive flag"
fi

#------------------------------------------------------------------------------
# Test 6: start.ts has interactive option in StartOptions
#------------------------------------------------------------------------------
echo "Test 6: start.ts has interactive option"

if grep -q "interactive.*boolean" "$PROJECT_ROOT/src/start.ts"; then
    pass "interactive option exists in StartOptions"
else
    fail "StartOptions should have interactive option"
fi

#------------------------------------------------------------------------------
# Test 7: start.ts sets INTERACTIVE_MODE environment variable
#------------------------------------------------------------------------------
echo "Test 7: start.ts sets INTERACTIVE_MODE environment variable"

if grep -q "INTERACTIVE_MODE" "$PROJECT_ROOT/src/start.ts"; then
    pass "INTERACTIVE_MODE environment variable is set"
else
    fail "start.ts should set INTERACTIVE_MODE environment variable"
fi

#------------------------------------------------------------------------------
# Test 8: chadgi.sh has INTERACTIVE_MODE variable
#------------------------------------------------------------------------------
echo "Test 8: chadgi.sh has INTERACTIVE_MODE variable"

if grep -q 'INTERACTIVE_MODE=' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "INTERACTIVE_MODE variable exists in chadgi.sh"
else
    fail "INTERACTIVE_MODE variable should exist in chadgi.sh"
fi

#------------------------------------------------------------------------------
# Test 9: chadgi.sh has INTERACTIVE_ENABLED variable
#------------------------------------------------------------------------------
echo "Test 9: chadgi.sh has INTERACTIVE_ENABLED variable"

if grep -q 'INTERACTIVE_ENABLED=' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "INTERACTIVE_ENABLED variable exists in chadgi.sh"
else
    fail "INTERACTIVE_ENABLED variable should exist in chadgi.sh"
fi

#------------------------------------------------------------------------------
# Test 10: chadgi.sh has wait_for_approval function
#------------------------------------------------------------------------------
echo "Test 10: chadgi.sh has wait_for_approval function"

if grep -q 'wait_for_approval()' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "wait_for_approval function exists"
else
    fail "wait_for_approval function should exist"
fi

#------------------------------------------------------------------------------
# Test 11: chadgi.sh has create_approval_lock function
#------------------------------------------------------------------------------
echo "Test 11: chadgi.sh has create_approval_lock function"

if grep -q 'create_approval_lock()' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "create_approval_lock function exists"
else
    fail "create_approval_lock function should exist"
fi

#------------------------------------------------------------------------------
# Test 12: chadgi.sh has display_approval_prompt function
#------------------------------------------------------------------------------
echo "Test 12: chadgi.sh has display_approval_prompt function"

if grep -q 'display_approval_prompt()' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "display_approval_prompt function exists"
else
    fail "display_approval_prompt function should exist"
fi

#------------------------------------------------------------------------------
# Test 13: approve.ts has approve function
#------------------------------------------------------------------------------
echo "Test 13: approve.ts has approve function"

if grep -q "export async function approve" "$PROJECT_ROOT/src/approve.ts"; then
    pass "approve function is exported"
else
    fail "approve function should be exported"
fi

#------------------------------------------------------------------------------
# Test 14: approve.ts has reject function
#------------------------------------------------------------------------------
echo "Test 14: approve.ts has reject function"

if grep -q "export async function reject" "$PROJECT_ROOT/src/approve.ts"; then
    pass "reject function is exported"
else
    fail "reject function should be exported"
fi

#------------------------------------------------------------------------------
# Test 15: approve.ts handles approval lock files
#------------------------------------------------------------------------------
echo "Test 15: approve.ts handles approval lock files"

if grep -q "approval-.*\.lock" "$PROJECT_ROOT/src/approve.ts"; then
    pass "approve.ts handles approval lock files"
else
    fail "approve.ts should handle approval lock files"
fi

#------------------------------------------------------------------------------
# Test 16: status.ts shows awaiting_approval state
#------------------------------------------------------------------------------
echo "Test 16: status.ts shows awaiting_approval state"

if grep -q "awaiting_approval" "$PROJECT_ROOT/src/status.ts"; then
    pass "status.ts shows awaiting_approval state"
else
    fail "status.ts should show awaiting_approval state"
fi

#------------------------------------------------------------------------------
# Test 17: status.ts has pendingApproval in StatusInfo
#------------------------------------------------------------------------------
echo "Test 17: status.ts has pendingApproval in StatusInfo"

if grep -q "pendingApproval" "$PROJECT_ROOT/src/status.ts"; then
    pass "StatusInfo has pendingApproval field"
else
    fail "StatusInfo should have pendingApproval field"
fi

#------------------------------------------------------------------------------
# Test 18: status.ts finds pending approval files
#------------------------------------------------------------------------------
echo "Test 18: status.ts finds pending approval files"

if grep -q "findPendingApproval" "$PROJECT_ROOT/src/status.ts"; then
    pass "status.ts has findPendingApproval function"
else
    fail "status.ts should have findPendingApproval function"
fi

#------------------------------------------------------------------------------
# Test 19: chadgi.sh has Phase 1 approval checkpoint
#------------------------------------------------------------------------------
echo "Test 19: chadgi.sh has Phase 1 approval checkpoint"

if grep -q "INTERACTIVE.*Phase 1 Approval\|wait_for_approval.*phase1" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Phase 1 approval checkpoint exists"
else
    fail "chadgi.sh should have Phase 1 approval checkpoint"
fi

#------------------------------------------------------------------------------
# Test 20: chadgi.sh has Phase 2 approval checkpoint
#------------------------------------------------------------------------------
echo "Test 20: chadgi.sh has Phase 2 approval checkpoint"

if grep -q "INTERACTIVE.*Phase 2 Approval\|wait_for_approval.*phase2" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Phase 2 approval checkpoint exists"
else
    fail "chadgi.sh should have Phase 2 approval checkpoint"
fi

#------------------------------------------------------------------------------
# Test 21: Keyboard shortcuts are documented
#------------------------------------------------------------------------------
echo "Test 21: Keyboard shortcuts are documented"

if grep -q "y.*Approve\|n.*Reject\|d.*diff\|s.*Skip" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Keyboard shortcuts are documented"
else
    fail "Keyboard shortcuts should be documented"
fi

#------------------------------------------------------------------------------
# Test 22: approve command has --message option
#------------------------------------------------------------------------------
echo "Test 22: approve command has --message option"

if grep -A10 "command.*approve" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-message\|-m.*message"; then
    pass "--message option exists for approve command"
else
    fail "approve command should have --message option"
fi

#------------------------------------------------------------------------------
# Test 23: reject command has --message option
#------------------------------------------------------------------------------
echo "Test 23: reject command has --message option"

if grep -A10 "command.*reject" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-message\|-m.*message"; then
    pass "--message option exists for reject command"
else
    fail "reject command should have --message option"
fi

#------------------------------------------------------------------------------
# Test 24: reject command has --skip option
#------------------------------------------------------------------------------
echo "Test 24: reject command has --skip option"

if grep -A15 "command.*reject" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-skip"; then
    pass "--skip option exists for reject command"
else
    fail "reject command should have --skip option"
fi

#------------------------------------------------------------------------------
# Test 25: approve.ts logs approval decisions
#------------------------------------------------------------------------------
echo "Test 25: approve.ts logs approval decisions"

if grep -q "logApprovalToHistory\|approval_history" "$PROJECT_ROOT/src/approve.ts"; then
    pass "approve.ts logs approval decisions"
else
    fail "approve.ts should log approval decisions"
fi

#------------------------------------------------------------------------------
# Test 26: Config supports interactive settings
#------------------------------------------------------------------------------
echo "Test 26: Config supports interactive settings"

if grep -q "INTERACTIVE_APPROVE_PHASE1\|interactive.*approve_phase1" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Config supports interactive settings"
else
    fail "Config should support interactive settings"
fi

#------------------------------------------------------------------------------
# Test 27: display_diff_summary function exists
#------------------------------------------------------------------------------
echo "Test 27: display_diff_summary function exists"

if grep -q "display_diff_summary()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "display_diff_summary function exists"
else
    fail "display_diff_summary function should exist"
fi

#------------------------------------------------------------------------------
# Test 28: Approval timeout is configurable
#------------------------------------------------------------------------------
echo "Test 28: Approval timeout is configurable"

if grep -q "INTERACTIVE_TIMEOUT" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Approval timeout is configurable"
else
    fail "Approval timeout should be configurable"
fi

#------------------------------------------------------------------------------
# Test 29: get_approval_status function exists
#------------------------------------------------------------------------------
echo "Test 29: get_approval_status function exists"

if grep -q "get_approval_status()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "get_approval_status function exists"
else
    fail "get_approval_status function should exist"
fi

#------------------------------------------------------------------------------
# Test 30: APPROVAL_FEEDBACK variable exists
#------------------------------------------------------------------------------
echo "Test 30: APPROVAL_FEEDBACK variable exists"

if grep -q 'APPROVAL_FEEDBACK=' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "APPROVAL_FEEDBACK variable exists"
else
    fail "APPROVAL_FEEDBACK variable should exist"
fi

#------------------------------------------------------------------------------
# Test 31: Pre-task approval checkpoint exists (optional)
#------------------------------------------------------------------------------
echo "Test 31: Pre-task approval checkpoint exists"

if grep -q "INTERACTIVE_APPROVE_PRE_TASK\|pre_task" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Pre-task approval checkpoint exists"
else
    fail "Pre-task approval checkpoint should exist"
fi

#------------------------------------------------------------------------------
# Test 32: status.ts shows phase name for pending approval
#------------------------------------------------------------------------------
echo "Test 32: status.ts shows phase name for pending approval"

if grep -q "formatPhaseName\|Post-Implementation\|Pre-PR" "$PROJECT_ROOT/src/status.ts"; then
    pass "status.ts shows phase name for pending approval"
else
    fail "status.ts should show phase name for pending approval"
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

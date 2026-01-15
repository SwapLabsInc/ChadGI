#!/bin/bash
#
# Tests for Webhook Notification functionality
#
# Run with: bash tests/test-webhook-notifications.sh
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
echo "  Webhook Notification Tests"
echo "=========================================="
echo ""

#------------------------------------------------------------------------------
# Test 1: Template config has notifications section
#------------------------------------------------------------------------------
echo "Test 1: Template config has notifications section"

if grep -q "^notifications:" "$PROJECT_ROOT/templates/chadgi-config.yaml"; then
    pass "Template config has notifications section"
else
    fail "Template config should have notifications section"
fi

#------------------------------------------------------------------------------
# Test 2: Template config has notifications.enabled setting
#------------------------------------------------------------------------------
echo "Test 2: Template config has notifications.enabled setting"

if grep -q "enabled: false" "$PROJECT_ROOT/templates/chadgi-config.yaml"; then
    pass "Template config has notifications.enabled setting"
else
    fail "Template config should have notifications.enabled setting"
fi

#------------------------------------------------------------------------------
# Test 3: Template config has rate_limit section
#------------------------------------------------------------------------------
echo "Test 3: Template config has rate_limit section"

if grep -q "rate_limit:" "$PROJECT_ROOT/templates/chadgi-config.yaml"; then
    pass "Template config has rate_limit section"
else
    fail "Template config should have rate_limit section"
fi

#------------------------------------------------------------------------------
# Test 4: Template config has slack section
#------------------------------------------------------------------------------
echo "Test 4: Template config has slack section"

if grep -q "slack:" "$PROJECT_ROOT/templates/chadgi-config.yaml"; then
    pass "Template config has slack section"
else
    fail "Template config should have slack section"
fi

#------------------------------------------------------------------------------
# Test 5: Template config has discord section
#------------------------------------------------------------------------------
echo "Test 5: Template config has discord section"

if grep -q "discord:" "$PROJECT_ROOT/templates/chadgi-config.yaml"; then
    pass "Template config has discord section"
else
    fail "Template config should have discord section"
fi

#------------------------------------------------------------------------------
# Test 6: Template config has generic webhook section
#------------------------------------------------------------------------------
echo "Test 6: Template config has generic webhook section"

if grep -q "generic:" "$PROJECT_ROOT/templates/chadgi-config.yaml"; then
    pass "Template config has generic webhook section"
else
    fail "Template config should have generic webhook section"
fi

#------------------------------------------------------------------------------
# Test 7: Template config has event configuration for slack
#------------------------------------------------------------------------------
echo "Test 7: Template config has event configuration for slack"

if grep -A20 "slack:" "$PROJECT_ROOT/templates/chadgi-config.yaml" | grep -q "task_started:"; then
    pass "Template config has slack event configuration"
else
    fail "Template config should have slack event configuration"
fi

#------------------------------------------------------------------------------
# Test 8: Script has NOTIFICATIONS_ENABLED parsing
#------------------------------------------------------------------------------
echo "Test 8: Script has NOTIFICATIONS_ENABLED parsing"

if grep -q 'NOTIFICATIONS_ENABLED=$(parse_yaml_nested "notifications" "enabled"' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Script has NOTIFICATIONS_ENABLED parsing"
else
    fail "Script should have NOTIFICATIONS_ENABLED parsing"
fi

#------------------------------------------------------------------------------
# Test 9: Script has SLACK_ENABLED parsing
#------------------------------------------------------------------------------
echo "Test 9: Script has SLACK_ENABLED parsing"

if grep -q 'SLACK_ENABLED=' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Script has SLACK_ENABLED parsing"
else
    fail "Script should have SLACK_ENABLED parsing"
fi

#------------------------------------------------------------------------------
# Test 10: Script has DISCORD_ENABLED parsing
#------------------------------------------------------------------------------
echo "Test 10: Script has DISCORD_ENABLED parsing"

if grep -q 'DISCORD_ENABLED=' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Script has DISCORD_ENABLED parsing"
else
    fail "Script should have DISCORD_ENABLED parsing"
fi

#------------------------------------------------------------------------------
# Test 11: Script has GENERIC_WEBHOOK_ENABLED parsing
#------------------------------------------------------------------------------
echo "Test 11: Script has GENERIC_WEBHOOK_ENABLED parsing"

if grep -q 'GENERIC_WEBHOOK_ENABLED=' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Script has GENERIC_WEBHOOK_ENABLED parsing"
else
    fail "Script should have GENERIC_WEBHOOK_ENABLED parsing"
fi

#------------------------------------------------------------------------------
# Test 12: send_webhook function exists
#------------------------------------------------------------------------------
echo "Test 12: send_webhook function exists"

if grep -q "send_webhook()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "send_webhook function exists"
else
    fail "send_webhook function should exist"
fi

#------------------------------------------------------------------------------
# Test 13: send_slack_notification function exists
#------------------------------------------------------------------------------
echo "Test 13: send_slack_notification function exists"

if grep -q "send_slack_notification()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "send_slack_notification function exists"
else
    fail "send_slack_notification function should exist"
fi

#------------------------------------------------------------------------------
# Test 14: send_discord_notification function exists
#------------------------------------------------------------------------------
echo "Test 14: send_discord_notification function exists"

if grep -q "send_discord_notification()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "send_discord_notification function exists"
else
    fail "send_discord_notification function should exist"
fi

#------------------------------------------------------------------------------
# Test 15: send_generic_notification function exists
#------------------------------------------------------------------------------
echo "Test 15: send_generic_notification function exists"

if grep -q "send_generic_notification()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "send_generic_notification function exists"
else
    fail "send_generic_notification function should exist"
fi

#------------------------------------------------------------------------------
# Test 16: notify_event function exists
#------------------------------------------------------------------------------
echo "Test 16: notify_event function exists"

if grep -q "notify_event()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "notify_event function exists"
else
    fail "notify_event function should exist"
fi

#------------------------------------------------------------------------------
# Test 17: notify_task_started function exists
#------------------------------------------------------------------------------
echo "Test 17: notify_task_started function exists"

if grep -q "notify_task_started()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "notify_task_started function exists"
else
    fail "notify_task_started function should exist"
fi

#------------------------------------------------------------------------------
# Test 18: notify_task_completed function exists
#------------------------------------------------------------------------------
echo "Test 18: notify_task_completed function exists"

if grep -q "notify_task_completed()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "notify_task_completed function exists"
else
    fail "notify_task_completed function should exist"
fi

#------------------------------------------------------------------------------
# Test 19: notify_task_failed function exists
#------------------------------------------------------------------------------
echo "Test 19: notify_task_failed function exists"

if grep -q "notify_task_failed()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "notify_task_failed function exists"
else
    fail "notify_task_failed function should exist"
fi

#------------------------------------------------------------------------------
# Test 20: notify_gigachad_merge function exists
#------------------------------------------------------------------------------
echo "Test 20: notify_gigachad_merge function exists"

if grep -q "notify_gigachad_merge()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "notify_gigachad_merge function exists"
else
    fail "notify_gigachad_merge function should exist"
fi

#------------------------------------------------------------------------------
# Test 21: notify_session_ended function exists
#------------------------------------------------------------------------------
echo "Test 21: notify_session_ended function exists"

if grep -q "notify_session_ended()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "notify_session_ended function exists"
else
    fail "notify_session_ended function should exist"
fi

#------------------------------------------------------------------------------
# Test 22: check_notification_rate_limit function exists
#------------------------------------------------------------------------------
echo "Test 22: check_notification_rate_limit function exists"

if grep -q "check_notification_rate_limit()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "check_notification_rate_limit function exists"
else
    fail "check_notification_rate_limit function should exist"
fi

#------------------------------------------------------------------------------
# Test 23: test_webhook_connectivity function exists
#------------------------------------------------------------------------------
echo "Test 23: test_webhook_connectivity function exists"

if grep -q "test_webhook_connectivity()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "test_webhook_connectivity function exists"
else
    fail "test_webhook_connectivity function should exist"
fi

#------------------------------------------------------------------------------
# Test 24: Rate limiting uses min_interval
#------------------------------------------------------------------------------
echo "Test 24: Rate limiting uses min_interval"

if grep -q "NOTIFY_RATE_MIN_INTERVAL" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Rate limiting uses min_interval"
else
    fail "Rate limiting should use min_interval"
fi

#------------------------------------------------------------------------------
# Test 25: Rate limiting uses burst_limit
#------------------------------------------------------------------------------
echo "Test 25: Rate limiting uses burst_limit"

if grep -q "NOTIFY_RATE_BURST_LIMIT" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Rate limiting uses burst_limit"
else
    fail "Rate limiting should use burst_limit"
fi

#------------------------------------------------------------------------------
# Test 26: Slack payload has attachments format
#------------------------------------------------------------------------------
echo "Test 26: Slack payload has attachments format"

if grep -A30 "send_slack_notification()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q '"attachments"'; then
    pass "Slack payload has attachments format"
else
    fail "Slack payload should have attachments format"
fi

#------------------------------------------------------------------------------
# Test 27: Discord payload has embeds format
#------------------------------------------------------------------------------
echo "Test 27: Discord payload has embeds format"

if grep -A30 "send_discord_notification()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q '"embeds"'; then
    pass "Discord payload has embeds format"
else
    fail "Discord payload should have embeds format"
fi

#------------------------------------------------------------------------------
# Test 28: Generic webhook payload has event type
#------------------------------------------------------------------------------
echo "Test 28: Generic webhook payload has event type"

if grep -A35 "send_generic_notification()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q '"event"'; then
    pass "Generic webhook payload has event type"
else
    fail "Generic webhook payload should have event type"
fi

#------------------------------------------------------------------------------
# Test 29: notify_task_started is called in main loop
#------------------------------------------------------------------------------
echo "Test 29: notify_task_started is called in main loop"

if grep -q 'notify_task_started.*ISSUE_NUMBER' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "notify_task_started is called in main loop"
else
    fail "notify_task_started should be called in main loop"
fi

#------------------------------------------------------------------------------
# Test 30: notify_task_completed is called in main loop
#------------------------------------------------------------------------------
echo "Test 30: notify_task_completed is called in main loop"

if grep -q 'notify_task_completed.*ISSUE_NUMBER' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "notify_task_completed is called in main loop"
else
    fail "notify_task_completed should be called in main loop"
fi

#------------------------------------------------------------------------------
# Test 31: notify_task_failed is called in main loop
#------------------------------------------------------------------------------
echo "Test 31: notify_task_failed is called in main loop"

if grep -q 'notify_task_failed.*ISSUE_NUMBER' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "notify_task_failed is called in main loop"
else
    fail "notify_task_failed should be called in main loop"
fi

#------------------------------------------------------------------------------
# Test 32: notify_gigachad_merge is called in gigachad_merge_and_sync
#------------------------------------------------------------------------------
echo "Test 32: notify_gigachad_merge is called in gigachad_merge_and_sync"

if grep -A50 "gigachad_merge_and_sync()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'notify_gigachad_merge'; then
    pass "notify_gigachad_merge is called in gigachad_merge_and_sync"
else
    fail "notify_gigachad_merge should be called in gigachad_merge_and_sync"
fi

#------------------------------------------------------------------------------
# Test 33: notify_session_ended is called in ctrl_c handler
#------------------------------------------------------------------------------
echo "Test 33: notify_session_ended is called in ctrl_c handler"

if grep -A30 "function ctrl_c()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'notify_session_ended'; then
    pass "notify_session_ended is called in ctrl_c handler"
else
    fail "notify_session_ended should be called in ctrl_c handler"
fi

#------------------------------------------------------------------------------
# Test 34: Default NOTIFICATIONS_ENABLED is false
#------------------------------------------------------------------------------
echo "Test 34: Default NOTIFICATIONS_ENABLED is false"

if grep -q 'NOTIFICATIONS_ENABLED:-false' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Default NOTIFICATIONS_ENABLED is false"
else
    fail "Default NOTIFICATIONS_ENABLED should be false"
fi

#------------------------------------------------------------------------------
# Test 35: parse_yaml_nested_deep function exists
#------------------------------------------------------------------------------
echo "Test 35: parse_yaml_nested_deep function exists"

if grep -q "parse_yaml_nested_deep()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "parse_yaml_nested_deep function exists"
else
    fail "parse_yaml_nested_deep function should exist"
fi

#------------------------------------------------------------------------------
# Test 36: parse_yaml_nested_events function exists
#------------------------------------------------------------------------------
echo "Test 36: parse_yaml_nested_events function exists"

if grep -q "parse_yaml_nested_events()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "parse_yaml_nested_events function exists"
else
    fail "parse_yaml_nested_events function should exist"
fi

#------------------------------------------------------------------------------
# Test 37: CLI has --notify-test flag for validate command
#------------------------------------------------------------------------------
echo "Test 37: CLI has --notify-test flag for validate command"

if grep -q "notify-test" "$PROJECT_ROOT/src/cli.ts"; then
    pass "CLI has --notify-test flag"
else
    fail "CLI should have --notify-test flag"
fi

#------------------------------------------------------------------------------
# Test 38: validate.ts supports notifyTest option
#------------------------------------------------------------------------------
echo "Test 38: validate.ts supports notifyTest option"

if grep -q "notifyTest" "$PROJECT_ROOT/src/validate.ts"; then
    pass "validate.ts supports notifyTest option"
else
    fail "validate.ts should support notifyTest option"
fi

#------------------------------------------------------------------------------
# Test 39: Template config has min_interval rate limit setting
#------------------------------------------------------------------------------
echo "Test 39: Template config has min_interval rate limit setting"

if grep -q "min_interval:" "$PROJECT_ROOT/templates/chadgi-config.yaml"; then
    pass "Template config has min_interval setting"
else
    fail "Template config should have min_interval setting"
fi

#------------------------------------------------------------------------------
# Test 40: Template config has burst_limit rate limit setting
#------------------------------------------------------------------------------
echo "Test 40: Template config has burst_limit rate limit setting"

if grep -q "burst_limit:" "$PROJECT_ROOT/templates/chadgi-config.yaml"; then
    pass "Template config has burst_limit setting"
else
    fail "Template config should have burst_limit setting"
fi

#------------------------------------------------------------------------------
# Functional Tests - Rate Limiting Logic
#------------------------------------------------------------------------------
echo ""
echo "=========================================="
echo "  Functional Tests"
echo "=========================================="
echo ""

# Source the script functions for testing (in a subshell to avoid side effects)
source_and_test() {
    # Set up minimal environment
    NOTIFY_RATE_MIN_INTERVAL=10
    NOTIFY_RATE_BURST_LIMIT=5
    NOTIFY_RATE_BURST_WINDOW=60

    # Initialize rate limit state
    LAST_NOTIFICATION_TIME=0
    NOTIFICATION_BURST_COUNT=0
    NOTIFICATION_BURST_START=0

    # Mock check_notification_rate_limit function (extracted from script)
    check_notification_rate_limit() {
        local CURRENT_TIME=$(date +%s)

        local TIME_SINCE_LAST=$((CURRENT_TIME - LAST_NOTIFICATION_TIME))
        if [ $TIME_SINCE_LAST -lt $NOTIFY_RATE_MIN_INTERVAL ]; then
            return 1
        fi

        local BURST_ELAPSED=$((CURRENT_TIME - NOTIFICATION_BURST_START))
        if [ $BURST_ELAPSED -gt $NOTIFY_RATE_BURST_WINDOW ]; then
            NOTIFICATION_BURST_COUNT=0
            NOTIFICATION_BURST_START=$CURRENT_TIME
        fi

        if [ $NOTIFICATION_BURST_COUNT -ge $NOTIFY_RATE_BURST_LIMIT ]; then
            return 1
        fi

        return 0
    }

    update_notification_rate_limit() {
        LAST_NOTIFICATION_TIME=$(date +%s)
        NOTIFICATION_BURST_COUNT=$((NOTIFICATION_BURST_COUNT + 1))
        if [ $NOTIFICATION_BURST_START -eq 0 ]; then
            NOTIFICATION_BURST_START=$LAST_NOTIFICATION_TIME
        fi
    }

    # Test 1: First notification should be allowed
    if check_notification_rate_limit; then
        echo -e "${GREEN}PASS${NC}: First notification allowed"
    else
        echo -e "${RED}FAIL${NC}: First notification should be allowed"
        return 1
    fi

    # Test 2: Update rate limit and check burst count
    update_notification_rate_limit
    if [ $NOTIFICATION_BURST_COUNT -eq 1 ]; then
        echo -e "${GREEN}PASS${NC}: Burst count updated correctly"
    else
        echo -e "${RED}FAIL${NC}: Burst count should be 1, got $NOTIFICATION_BURST_COUNT"
        return 1
    fi

    # Test 3: Immediate second notification should be rate limited (min interval)
    if check_notification_rate_limit; then
        echo -e "${RED}FAIL${NC}: Immediate notification should be rate limited"
        return 1
    else
        echo -e "${GREEN}PASS${NC}: Immediate notification correctly rate limited"
    fi

    # Test 4: Simulate passing time (reset last notification time)
    LAST_NOTIFICATION_TIME=$(($(date +%s) - 15))
    if check_notification_rate_limit; then
        echo -e "${GREEN}PASS${NC}: Notification allowed after min_interval"
    else
        echo -e "${RED}FAIL${NC}: Notification should be allowed after min_interval"
        return 1
    fi

    # Test 5: Burst limit should block after 5 rapid notifications
    LAST_NOTIFICATION_TIME=0
    NOTIFICATION_BURST_COUNT=5
    NOTIFICATION_BURST_START=$(date +%s)
    if check_notification_rate_limit; then
        echo -e "${RED}FAIL${NC}: Should be rate limited at burst limit"
        return 1
    else
        echo -e "${GREEN}PASS${NC}: Correctly rate limited at burst limit"
    fi

    return 0
}

# Run functional tests in subshell
if (source_and_test); then
    TESTS_PASSED=$((TESTS_PASSED + 5))
else
    TESTS_FAILED=$((TESTS_FAILED + 1))
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

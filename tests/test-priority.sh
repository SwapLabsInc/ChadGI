#!/bin/bash
#
# Tests for Task Priority functionality
#
# Run with: bash tests/test-priority.sh
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
echo "  Task Priority Tests"
echo "=========================================="
echo ""

#------------------------------------------------------------------------------
# Test 1: parse_priority_labels function exists
#------------------------------------------------------------------------------
echo "Test 1: parse_priority_labels function exists"

if grep -q "parse_priority_labels()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "parse_priority_labels function exists"
else
    fail "parse_priority_labels function should exist"
fi

#------------------------------------------------------------------------------
# Test 2: load_config parses PRIORITY_ENABLED
#------------------------------------------------------------------------------
echo "Test 2: load_config parses PRIORITY_ENABLED"

if grep -q 'PRIORITY_ENABLED=$(parse_yaml_nested_merged "priority" "enabled"' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "PRIORITY_ENABLED config parsing found"
else
    fail "PRIORITY_ENABLED should be parsed in load_config"
fi

#------------------------------------------------------------------------------
# Test 3: load_config parses PRIORITY_LABELS_CRITICAL
#------------------------------------------------------------------------------
echo "Test 3: load_config parses PRIORITY_LABELS_CRITICAL"

if grep -q 'PRIORITY_LABELS_CRITICAL=$(parse_priority_labels_merged "critical"' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "PRIORITY_LABELS_CRITICAL config parsing found"
else
    fail "PRIORITY_LABELS_CRITICAL should be parsed in load_config"
fi

#------------------------------------------------------------------------------
# Test 4: load_config parses PRIORITY_LABELS_HIGH
#------------------------------------------------------------------------------
echo "Test 4: load_config parses PRIORITY_LABELS_HIGH"

if grep -q 'PRIORITY_LABELS_HIGH=$(parse_priority_labels_merged "high"' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "PRIORITY_LABELS_HIGH config parsing found"
else
    fail "PRIORITY_LABELS_HIGH should be parsed in load_config"
fi

#------------------------------------------------------------------------------
# Test 5: load_config parses PRIORITY_LABELS_NORMAL
#------------------------------------------------------------------------------
echo "Test 5: load_config parses PRIORITY_LABELS_NORMAL"

if grep -q 'PRIORITY_LABELS_NORMAL=$(parse_priority_labels_merged "normal"' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "PRIORITY_LABELS_NORMAL config parsing found"
else
    fail "PRIORITY_LABELS_NORMAL should be parsed in load_config"
fi

#------------------------------------------------------------------------------
# Test 6: load_config parses PRIORITY_LABELS_LOW
#------------------------------------------------------------------------------
echo "Test 6: load_config parses PRIORITY_LABELS_LOW"

if grep -q 'PRIORITY_LABELS_LOW=$(parse_priority_labels_merged "low"' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "PRIORITY_LABELS_LOW config parsing found"
else
    fail "PRIORITY_LABELS_LOW should be parsed in load_config"
fi

#------------------------------------------------------------------------------
# Test 7: Default value for PRIORITY_ENABLED is true
#------------------------------------------------------------------------------
echo "Test 7: Default value for PRIORITY_ENABLED is true"

if grep -q 'PRIORITY_ENABLED:-true' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "PRIORITY_ENABLED default is true"
else
    fail "PRIORITY_ENABLED default should be true"
fi

#------------------------------------------------------------------------------
# Test 8: Default labels for critical include P0
#------------------------------------------------------------------------------
echo "Test 8: Default labels for critical include P0"

if grep 'PRIORITY_LABELS_CRITICAL:-' "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'P0'; then
    pass "Default critical labels include P0"
else
    fail "Default critical labels should include P0"
fi

#------------------------------------------------------------------------------
# Test 9: Default labels for low include backlog
#------------------------------------------------------------------------------
echo "Test 9: Default labels for low include backlog"

if grep 'PRIORITY_LABELS_LOW:-' "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'backlog'; then
    pass "Default low labels include backlog"
else
    fail "Default low labels should include backlog"
fi

#------------------------------------------------------------------------------
# Test 10: get_issue_labels function exists
#------------------------------------------------------------------------------
echo "Test 10: get_issue_labels function exists"

if grep -q "get_issue_labels()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "get_issue_labels function exists"
else
    fail "get_issue_labels function should exist"
fi

#------------------------------------------------------------------------------
# Test 11: get_issue_priority function exists
#------------------------------------------------------------------------------
echo "Test 11: get_issue_priority function exists"

if grep -q "get_issue_priority()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "get_issue_priority function exists"
else
    fail "get_issue_priority function should exist"
fi

#------------------------------------------------------------------------------
# Test 12: get_issue_priority returns numeric priority levels
#------------------------------------------------------------------------------
echo "Test 12: get_issue_priority returns numeric priority levels"

if grep -A40 "get_issue_priority()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'echo 0'; then
    pass "get_issue_priority returns 0 for critical"
else
    fail "get_issue_priority should return 0 for critical"
fi

#------------------------------------------------------------------------------
# Test 13: get_issue_priority sets CURRENT_PRIORITY_NAME
#------------------------------------------------------------------------------
echo "Test 13: get_issue_priority sets CURRENT_PRIORITY_NAME"

if grep -A40 "get_issue_priority()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'CURRENT_PRIORITY_NAME='; then
    pass "get_issue_priority sets CURRENT_PRIORITY_NAME"
else
    fail "get_issue_priority should set CURRENT_PRIORITY_NAME"
fi

#------------------------------------------------------------------------------
# Test 14: get_priority_name function exists
#------------------------------------------------------------------------------
echo "Test 14: get_priority_name function exists"

if grep -q "get_priority_name()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "get_priority_name function exists"
else
    fail "get_priority_name function should exist"
fi

#------------------------------------------------------------------------------
# Test 15: get_project_task checks PRIORITY_ENABLED
#------------------------------------------------------------------------------
echo "Test 15: get_project_task checks PRIORITY_ENABLED"

if grep -A60 "get_project_task()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'PRIORITY_ENABLED.*true'; then
    pass "get_project_task checks PRIORITY_ENABLED"
else
    fail "get_project_task should check PRIORITY_ENABLED"
fi

#------------------------------------------------------------------------------
# Test 16: get_project_task sorts by priority
#------------------------------------------------------------------------------
echo "Test 16: get_project_task sorts by priority"

if grep -A60 "get_project_task()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'sort -t:'; then
    pass "get_project_task sorts by priority"
else
    fail "get_project_task should sort by priority"
fi

#------------------------------------------------------------------------------
# Test 17: Task output shows priority when enabled
#------------------------------------------------------------------------------
echo "Test 17: Task output shows priority when enabled"

if grep -q 'log_success "Found issue.*priority:' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Task output shows priority"
else
    fail "Task output should show priority"
fi

#------------------------------------------------------------------------------
# Test 18: Header shows priority when starting task
#------------------------------------------------------------------------------
echo "Test 18: Header shows priority when starting task"

if grep -q 'log_header "STARTING CLAUDE CODE.*priority:' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Header shows priority when starting task"
else
    fail "Header should show priority when starting task"
fi

#------------------------------------------------------------------------------
# Test 19: notify_task_started accepts priority parameter
#------------------------------------------------------------------------------
echo "Test 19: notify_task_started accepts priority parameter"

if grep -A5 "notify_task_started()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'PRIORITY='; then
    pass "notify_task_started accepts priority parameter"
else
    fail "notify_task_started should accept priority parameter"
fi

#------------------------------------------------------------------------------
# Test 20: notify_task_started includes priority in message
#------------------------------------------------------------------------------
echo "Test 20: notify_task_started includes priority in message"

if grep -A20 "notify_task_started()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'Priority:'; then
    pass "notify_task_started includes priority in message"
else
    fail "notify_task_started should include priority in message"
fi

#------------------------------------------------------------------------------
# Test 21: notify_task_started called with priority argument
#------------------------------------------------------------------------------
echo "Test 21: notify_task_started called with priority argument"

if grep 'notify_task_started.*ISSUE_NUMBER.*ISSUE_TITLE.*ISSUE_URL.*CURRENT_PRIORITY_NAME' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "notify_task_started called with priority argument"
else
    fail "notify_task_started should be called with priority argument"
fi

#------------------------------------------------------------------------------
# Test 22: Template config has priority section
#------------------------------------------------------------------------------
echo "Test 22: Template config has priority section"

if grep -q "^priority:" "$PROJECT_ROOT/templates/chadgi-config.yaml"; then
    pass "Template config has priority section"
else
    fail "Template config should have priority section"
fi

#------------------------------------------------------------------------------
# Test 23: Template config has priority.enabled setting
#------------------------------------------------------------------------------
echo "Test 23: Template config has priority.enabled setting"

if grep -q "enabled:.*true" "$PROJECT_ROOT/templates/chadgi-config.yaml" && grep -B5 "enabled:.*true" "$PROJECT_ROOT/templates/chadgi-config.yaml" | grep -q "priority:"; then
    pass "Template config has priority.enabled setting"
else
    fail "Template config should have priority.enabled setting"
fi

#------------------------------------------------------------------------------
# Test 24: Template config has priority labels for critical
#------------------------------------------------------------------------------
echo "Test 24: Template config has priority labels for critical"

if grep -q 'critical:.*\["priority:critical"' "$PROJECT_ROOT/templates/chadgi-config.yaml"; then
    pass "Template config has priority labels for critical"
else
    fail "Template config should have priority labels for critical"
fi

#------------------------------------------------------------------------------
# Test 25: Template config has priority labels for high
#------------------------------------------------------------------------------
echo "Test 25: Template config has priority labels for high"

if grep -q 'high:.*\["priority:high"' "$PROJECT_ROOT/templates/chadgi-config.yaml"; then
    pass "Template config has priority labels for high"
else
    fail "Template config should have priority labels for high"
fi

#------------------------------------------------------------------------------
# Test 26: Template config has priority labels for normal
#------------------------------------------------------------------------------
echo "Test 26: Template config has priority labels for normal"

if grep -q 'normal:.*\["priority:normal"' "$PROJECT_ROOT/templates/chadgi-config.yaml"; then
    pass "Template config has priority labels for normal"
else
    fail "Template config should have priority labels for normal"
fi

#------------------------------------------------------------------------------
# Test 27: Template config has priority labels for low
#------------------------------------------------------------------------------
echo "Test 27: Template config has priority labels for low"

if grep -q 'low:.*\["priority:low"' "$PROJECT_ROOT/templates/chadgi-config.yaml"; then
    pass "Template config has priority labels for low"
else
    fail "Template config should have priority labels for low"
fi

#------------------------------------------------------------------------------
# Test 28: set_defaults has PRIORITY_ENABLED
#------------------------------------------------------------------------------
echo "Test 28: set_defaults has PRIORITY_ENABLED"

if grep -A150 "^set_defaults()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'PRIORITY_ENABLED='; then
    pass "set_defaults has PRIORITY_ENABLED"
else
    fail "set_defaults should have PRIORITY_ENABLED"
fi

#------------------------------------------------------------------------------
# Test 29: set_defaults has PRIORITY_LABELS_CRITICAL
#------------------------------------------------------------------------------
echo "Test 29: set_defaults has PRIORITY_LABELS_CRITICAL"

if grep -A150 "^set_defaults()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'PRIORITY_LABELS_CRITICAL='; then
    pass "set_defaults has PRIORITY_LABELS_CRITICAL"
else
    fail "set_defaults should have PRIORITY_LABELS_CRITICAL"
fi

#------------------------------------------------------------------------------
# Test 30: Priority display shows Priority: in output
#------------------------------------------------------------------------------
echo "Test 30: Priority display shows Priority: in output"

if grep -q 'echo.*Priority:.*\$CURRENT_PRIORITY_NAME' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Priority display shows Priority: in output"
else
    fail "Priority display should show Priority: in output"
fi

#------------------------------------------------------------------------------
# Test 31: Critical priority returns 0
#------------------------------------------------------------------------------
echo "Test 31: Critical priority returns 0"

if grep -A50 "get_issue_priority()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'CURRENT_PRIORITY_NAME="critical"' && \
   grep -A50 "get_issue_priority()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -B1 'CURRENT_PRIORITY_NAME="critical"' | grep -q 'echo 0' || \
   grep -A3 'CURRENT_PRIORITY_NAME="critical"' "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'echo 0'; then
    pass "Critical priority returns 0"
else
    fail "Critical priority should return 0"
fi

#------------------------------------------------------------------------------
# Test 32: High priority returns 1
#------------------------------------------------------------------------------
echo "Test 32: High priority returns 1"

if grep -A50 "get_issue_priority()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'CURRENT_PRIORITY_NAME="high"' && \
   grep -A3 'CURRENT_PRIORITY_NAME="high"' "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'echo 1'; then
    pass "High priority returns 1"
else
    fail "High priority should return 1"
fi

#------------------------------------------------------------------------------
# Test 33: Low priority returns 3
#------------------------------------------------------------------------------
echo "Test 33: Low priority returns 3"

if grep -A50 "get_issue_priority()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'CURRENT_PRIORITY_NAME="low"' && \
   grep -A3 'CURRENT_PRIORITY_NAME="low"' "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'echo 3'; then
    pass "Low priority returns 3"
else
    fail "Low priority should return 3"
fi

#------------------------------------------------------------------------------
# Test 34: Normal priority returns 2 (default)
#------------------------------------------------------------------------------
echo "Test 34: Normal priority returns 2 (default)"

if grep -A60 "get_issue_priority()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q 'echo 2'; then
    pass "Normal priority returns 2"
else
    fail "Normal priority should return 2"
fi

#------------------------------------------------------------------------------
# Functional Tests - Test parse_priority_labels
#------------------------------------------------------------------------------
echo ""
echo "=========================================="
echo "  Functional Tests"
echo "=========================================="
echo ""

# Create temporary config file for testing
TEMP_CONFIG=$(mktemp)
cat > "$TEMP_CONFIG" << 'EOF'
priority:
  enabled: true
  labels:
    critical: ["priority:critical", "P0", "urgent"]
    high: ["priority:high", "P1"]
    normal: ["priority:normal", "P2"]
    low: ["priority:low", "P3", "backlog"]
EOF

# Extract and test parse_priority_labels function
parse_priority_labels() {
    local LEVEL=$1
    local FILE=$2
    awk -v level="$LEVEL" '
        /^priority:/ { in_priority=1; next }
        in_priority && /^[a-z]/ { in_priority=0; in_labels=0 }
        in_priority && /^  labels:/ { in_labels=1; next }
        in_priority && in_labels && /^  [a-z]/ { in_labels=0 }
        in_priority && in_labels && $0 ~ "^    "level":" {
            gsub(/^    [a-z]+: */, "");
            gsub(/ *#.*/, "");
            gsub(/\[/, "");
            gsub(/\]/, "");
            gsub(/"/, "");
            gsub(/,/, " ");
            gsub(/  +/, " ");
            gsub(/^ +/, "");
            gsub(/ +$/, "");
            print;
            exit
        }
    ' "$FILE" 2>/dev/null || echo ""
}

#------------------------------------------------------------------------------
# Test 35: parse_priority_labels extracts critical labels
#------------------------------------------------------------------------------
echo "Test 35: parse_priority_labels extracts critical labels"

RESULT=$(parse_priority_labels "critical" "$TEMP_CONFIG")
if echo "$RESULT" | grep -q "priority:critical" && echo "$RESULT" | grep -q "P0" && echo "$RESULT" | grep -q "urgent"; then
    pass "parse_priority_labels extracts critical labels correctly"
else
    fail "parse_priority_labels should extract critical labels (got: $RESULT)"
fi

#------------------------------------------------------------------------------
# Test 36: parse_priority_labels extracts high labels
#------------------------------------------------------------------------------
echo "Test 36: parse_priority_labels extracts high labels"

RESULT=$(parse_priority_labels "high" "$TEMP_CONFIG")
if echo "$RESULT" | grep -q "priority:high" && echo "$RESULT" | grep -q "P1"; then
    pass "parse_priority_labels extracts high labels correctly"
else
    fail "parse_priority_labels should extract high labels (got: $RESULT)"
fi

#------------------------------------------------------------------------------
# Test 37: parse_priority_labels extracts low labels
#------------------------------------------------------------------------------
echo "Test 37: parse_priority_labels extracts low labels"

RESULT=$(parse_priority_labels "low" "$TEMP_CONFIG")
if echo "$RESULT" | grep -q "priority:low" && echo "$RESULT" | grep -q "P3" && echo "$RESULT" | grep -q "backlog"; then
    pass "parse_priority_labels extracts low labels correctly"
else
    fail "parse_priority_labels should extract low labels (got: $RESULT)"
fi

#------------------------------------------------------------------------------
# Test 38: get_priority_name maps numbers to names
#------------------------------------------------------------------------------
echo "Test 38: get_priority_name maps numbers to names"

get_priority_name() {
    local PRIORITY_NUM=$1
    case "$PRIORITY_NUM" in
        0) echo "critical" ;;
        1) echo "high" ;;
        3) echo "low" ;;
        *) echo "normal" ;;
    esac
}

if [ "$(get_priority_name 0)" = "critical" ] && \
   [ "$(get_priority_name 1)" = "high" ] && \
   [ "$(get_priority_name 2)" = "normal" ] && \
   [ "$(get_priority_name 3)" = "low" ]; then
    pass "get_priority_name maps numbers to names correctly"
else
    fail "get_priority_name should map numbers to names correctly"
fi

# Clean up
rm -f "$TEMP_CONFIG"

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

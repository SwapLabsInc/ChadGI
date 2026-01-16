#!/bin/bash
#
# Tests for GigaChad mode functionality
#
# Run with: bash tests/test-gigachad-mode.sh
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
echo "  GigaChad Mode Tests"
echo "=========================================="
echo ""

# Define parse_yaml_nested function (copy from main script for testing)
parse_yaml_nested() {
    local PARENT=$1
    local KEY=$2
    local FILE=$3
    awk -v parent="$PARENT" -v key="$KEY" '
        $0 ~ "^"parent":" { in_parent=1; next }
        in_parent && /^[a-z]/ { in_parent=0 }
        in_parent && $0 ~ "^  "key":" {
            gsub(/^  [a-z_]+: */, "");
            gsub(/ *#.*/, "");
            gsub(/"/, "");
            print;
            exit
        }
    ' "$FILE" 2>/dev/null || echo ""
}

#------------------------------------------------------------------------------
# Test 1: Config parsing - gigachad_mode defaults to false
#------------------------------------------------------------------------------
echo "Test 1: gigachad_mode defaults to false"

# Create temp config without gigachad_mode
TEMP_CONFIG=$(mktemp)
cat > "$TEMP_CONFIG" << 'EOF'
task_source: github-issues
github:
  repo: test/repo
  project_number: 1
iteration:
  max_iterations: 5
EOF

RESULT=$(parse_yaml_nested "iteration" "gigachad_mode" "$TEMP_CONFIG")
if [ -z "$RESULT" ] || [ "$RESULT" = "" ]; then
    pass "gigachad_mode not set defaults correctly"
else
    fail "gigachad_mode should be empty when not set, got: $RESULT"
fi

rm -f "$TEMP_CONFIG"

#------------------------------------------------------------------------------
# Test 2: Config parsing - gigachad_mode can be set to true
#------------------------------------------------------------------------------
echo "Test 2: gigachad_mode can be set to true"

TEMP_CONFIG=$(mktemp)
cat > "$TEMP_CONFIG" << 'EOF'
task_source: github-issues
github:
  repo: test/repo
  project_number: 1
iteration:
  max_iterations: 5
  gigachad_mode: true
EOF

RESULT=$(parse_yaml_nested "iteration" "gigachad_mode" "$TEMP_CONFIG")
if [ "$RESULT" = "true" ]; then
    pass "gigachad_mode=true parsed correctly"
else
    fail "gigachad_mode should be 'true', got: $RESULT"
fi

rm -f "$TEMP_CONFIG"

#------------------------------------------------------------------------------
# Test 3: Config parsing - done_column defaults correctly
#------------------------------------------------------------------------------
echo "Test 3: done_column defaults to 'Done'"

TEMP_CONFIG=$(mktemp)
cat > "$TEMP_CONFIG" << 'EOF'
github:
  repo: test/repo
  project_number: 1
  ready_column: Ready
  in_progress_column: In progress
  review_column: In review
EOF

RESULT=$(parse_yaml_nested "github" "done_column" "$TEMP_CONFIG")
if [ -z "$RESULT" ] || [ "$RESULT" = "" ]; then
    pass "done_column not set (will use default 'Done')"
else
    fail "done_column should be empty when not set, got: $RESULT"
fi

rm -f "$TEMP_CONFIG"

#------------------------------------------------------------------------------
# Test 4: Config parsing - done_column can be customized
#------------------------------------------------------------------------------
echo "Test 4: done_column can be customized"

TEMP_CONFIG=$(mktemp)
cat > "$TEMP_CONFIG" << 'EOF'
github:
  repo: test/repo
  project_number: 1
  done_column: Shipped
EOF

RESULT=$(parse_yaml_nested "github" "done_column" "$TEMP_CONFIG")
if [ "$RESULT" = "Shipped" ]; then
    pass "done_column='Shipped' parsed correctly"
else
    fail "done_column should be 'Shipped', got: $RESULT"
fi

rm -f "$TEMP_CONFIG"

#------------------------------------------------------------------------------
# Test 5: Template contains gigachad_mode setting
#------------------------------------------------------------------------------
echo "Test 5: Config template includes gigachad_mode"

if grep -q "gigachad_mode" "$PROJECT_ROOT/templates/chadgi-config.yaml"; then
    pass "gigachad_mode found in config template"
else
    fail "gigachad_mode should be in config template"
fi

#------------------------------------------------------------------------------
# Test 6: Template contains done_column setting
#------------------------------------------------------------------------------
echo "Test 6: Config template includes done_column"

if grep -q "done_column" "$PROJECT_ROOT/templates/chadgi-config.yaml"; then
    pass "done_column found in config template"
else
    fail "done_column should be in config template"
fi

#------------------------------------------------------------------------------
# Test 7: Main script contains gigachad_merge_and_sync function
#------------------------------------------------------------------------------
echo "Test 7: Main script has gigachad_merge_and_sync function"

if grep -q "gigachad_merge_and_sync()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "gigachad_merge_and_sync function exists"
else
    fail "gigachad_merge_and_sync function should exist"
fi

#------------------------------------------------------------------------------
# Test 8: Main script handles DONE_COLUMN in move_to_column
#------------------------------------------------------------------------------
echo "Test 8: move_to_column handles DONE_COLUMN"

if grep -q 'TARGET_COLUMN" = "\$DONE_COLUMN"' "$PROJECT_ROOT/scripts/chadgi.sh" || \
   grep -q 'DONE_OPTION_ID' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "DONE_COLUMN handling exists in move_to_column"
else
    fail "move_to_column should handle DONE_COLUMN"
fi

#------------------------------------------------------------------------------
# Test 9: Verify GigaChad mode shows in startup info
#------------------------------------------------------------------------------
echo "Test 9: GigaChad mode shown in startup info"

if grep -q "GIGACHAD MODE ENABLED" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "GigaChad mode startup message exists"
else
    fail "GigaChad mode startup message should exist"
fi

#------------------------------------------------------------------------------
# Test 10: Verify auto-merge logic includes squash fallback
#------------------------------------------------------------------------------
echo "Test 10: Auto-merge has fallback to regular merge"

if grep -q "gh pr merge.*--squash" "$PROJECT_ROOT/scripts/chadgi.sh" && \
   grep -q "gh pr merge.*--merge" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Auto-merge includes squash and regular merge fallback"
else
    fail "Auto-merge should try squash first, then regular merge"
fi

#------------------------------------------------------------------------------
# Test 11: Config parsing - gigachad_commit_prefix defaults correctly
#------------------------------------------------------------------------------
echo "Test 11: gigachad_commit_prefix defaults to '[GIGACHAD]'"

TEMP_CONFIG=$(mktemp)
cat > "$TEMP_CONFIG" << 'EOF'
iteration:
  gigachad_mode: true
EOF

RESULT=$(parse_yaml_nested "iteration" "gigachad_commit_prefix" "$TEMP_CONFIG")
if [ -z "$RESULT" ] || [ "$RESULT" = "" ]; then
    pass "gigachad_commit_prefix not set (will use default '[GIGACHAD]')"
else
    fail "gigachad_commit_prefix should be empty when not set, got: $RESULT"
fi

rm -f "$TEMP_CONFIG"

#------------------------------------------------------------------------------
# Test 12: Config parsing - gigachad_commit_prefix can be customized
#------------------------------------------------------------------------------
echo "Test 12: gigachad_commit_prefix can be customized"

TEMP_CONFIG=$(mktemp)
cat > "$TEMP_CONFIG" << 'EOF'
iteration:
  gigachad_mode: true
  gigachad_commit_prefix: "[AUTO]"
EOF

RESULT=$(parse_yaml_nested "iteration" "gigachad_commit_prefix" "$TEMP_CONFIG")
if [ "$RESULT" = "[AUTO]" ]; then
    pass "gigachad_commit_prefix='[AUTO]' parsed correctly"
else
    fail "gigachad_commit_prefix should be '[AUTO]', got: $RESULT"
fi

rm -f "$TEMP_CONFIG"

#------------------------------------------------------------------------------
# Test 13: Main script uses --subject flag for prefixed commits
#------------------------------------------------------------------------------
echo "Test 13: Squash merge uses --subject flag for commit prefix"

if grep -q 'gh pr merge.*--subject' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Squash merge uses --subject flag for commit prefix"
else
    fail "Squash merge should use --subject flag for commit prefix"
fi

#------------------------------------------------------------------------------
# Test 14: Config template includes gigachad_commit_prefix
#------------------------------------------------------------------------------
echo "Test 14: Config template includes gigachad_commit_prefix"

if grep -q "gigachad_commit_prefix" "$PROJECT_ROOT/templates/chadgi-config.yaml"; then
    pass "gigachad_commit_prefix found in config template"
else
    fail "gigachad_commit_prefix should be in config template"
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

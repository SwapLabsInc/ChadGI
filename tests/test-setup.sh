#!/bin/bash
#
# Tests for Setup Command functionality
#
# Run with: bash tests/test-setup.sh
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
echo "  Setup Command Tests"
echo "=========================================="
echo ""

#------------------------------------------------------------------------------
# Test 1: setup.ts file exists
#------------------------------------------------------------------------------
echo "Test 1: setup.ts file exists"

if [ -f "$PROJECT_ROOT/src/setup.ts" ]; then
    pass "setup.ts file exists"
else
    fail "setup.ts should exist"
fi

#------------------------------------------------------------------------------
# Test 2: CLI has setup command
#------------------------------------------------------------------------------
echo "Test 2: CLI has setup command"

if grep -q "command('setup')" "$PROJECT_ROOT/src/cli.ts"; then
    pass "setup command exists in CLI"
else
    fail "setup command should exist in CLI"
fi

#------------------------------------------------------------------------------
# Test 3: CLI imports setup module
#------------------------------------------------------------------------------
echo "Test 3: CLI imports setup module"

if grep -q "import { setup }" "$PROJECT_ROOT/src/cli.ts"; then
    pass "setup module imported in CLI"
else
    fail "setup module should be imported in CLI"
fi

#------------------------------------------------------------------------------
# Test 4: Setup command has --config option
#------------------------------------------------------------------------------
echo "Test 4: Setup command has --config option"

if grep -A10 "command('setup')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-config"; then
    pass "--config option exists for setup command"
else
    fail "setup command should have --config option"
fi

#------------------------------------------------------------------------------
# Test 5: Setup command has --non-interactive option
#------------------------------------------------------------------------------
echo "Test 5: Setup command has --non-interactive option"

if grep -A10 "command('setup')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-non-interactive"; then
    pass "--non-interactive option exists for setup command"
else
    fail "setup command should have --non-interactive option"
fi

#------------------------------------------------------------------------------
# Test 6: Setup command has --reconfigure option
#------------------------------------------------------------------------------
echo "Test 6: Setup command has --reconfigure option"

if grep -A10 "command('setup')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-reconfigure"; then
    pass "--reconfigure option exists for setup command"
else
    fail "setup command should have --reconfigure option"
fi

#------------------------------------------------------------------------------
# Test 7: setup.ts has SetupOptions interface
#------------------------------------------------------------------------------
echo "Test 7: setup.ts has SetupOptions interface"

if grep -q "interface SetupOptions" "$PROJECT_ROOT/src/setup.ts"; then
    pass "SetupOptions interface exists"
else
    fail "SetupOptions interface should exist"
fi

#------------------------------------------------------------------------------
# Test 8: setup.ts exports setup function
#------------------------------------------------------------------------------
echo "Test 8: setup.ts exports setup function"

if grep -q "export async function setup" "$PROJECT_ROOT/src/setup.ts"; then
    pass "setup function is exported"
else
    fail "setup function should be exported"
fi

#------------------------------------------------------------------------------
# Test 9: setup.ts has git remote detection
#------------------------------------------------------------------------------
echo "Test 9: setup.ts has git remote detection"

if grep -q "detectRepository\|git remote" "$PROJECT_ROOT/src/setup.ts"; then
    pass "setup.ts has git remote detection"
else
    fail "setup.ts should have git remote detection"
fi

#------------------------------------------------------------------------------
# Test 10: setup.ts has GitHub Project listing
#------------------------------------------------------------------------------
echo "Test 10: setup.ts has GitHub Project listing"

if grep -q "listGitHubProjects\|gh project list" "$PROJECT_ROOT/src/setup.ts"; then
    pass "setup.ts has GitHub Project listing"
else
    fail "setup.ts should have GitHub Project listing"
fi

#------------------------------------------------------------------------------
# Test 11: setup.ts validates project board columns
#------------------------------------------------------------------------------
echo "Test 11: setup.ts validates project board columns"

if grep -q "validateProjectColumns\|gh project field-list" "$PROJECT_ROOT/src/setup.ts"; then
    pass "setup.ts validates project board columns"
else
    fail "setup.ts should validate project board columns"
fi

#------------------------------------------------------------------------------
# Test 12: setup.ts has base branch configuration
#------------------------------------------------------------------------------
echo "Test 12: setup.ts has base branch configuration"

if grep -q "baseBranch\|base.*branch" "$PROJECT_ROOT/src/setup.ts"; then
    pass "setup.ts has base branch configuration"
else
    fail "setup.ts should have base branch configuration"
fi

#------------------------------------------------------------------------------
# Test 13: setup.ts has GigaChad mode configuration
#------------------------------------------------------------------------------
echo "Test 13: setup.ts has GigaChad mode configuration"

if grep -q "gigachadMode\|gigachad" "$PROJECT_ROOT/src/setup.ts"; then
    pass "setup.ts has GigaChad mode configuration"
else
    fail "setup.ts should have GigaChad mode configuration"
fi

#------------------------------------------------------------------------------
# Test 14: setup.ts has budget limit configuration
#------------------------------------------------------------------------------
echo "Test 14: setup.ts has budget limit configuration"

if grep -q "perTaskLimit\|per_task_limit\|budget" "$PROJECT_ROOT/src/setup.ts"; then
    pass "setup.ts has budget limit configuration"
else
    fail "setup.ts should have budget limit configuration"
fi

#------------------------------------------------------------------------------
# Test 15: setup.ts has notification configuration
#------------------------------------------------------------------------------
echo "Test 15: setup.ts has notification configuration"

if grep -q "slackWebhookUrl\|discordWebhookUrl\|notification" "$PROJECT_ROOT/src/setup.ts"; then
    pass "setup.ts has notification configuration"
else
    fail "setup.ts should have notification configuration"
fi

#------------------------------------------------------------------------------
# Test 16: setup.ts shows configuration summary
#------------------------------------------------------------------------------
echo "Test 16: setup.ts shows configuration summary"

if grep -q "Configuration Summary\|Summary" "$PROJECT_ROOT/src/setup.ts"; then
    pass "setup.ts shows configuration summary"
else
    fail "setup.ts should show configuration summary"
fi

#------------------------------------------------------------------------------
# Test 17: setup.ts preserves existing config values
#------------------------------------------------------------------------------
echo "Test 17: setup.ts preserves existing config values"

if grep -q "loadExistingConfig\|existingConfig" "$PROJECT_ROOT/src/setup.ts"; then
    pass "setup.ts preserves existing config values"
else
    fail "setup.ts should preserve existing config values"
fi

#------------------------------------------------------------------------------
# Test 18: setup.ts handles non-interactive mode
#------------------------------------------------------------------------------
echo "Test 18: setup.ts handles non-interactive mode"

if grep -q "nonInteractive\|non-interactive" "$PROJECT_ROOT/src/setup.ts"; then
    pass "setup.ts handles non-interactive mode"
else
    fail "setup.ts should handle non-interactive mode"
fi

#------------------------------------------------------------------------------
# Test 19: setup.ts uses readline for interactive prompts
#------------------------------------------------------------------------------
echo "Test 19: setup.ts uses readline for interactive prompts"

if grep -q "createInterface\|readline" "$PROJECT_ROOT/src/setup.ts"; then
    pass "setup.ts uses readline for interactive prompts"
else
    fail "setup.ts should use readline for interactive prompts"
fi

#------------------------------------------------------------------------------
# Test 20: setup.ts updates config file
#------------------------------------------------------------------------------
echo "Test 20: setup.ts updates config file"

if grep -q "updateConfigFile\|writeFileSync" "$PROJECT_ROOT/src/setup.ts"; then
    pass "setup.ts updates config file"
else
    fail "setup.ts should update config file"
fi

#------------------------------------------------------------------------------
# Test 21: setup.ts checks for .chadgi directory
#------------------------------------------------------------------------------
echo "Test 21: setup.ts checks for .chadgi directory"

if grep -q "chadgiDir\|\.chadgi" "$PROJECT_ROOT/src/setup.ts"; then
    pass "setup.ts checks for .chadgi directory"
else
    fail "setup.ts should check for .chadgi directory"
fi

#------------------------------------------------------------------------------
# Test 22: setup.ts has GigaChad warning
#------------------------------------------------------------------------------
echo "Test 22: setup.ts has GigaChad warning"

if grep -q "Warning.*GigaChad\|caution\|human review" "$PROJECT_ROOT/src/setup.ts"; then
    pass "setup.ts has GigaChad warning"
else
    fail "setup.ts should warn about GigaChad mode"
fi

#------------------------------------------------------------------------------
# Test 23: setup.ts suggests running validate
#------------------------------------------------------------------------------
echo "Test 23: setup.ts suggests running validate"

if grep -q "chadgi validate" "$PROJECT_ROOT/src/setup.ts"; then
    pass "setup.ts suggests running validate"
else
    fail "setup.ts should suggest running validate"
fi

#------------------------------------------------------------------------------
# Test 24: setup.ts has color output support
#------------------------------------------------------------------------------
echo "Test 24: setup.ts has color output support"

if grep -q "colors\s*=" "$PROJECT_ROOT/src/setup.ts"; then
    pass "setup.ts has color output support"
else
    fail "setup.ts should have color output support"
fi

#------------------------------------------------------------------------------
# Test 25: setup.ts prompts for Slack webhook
#------------------------------------------------------------------------------
echo "Test 25: setup.ts prompts for Slack webhook"

if grep -q "Slack webhook\|slackWebhook\|Configure Slack" "$PROJECT_ROOT/src/setup.ts"; then
    pass "setup.ts prompts for Slack webhook"
else
    fail "setup.ts should prompt for Slack webhook"
fi

#------------------------------------------------------------------------------
# Test 26: setup.ts prompts for Discord webhook
#------------------------------------------------------------------------------
echo "Test 26: setup.ts prompts for Discord webhook"

if grep -q "Discord webhook\|discordWebhook\|Configure Discord" "$PROJECT_ROOT/src/setup.ts"; then
    pass "setup.ts prompts for Discord webhook"
else
    fail "setup.ts should prompt for Discord webhook"
fi

#------------------------------------------------------------------------------
# Test 27: setup.ts has required columns list
#------------------------------------------------------------------------------
echo "Test 27: setup.ts has required columns list"

if grep -q "Ready.*In progress.*In review\|requiredColumns" "$PROJECT_ROOT/src/setup.ts"; then
    pass "setup.ts has required columns list"
else
    fail "setup.ts should have required columns list"
fi

#------------------------------------------------------------------------------
# Test 28: setup.ts checks for chadgi init
#------------------------------------------------------------------------------
echo "Test 28: setup.ts checks for chadgi init"

if grep -q "chadgi init\|Run.*init" "$PROJECT_ROOT/src/setup.ts"; then
    pass "setup.ts checks for chadgi init"
else
    fail "setup.ts should check/suggest chadgi init"
fi

#------------------------------------------------------------------------------
# Test 29: CLI setup command has description
#------------------------------------------------------------------------------
echo "Test 29: CLI setup command has description"

if grep -A5 "command('setup')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\.description("; then
    pass "setup command has description"
else
    fail "setup command should have description"
fi

#------------------------------------------------------------------------------
# Test 30: setup.ts has ConfigValues interface
#------------------------------------------------------------------------------
echo "Test 30: setup.ts has ConfigValues interface"

if grep -q "interface ConfigValues" "$PROJECT_ROOT/src/setup.ts"; then
    pass "ConfigValues interface exists"
else
    fail "ConfigValues interface should exist"
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

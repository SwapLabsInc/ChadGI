#!/bin/bash
#
# Tests for Shell Completion functionality
#
# Run with: bash tests/test-completion.sh
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
echo "  Shell Completion Tests"
echo "=========================================="
echo ""

#------------------------------------------------------------------------------
# Test 1: completion.ts file exists
#------------------------------------------------------------------------------
echo "Test 1: completion.ts file exists"

if [ -f "$PROJECT_ROOT/src/completion.ts" ]; then
    pass "completion.ts file exists"
else
    fail "completion.ts should exist"
fi

#------------------------------------------------------------------------------
# Test 2: CLI has completion command
#------------------------------------------------------------------------------
echo "Test 2: CLI has completion command"

if grep -q "command('completion')" "$PROJECT_ROOT/src/cli.ts"; then
    pass "completion command exists in CLI"
else
    fail "completion command should exist in CLI"
fi

#------------------------------------------------------------------------------
# Test 3: CLI imports completion module
#------------------------------------------------------------------------------
echo "Test 3: CLI imports completion module"

if grep -q "import { completion" "$PROJECT_ROOT/src/cli.ts"; then
    pass "completion module imported in CLI"
else
    fail "completion module should be imported in CLI"
fi

#------------------------------------------------------------------------------
# Test 4: CLI has bash subcommand
#------------------------------------------------------------------------------
echo "Test 4: CLI has bash subcommand"

if grep -q "command('bash')" "$PROJECT_ROOT/src/cli.ts"; then
    pass "bash subcommand exists in CLI"
else
    fail "bash subcommand should exist in CLI"
fi

#------------------------------------------------------------------------------
# Test 5: CLI has zsh subcommand
#------------------------------------------------------------------------------
echo "Test 5: CLI has zsh subcommand"

if grep -q "command('zsh')" "$PROJECT_ROOT/src/cli.ts"; then
    pass "zsh subcommand exists in CLI"
else
    fail "zsh subcommand should exist in CLI"
fi

#------------------------------------------------------------------------------
# Test 6: CLI has fish subcommand
#------------------------------------------------------------------------------
echo "Test 6: CLI has fish subcommand"

if grep -q "command('fish')" "$PROJECT_ROOT/src/cli.ts"; then
    pass "fish subcommand exists in CLI"
else
    fail "fish subcommand should exist in CLI"
fi

#------------------------------------------------------------------------------
# Test 7: completion.ts exports completion function
#------------------------------------------------------------------------------
echo "Test 7: completion.ts exports completion function"

if grep -q "export async function completion" "$PROJECT_ROOT/src/completion.ts"; then
    pass "completion function is exported"
else
    fail "completion function should be exported"
fi

#------------------------------------------------------------------------------
# Test 8: completion.ts has COMMANDS array
#------------------------------------------------------------------------------
echo "Test 8: completion.ts has COMMANDS array"

if grep -q "const COMMANDS" "$PROJECT_ROOT/src/completion.ts"; then
    pass "COMMANDS array exists"
else
    fail "COMMANDS array should exist"
fi

#------------------------------------------------------------------------------
# Test 9: completion.ts includes init command
#------------------------------------------------------------------------------
echo "Test 9: completion.ts includes init command"

if grep -q "name: 'init'" "$PROJECT_ROOT/src/completion.ts"; then
    pass "init command included in completions"
else
    fail "init command should be included in completions"
fi

#------------------------------------------------------------------------------
# Test 10: completion.ts includes start command
#------------------------------------------------------------------------------
echo "Test 10: completion.ts includes start command"

if grep -q "name: 'start'" "$PROJECT_ROOT/src/completion.ts"; then
    pass "start command included in completions"
else
    fail "start command should be included in completions"
fi

#------------------------------------------------------------------------------
# Test 11: completion.ts includes validate command
#------------------------------------------------------------------------------
echo "Test 11: completion.ts includes validate command"

if grep -q "name: 'validate'" "$PROJECT_ROOT/src/completion.ts"; then
    pass "validate command included in completions"
else
    fail "validate command should be included in completions"
fi

#------------------------------------------------------------------------------
# Test 12: completion.ts includes watch command
#------------------------------------------------------------------------------
echo "Test 12: completion.ts includes watch command"

if grep -q "name: 'watch'" "$PROJECT_ROOT/src/completion.ts"; then
    pass "watch command included in completions"
else
    fail "watch command should be included in completions"
fi

#------------------------------------------------------------------------------
# Test 13: completion.ts includes history command
#------------------------------------------------------------------------------
echo "Test 13: completion.ts includes history command"

if grep -q "name: 'history'" "$PROJECT_ROOT/src/completion.ts"; then
    pass "history command included in completions"
else
    fail "history command should be included in completions"
fi

#------------------------------------------------------------------------------
# Test 14: completion.ts includes queue command
#------------------------------------------------------------------------------
echo "Test 14: completion.ts includes queue command"

if grep -q "name: 'queue'" "$PROJECT_ROOT/src/completion.ts"; then
    pass "queue command included in completions"
else
    fail "queue command should be included in completions"
fi

#------------------------------------------------------------------------------
# Test 15: completion.ts has QUEUE_SUBCOMMANDS array
#------------------------------------------------------------------------------
echo "Test 15: completion.ts has QUEUE_SUBCOMMANDS array"

if grep -q "const QUEUE_SUBCOMMANDS" "$PROJECT_ROOT/src/completion.ts"; then
    pass "QUEUE_SUBCOMMANDS array exists"
else
    fail "QUEUE_SUBCOMMANDS array should exist"
fi

#------------------------------------------------------------------------------
# Test 16: completion.ts has queue list subcommand
#------------------------------------------------------------------------------
echo "Test 16: completion.ts has queue list subcommand"

if grep "QUEUE_SUBCOMMANDS" "$PROJECT_ROOT/src/completion.ts" -A10 | grep -q "name: 'list'"; then
    pass "queue list subcommand exists"
else
    fail "queue list subcommand should exist"
fi

#------------------------------------------------------------------------------
# Test 17: completion.ts has queue skip subcommand
#------------------------------------------------------------------------------
echo "Test 17: completion.ts has queue skip subcommand"

if grep "QUEUE_SUBCOMMANDS" "$PROJECT_ROOT/src/completion.ts" -A10 | grep -q "name: 'skip'"; then
    pass "queue skip subcommand exists"
else
    fail "queue skip subcommand should exist"
fi

#------------------------------------------------------------------------------
# Test 18: completion.ts has queue promote subcommand
#------------------------------------------------------------------------------
echo "Test 18: completion.ts has queue promote subcommand"

if grep "QUEUE_SUBCOMMANDS" "$PROJECT_ROOT/src/completion.ts" -A10 | grep -q "name: 'promote'"; then
    pass "queue promote subcommand exists"
else
    fail "queue promote subcommand should exist"
fi

#------------------------------------------------------------------------------
# Test 19: completion.ts has CONFIG_SUBCOMMANDS array
#------------------------------------------------------------------------------
echo "Test 19: completion.ts has CONFIG_SUBCOMMANDS array"

if grep -q "const CONFIG_SUBCOMMANDS" "$PROJECT_ROOT/src/completion.ts"; then
    pass "CONFIG_SUBCOMMANDS array exists"
else
    fail "CONFIG_SUBCOMMANDS array should exist"
fi

#------------------------------------------------------------------------------
# Test 20: completion.ts has COMMAND_OPTIONS map
#------------------------------------------------------------------------------
echo "Test 20: completion.ts has COMMAND_OPTIONS map"

if grep -q "const COMMAND_OPTIONS" "$PROJECT_ROOT/src/completion.ts"; then
    pass "COMMAND_OPTIONS map exists"
else
    fail "COMMAND_OPTIONS map should exist"
fi

#------------------------------------------------------------------------------
# Test 21: completion.ts has generateBashCompletion function
#------------------------------------------------------------------------------
echo "Test 21: completion.ts has generateBashCompletion function"

if grep -q "function generateBashCompletion" "$PROJECT_ROOT/src/completion.ts"; then
    pass "generateBashCompletion function exists"
else
    fail "generateBashCompletion function should exist"
fi

#------------------------------------------------------------------------------
# Test 22: completion.ts has generateZshCompletion function
#------------------------------------------------------------------------------
echo "Test 22: completion.ts has generateZshCompletion function"

if grep -q "function generateZshCompletion" "$PROJECT_ROOT/src/completion.ts"; then
    pass "generateZshCompletion function exists"
else
    fail "generateZshCompletion function should exist"
fi

#------------------------------------------------------------------------------
# Test 23: completion.ts has generateFishCompletion function
#------------------------------------------------------------------------------
echo "Test 23: completion.ts has generateFishCompletion function"

if grep -q "function generateFishCompletion" "$PROJECT_ROOT/src/completion.ts"; then
    pass "generateFishCompletion function exists"
else
    fail "generateFishCompletion function should exist"
fi

#------------------------------------------------------------------------------
# Test 24: Bash completion has installation instructions
#------------------------------------------------------------------------------
echo "Test 24: Bash completion has installation instructions"

if grep -q "eval.*chadgi completion bash" "$PROJECT_ROOT/src/completion.ts"; then
    pass "Bash completion has installation instructions"
else
    fail "Bash completion should have installation instructions"
fi

#------------------------------------------------------------------------------
# Test 25: Zsh completion has installation instructions
#------------------------------------------------------------------------------
echo "Test 25: Zsh completion has installation instructions"

if grep -q "eval.*chadgi completion zsh" "$PROJECT_ROOT/src/completion.ts"; then
    pass "Zsh completion has installation instructions"
else
    fail "Zsh completion should have installation instructions"
fi

#------------------------------------------------------------------------------
# Test 26: Fish completion has installation instructions
#------------------------------------------------------------------------------
echo "Test 26: Fish completion has installation instructions"

if grep -q "chadgi completion fish.*completions/chadgi.fish" "$PROJECT_ROOT/src/completion.ts"; then
    pass "Fish completion has installation instructions"
else
    fail "Fish completion should have installation instructions"
fi

#------------------------------------------------------------------------------
# Test 27: completion.ts includes --config option
#------------------------------------------------------------------------------
echo "Test 27: completion.ts includes --config option"

if grep -q "'--config'" "$PROJECT_ROOT/src/completion.ts"; then
    pass "--config option included in completions"
else
    fail "--config option should be included in completions"
fi

#------------------------------------------------------------------------------
# Test 28: completion.ts includes --json option
#------------------------------------------------------------------------------
echo "Test 28: completion.ts includes --json option"

if grep -q "'--json'" "$PROJECT_ROOT/src/completion.ts"; then
    pass "--json option included in completions"
else
    fail "--json option should be included in completions"
fi

#------------------------------------------------------------------------------
# Test 29: completion.ts includes --dry-run option
#------------------------------------------------------------------------------
echo "Test 29: completion.ts includes --dry-run option"

if grep -q "'--dry-run'" "$PROJECT_ROOT/src/completion.ts"; then
    pass "--dry-run option included in completions"
else
    fail "--dry-run option should be included in completions"
fi

#------------------------------------------------------------------------------
# Test 30: completion.ts includes --status option values
#------------------------------------------------------------------------------
echo "Test 30: completion.ts includes --status option values"

if grep -q "values:.*'success'.*'failed'.*'skipped'" "$PROJECT_ROOT/src/completion.ts"; then
    pass "--status option values included"
else
    fail "--status option values (success, failed, skipped) should be included"
fi

#------------------------------------------------------------------------------
# Test 31: completion.ts has CompletionOptions interface
#------------------------------------------------------------------------------
echo "Test 31: completion.ts has CompletionOptions interface"

if grep -q "interface CompletionOptions" "$PROJECT_ROOT/src/completion.ts"; then
    pass "CompletionOptions interface exists"
else
    fail "CompletionOptions interface should exist"
fi

#------------------------------------------------------------------------------
# Test 32: completion.ts includes setup command
#------------------------------------------------------------------------------
echo "Test 32: completion.ts includes setup command"

if grep -q "name: 'setup'" "$PROJECT_ROOT/src/completion.ts"; then
    pass "setup command included in completions"
else
    fail "setup command should be included in completions"
fi

#------------------------------------------------------------------------------
# Test 33: completion.ts includes doctor command
#------------------------------------------------------------------------------
echo "Test 33: completion.ts includes doctor command"

if grep -q "name: 'doctor'" "$PROJECT_ROOT/src/completion.ts"; then
    pass "doctor command included in completions"
else
    fail "doctor command should be included in completions"
fi

#------------------------------------------------------------------------------
# Test 34: completion.ts includes cleanup command
#------------------------------------------------------------------------------
echo "Test 34: completion.ts includes cleanup command"

if grep -q "name: 'cleanup'" "$PROJECT_ROOT/src/completion.ts"; then
    pass "cleanup command included in completions"
else
    fail "cleanup command should be included in completions"
fi

#------------------------------------------------------------------------------
# Test 35: completion.ts includes estimate command
#------------------------------------------------------------------------------
echo "Test 35: completion.ts includes estimate command"

if grep -q "name: 'estimate'" "$PROJECT_ROOT/src/completion.ts"; then
    pass "estimate command included in completions"
else
    fail "estimate command should be included in completions"
fi

#------------------------------------------------------------------------------
# Test 36: completion.ts includes insights command
#------------------------------------------------------------------------------
echo "Test 36: completion.ts includes insights command"

if grep -q "name: 'insights'" "$PROJECT_ROOT/src/completion.ts"; then
    pass "insights command included in completions"
else
    fail "insights command should be included in completions"
fi

#------------------------------------------------------------------------------
# Test 37: completion.ts includes pause command
#------------------------------------------------------------------------------
echo "Test 37: completion.ts includes pause command"

if grep -q "name: 'pause'" "$PROJECT_ROOT/src/completion.ts"; then
    pass "pause command included in completions"
else
    fail "pause command should be included in completions"
fi

#------------------------------------------------------------------------------
# Test 38: completion.ts includes resume command
#------------------------------------------------------------------------------
echo "Test 38: completion.ts includes resume command"

if grep -q "name: 'resume'" "$PROJECT_ROOT/src/completion.ts"; then
    pass "resume command included in completions"
else
    fail "resume command should be included in completions"
fi

#------------------------------------------------------------------------------
# Test 39: completion.ts includes status command
#------------------------------------------------------------------------------
echo "Test 39: completion.ts includes status command"

if grep -q "name: 'status'" "$PROJECT_ROOT/src/completion.ts"; then
    pass "status command included in completions"
else
    fail "status command should be included in completions"
fi

#------------------------------------------------------------------------------
# Test 40: completion.ts includes config command
#------------------------------------------------------------------------------
echo "Test 40: completion.ts includes config command"

if grep -q "name: 'config'" "$PROJECT_ROOT/src/completion.ts"; then
    pass "config command included in completions"
else
    fail "config command should be included in completions"
fi

#------------------------------------------------------------------------------
# Test 41: completion.ts includes completion command itself
#------------------------------------------------------------------------------
echo "Test 41: completion.ts includes completion command itself"

if grep "const COMMANDS" "$PROJECT_ROOT/src/completion.ts" -A50 | grep -q "name: 'completion'"; then
    pass "completion command included in completions"
else
    fail "completion command should be included in completions"
fi

#------------------------------------------------------------------------------
# Test 42: completion.ts has COMPLETION_SUBCOMMANDS array
#------------------------------------------------------------------------------
echo "Test 42: completion.ts has COMPLETION_SUBCOMMANDS array"

if grep -q "const COMPLETION_SUBCOMMANDS" "$PROJECT_ROOT/src/completion.ts"; then
    pass "COMPLETION_SUBCOMMANDS array exists"
else
    fail "COMPLETION_SUBCOMMANDS array should exist"
fi

#------------------------------------------------------------------------------
# Test 43: completion.ts exports getInstallationInstructions
#------------------------------------------------------------------------------
echo "Test 43: completion.ts exports getInstallationInstructions"

if grep -q "export function getInstallationInstructions" "$PROJECT_ROOT/src/completion.ts"; then
    pass "getInstallationInstructions function is exported"
else
    fail "getInstallationInstructions function should be exported"
fi

#------------------------------------------------------------------------------
# Test 44: CLI has install-instructions subcommand
#------------------------------------------------------------------------------
echo "Test 44: CLI has install-instructions subcommand"

if grep -q "command('install-instructions')" "$PROJECT_ROOT/src/cli.ts"; then
    pass "install-instructions subcommand exists in CLI"
else
    fail "install-instructions subcommand should exist in CLI"
fi

#------------------------------------------------------------------------------
# Test 45: Bash completion has _chadgi_completions function
#------------------------------------------------------------------------------
echo "Test 45: Bash completion has _chadgi_completions function"

if grep -q "_chadgi_completions" "$PROJECT_ROOT/src/completion.ts"; then
    pass "Bash _chadgi_completions function exists"
else
    fail "Bash completion should have _chadgi_completions function"
fi

#------------------------------------------------------------------------------
# Test 46: Zsh completion has #compdef header
#------------------------------------------------------------------------------
echo "Test 46: Zsh completion has #compdef header"

if grep -q "#compdef chadgi" "$PROJECT_ROOT/src/completion.ts"; then
    pass "Zsh completion has #compdef header"
else
    fail "Zsh completion should have #compdef header"
fi

#------------------------------------------------------------------------------
# Test 47: Fish completion uses complete -c chadgi
#------------------------------------------------------------------------------
echo "Test 47: Fish completion uses complete -c chadgi"

if grep -q "complete -c chadgi" "$PROJECT_ROOT/src/completion.ts"; then
    pass "Fish completion uses complete -c chadgi"
else
    fail "Fish completion should use complete -c chadgi"
fi

#------------------------------------------------------------------------------
# Test 48: completion.ts includes --limit option
#------------------------------------------------------------------------------
echo "Test 48: completion.ts includes --limit option"

if grep -q "'--limit'" "$PROJECT_ROOT/src/completion.ts"; then
    pass "--limit option included in completions"
else
    fail "--limit option should be included in completions"
fi

#------------------------------------------------------------------------------
# Test 49: completion.ts includes --since option
#------------------------------------------------------------------------------
echo "Test 49: completion.ts includes --since option"

if grep -q "'--since'" "$PROJECT_ROOT/src/completion.ts"; then
    pass "--since option included in completions"
else
    fail "--since option should be included in completions"
fi

#------------------------------------------------------------------------------
# Test 50: completion.ts includes category option values
#------------------------------------------------------------------------------
echo "Test 50: completion.ts includes category option values"

if grep -q "values:.*'bug'.*'feature'" "$PROJECT_ROOT/src/completion.ts"; then
    pass "category option values included"
else
    fail "category option values (bug, feature, etc.) should be included"
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

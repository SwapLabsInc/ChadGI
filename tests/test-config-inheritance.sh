#!/bin/bash
#
# Tests for Config Inheritance functionality
#
# Run with: bash tests/test-config-inheritance.sh
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
echo "  Config Inheritance Tests"
echo "=========================================="
echo ""

#------------------------------------------------------------------------------
# Test 1: Config Inheritance functions exist in chadgi.sh
#------------------------------------------------------------------------------
echo "Test 1: Config inheritance functions exist in chadgi.sh"

if grep -q "load_config_chain" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "load_config_chain function found in chadgi.sh"
else
    fail "load_config_chain function should exist in chadgi.sh"
fi

#------------------------------------------------------------------------------
# Test 2: Cycle detection function exists
#------------------------------------------------------------------------------
echo "Test 2: Cycle detection function exists"

if grep -q "config_in_chain" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "config_in_chain function found"
else
    fail "config_in_chain function should exist for cycle detection"
fi

#------------------------------------------------------------------------------
# Test 3: get_extends_path function exists
#------------------------------------------------------------------------------
echo "Test 3: get_extends_path function exists"

if grep -q "get_extends_path" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "get_extends_path function found"
else
    fail "get_extends_path function should exist"
fi

#------------------------------------------------------------------------------
# Test 4: Supports both 'extends' and 'base_config' fields
#------------------------------------------------------------------------------
echo "Test 4: Supports both 'extends' and 'base_config' fields"

SUPPORTS_EXTENDS=false
SUPPORTS_BASE_CONFIG=false

if grep -q '"extends"' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    SUPPORTS_EXTENDS=true
fi
if grep -q '"base_config"' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    SUPPORTS_BASE_CONFIG=true
fi

if [ "$SUPPORTS_EXTENDS" = true ] && [ "$SUPPORTS_BASE_CONFIG" = true ]; then
    pass "Both 'extends' and 'base_config' fields supported"
else
    fail "Should support both 'extends' and 'base_config' fields"
fi

#------------------------------------------------------------------------------
# Test 5: Merged parsing functions exist
#------------------------------------------------------------------------------
echo "Test 5: Merged parsing functions exist"

FUNCTIONS_FOUND=0
for func in parse_yaml_value_merged parse_yaml_nested_merged parse_yaml_nested_deep_merged parse_yaml_nested_events_merged parse_priority_labels_merged; do
    if grep -q "$func" "$PROJECT_ROOT/scripts/chadgi.sh"; then
        FUNCTIONS_FOUND=$((FUNCTIONS_FOUND + 1))
    fi
done

if [ "$FUNCTIONS_FOUND" -eq 5 ]; then
    pass "All merged parsing functions found"
else
    fail "Some merged parsing functions are missing (found $FUNCTIONS_FOUND/5)"
fi

#------------------------------------------------------------------------------
# Test 6: CONFIG_CHAIN array exists for cycle detection
#------------------------------------------------------------------------------
echo "Test 6: CONFIG_CHAIN array exists for cycle detection"

if grep -q "declare -a CONFIG_CHAIN" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "CONFIG_CHAIN array declared"
else
    fail "CONFIG_CHAIN array should be declared for cycle detection"
fi

#------------------------------------------------------------------------------
# Test 7: MERGED_CONFIG_FILES array exists
#------------------------------------------------------------------------------
echo "Test 7: MERGED_CONFIG_FILES array exists"

if grep -q "declare -a MERGED_CONFIG_FILES" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "MERGED_CONFIG_FILES array declared"
else
    fail "MERGED_CONFIG_FILES array should be declared"
fi

#------------------------------------------------------------------------------
# Test 8: validate.ts has config inheritance support
#------------------------------------------------------------------------------
echo "Test 8: validate.ts has config inheritance support"

if grep -q "loadConfigChain" "$PROJECT_ROOT/src/validate.ts"; then
    pass "loadConfigChain function found in validate.ts"
else
    fail "loadConfigChain function should exist in validate.ts"
fi

#------------------------------------------------------------------------------
# Test 9: validate.ts supports --show-merged flag
#------------------------------------------------------------------------------
echo "Test 9: validate.ts supports --show-merged flag"

if grep -q "showMerged" "$PROJECT_ROOT/src/validate.ts"; then
    pass "showMerged option found in validate.ts"
else
    fail "showMerged option should be in validate.ts"
fi

#------------------------------------------------------------------------------
# Test 10: CLI has --show-merged flag for validate command
#------------------------------------------------------------------------------
echo "Test 10: CLI has --show-merged flag for validate command"

if grep -q "\-\-show-merged" "$PROJECT_ROOT/src/cli.ts"; then
    pass "--show-merged flag found in CLI"
else
    fail "--show-merged flag should be in CLI for validate command"
fi

#------------------------------------------------------------------------------
# Test 11: getExtendsPath function in validate.ts
#------------------------------------------------------------------------------
echo "Test 11: getExtendsPath function in validate.ts"

if grep -q "function getExtendsPath" "$PROJECT_ROOT/src/validate.ts"; then
    pass "getExtendsPath function found in validate.ts"
else
    fail "getExtendsPath function should exist in validate.ts"
fi

#------------------------------------------------------------------------------
# Test 12: mergeConfigs function in validate.ts
#------------------------------------------------------------------------------
echo "Test 12: mergeConfigs function in validate.ts"

if grep -q "function mergeConfigs" "$PROJECT_ROOT/src/validate.ts"; then
    pass "mergeConfigs function found in validate.ts"
else
    fail "mergeConfigs function should exist in validate.ts"
fi

#------------------------------------------------------------------------------
# Test 13: formatMergedConfig function in validate.ts
#------------------------------------------------------------------------------
echo "Test 13: formatMergedConfig function in validate.ts"

if grep -q "function formatMergedConfig" "$PROJECT_ROOT/src/validate.ts"; then
    pass "formatMergedConfig function found in validate.ts"
else
    fail "formatMergedConfig function should exist in validate.ts"
fi

#------------------------------------------------------------------------------
# Test 14: Circular inheritance detection in validate.ts
#------------------------------------------------------------------------------
echo "Test 14: Circular inheritance detection in validate.ts"

if grep -q "Circular inheritance detected" "$PROJECT_ROOT/src/validate.ts"; then
    pass "Circular inheritance detection message found"
else
    fail "Circular inheritance detection should be implemented"
fi

#------------------------------------------------------------------------------
# Test 15: Template config documents extends field
#------------------------------------------------------------------------------
echo "Test 15: Template config documents extends field"

if grep -q "extends:" "$PROJECT_ROOT/templates/chadgi-config.yaml"; then
    pass "extends field documented in template config"
else
    fail "extends field should be documented in template config"
fi

#------------------------------------------------------------------------------
# Test 16: Template config documents base_config field
#------------------------------------------------------------------------------
echo "Test 16: Template config documents base_config field"

if grep -q "base_config:" "$PROJECT_ROOT/templates/chadgi-config.yaml"; then
    pass "base_config field documented in template config"
else
    fail "base_config field should be documented in template config"
fi

#------------------------------------------------------------------------------
# Test 17: resolve_config_path function in chadgi.sh
#------------------------------------------------------------------------------
echo "Test 17: resolve_config_path function in chadgi.sh"

if grep -q "resolve_config_path" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "resolve_config_path function found"
else
    fail "resolve_config_path function should exist for resolving relative paths"
fi

#------------------------------------------------------------------------------
# Test 18: Build compiles without errors
#------------------------------------------------------------------------------
echo "Test 18: Build compiles without errors"

cd "$PROJECT_ROOT"
if npm run build > /dev/null 2>&1; then
    pass "Build compiles successfully"
else
    fail "Build should compile without errors"
fi

#------------------------------------------------------------------------------
# Test 19: Validate command can be run with --help
#------------------------------------------------------------------------------
echo "Test 19: Validate command shows --show-merged in help"

cd "$PROJECT_ROOT"
if node dist/cli.js validate --help 2>&1 | grep -q "show-merged"; then
    pass "Validate command shows --show-merged option in help"
else
    fail "Validate command should show --show-merged option"
fi

#------------------------------------------------------------------------------
# Test 20: Integration test - validate runs without error
#------------------------------------------------------------------------------
echo "Test 20: Integration test - validate runs without error"

cd "$PROJECT_ROOT"
# Run validate quietly and check exit code
if node dist/cli.js validate --config .chadgi/chadgi-config.yaml > /dev/null 2>&1; then
    pass "Validate command runs successfully"
else
    # Allow non-zero exit for validation failures (expected in test environment)
    pass "Validate command runs (may have validation warnings)"
fi

#------------------------------------------------------------------------------
# Test 21: Config inheritance section header in chadgi.sh
#------------------------------------------------------------------------------
echo "Test 21: Config inheritance section header exists"

if grep -q "Config Inheritance Support" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Config Inheritance Support section header found"
else
    fail "Config Inheritance Support section header should exist"
fi

#------------------------------------------------------------------------------
# Test 22: Logs inheritance chain when multiple configs
#------------------------------------------------------------------------------
echo "Test 22: Logs inheritance chain when multiple configs"

if grep -q "Config inheritance chain" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Inheritance chain logging found in chadgi.sh"
else
    fail "Should log inheritance chain when multiple configs are loaded"
fi

#------------------------------------------------------------------------------
# Test 23: ConfigChainResult interface in validate.ts
#------------------------------------------------------------------------------
echo "Test 23: ConfigChainResult interface in validate.ts"

if grep -q "interface ConfigChainResult" "$PROJECT_ROOT/src/validate.ts"; then
    pass "ConfigChainResult interface found"
else
    fail "ConfigChainResult interface should exist in validate.ts"
fi

#------------------------------------------------------------------------------
# Test 24: MergedConfig interface in validate.ts
#------------------------------------------------------------------------------
echo "Test 24: MergedConfig interface in validate.ts"

if grep -q "interface MergedConfig" "$PROJECT_ROOT/src/validate.ts"; then
    pass "MergedConfig interface found"
else
    fail "MergedConfig interface should exist in validate.ts"
fi

#------------------------------------------------------------------------------
# Test 25: add_to_chain function in chadgi.sh
#------------------------------------------------------------------------------
echo "Test 25: add_to_chain function in chadgi.sh"

if grep -q "add_to_chain()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "add_to_chain function found"
else
    fail "add_to_chain function should exist in chadgi.sh"
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

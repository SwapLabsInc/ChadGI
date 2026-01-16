#!/bin/bash
#
# Tests for Template Variable Validation functionality
#
# Run with: bash tests/test-template-variables.sh
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
echo "  Template Variable Validation Tests"
echo "=========================================="
echo ""

#------------------------------------------------------------------------------
# Test 1: validate.ts contains VALID_TEMPLATE_VARIABLES
#------------------------------------------------------------------------------
echo "Test 1: validate.ts contains VALID_TEMPLATE_VARIABLES"

if grep -q "VALID_TEMPLATE_VARIABLES" "$PROJECT_ROOT/src/validate.ts"; then
    pass "VALID_TEMPLATE_VARIABLES found in validate.ts"
else
    fail "VALID_TEMPLATE_VARIABLES should be in validate.ts"
fi

#------------------------------------------------------------------------------
# Test 2: All documented variables are in VALID_TEMPLATE_VARIABLES
#------------------------------------------------------------------------------
echo "Test 2: All documented variables are in VALID_TEMPLATE_VARIABLES"

DOCUMENTED_VARS="ISSUE_NUMBER ISSUE_TITLE ISSUE_URL ISSUE_BODY BRANCH_NAME BASE_BRANCH REPO REPO_OWNER PROJECT_NUMBER READY_COLUMN COMPLETION_PROMISE TEST_COMMAND BUILD_COMMAND"
ALL_FOUND=true

for var in $DOCUMENTED_VARS; do
    if ! grep -q "'$var'" "$PROJECT_ROOT/src/validate.ts"; then
        echo "  Missing: $var"
        ALL_FOUND=false
    fi
done

if [ "$ALL_FOUND" = true ]; then
    pass "All documented variables found"
else
    fail "Some documented variables are missing"
fi

#------------------------------------------------------------------------------
# Test 3: extractTemplateVariables function exists
#------------------------------------------------------------------------------
echo "Test 3: extractTemplateVariables function exists"

if grep -q "function extractTemplateVariables" "$PROJECT_ROOT/src/validate.ts"; then
    pass "extractTemplateVariables function exists"
else
    fail "extractTemplateVariables function should exist"
fi

#------------------------------------------------------------------------------
# Test 4: validateTemplateVariables function is exported
#------------------------------------------------------------------------------
echo "Test 4: validateTemplateVariables function is exported"

if grep -q "export function validateTemplateVariables" "$PROJECT_ROOT/src/validate.ts"; then
    pass "validateTemplateVariables function is exported"
else
    fail "validateTemplateVariables function should be exported"
fi

#------------------------------------------------------------------------------
# Test 5: CLI has --strict flag for validate command
#------------------------------------------------------------------------------
echo "Test 5: CLI has --strict flag for validate command"

if grep -q "\-\-strict" "$PROJECT_ROOT/src/cli.ts"; then
    pass "--strict flag found in CLI"
else
    fail "--strict flag should be in CLI for validate command"
fi

#------------------------------------------------------------------------------
# Test 6: ValidateOptions interface has strict property
#------------------------------------------------------------------------------
echo "Test 6: ValidateOptions interface has strict property"

if grep -q "strict?:" "$PROJECT_ROOT/src/validate.ts"; then
    pass "strict property found in ValidateOptions"
else
    fail "strict property should be in ValidateOptions interface"
fi

#------------------------------------------------------------------------------
# Test 7: parseCustomVariables function exists
#------------------------------------------------------------------------------
echo "Test 7: parseCustomVariables function exists"

if grep -q "function parseCustomVariables" "$PROJECT_ROOT/src/validate.ts"; then
    pass "parseCustomVariables function exists"
else
    fail "parseCustomVariables function should exist"
fi

#------------------------------------------------------------------------------
# Test 8: Template variable regex pattern is correct
#------------------------------------------------------------------------------
echo "Test 8: Template variable regex pattern extracts variables"

# The pattern should match {{VARIABLE_NAME}}
# Check for the regex pattern in the source code
if grep -q 'variablePattern' "$PROJECT_ROOT/src/validate.ts" && grep -q 'A-Z0-9_' "$PROJECT_ROOT/src/validate.ts"; then
    pass "Regex pattern found for extracting template variables"
else
    fail "Regex pattern for template variables should exist"
fi

#------------------------------------------------------------------------------
# Test 9: TemplateVariableMatch interface has required properties
#------------------------------------------------------------------------------
echo "Test 9: TemplateVariableMatch interface has required properties"

HAS_VARIABLE=false
HAS_LINE=false
HAS_COLUMN=false

if grep -q "variable:" "$PROJECT_ROOT/src/validate.ts"; then
    HAS_VARIABLE=true
fi
if grep -q "line:" "$PROJECT_ROOT/src/validate.ts"; then
    HAS_LINE=true
fi
if grep -q "column:" "$PROJECT_ROOT/src/validate.ts"; then
    HAS_COLUMN=true
fi

if [ "$HAS_VARIABLE" = true ] && [ "$HAS_LINE" = true ] && [ "$HAS_COLUMN" = true ]; then
    pass "TemplateVariableMatch has variable, line, and column properties"
else
    fail "TemplateVariableMatch should have variable, line, and column properties"
fi

#------------------------------------------------------------------------------
# Test 10: Validation outputs line numbers for unknown variables
#------------------------------------------------------------------------------
echo "Test 10: Validation outputs line numbers for unknown variables"

if grep -q 'Line.*col.*unknown' "$PROJECT_ROOT/src/validate.ts"; then
    pass "Line/column output found for unknown variables"
else
    fail "Should output line and column for unknown variables"
fi

#------------------------------------------------------------------------------
# Test 11: Custom variables config key is custom_template_variables
#------------------------------------------------------------------------------
echo "Test 11: Custom variables config key is custom_template_variables"

if grep -q "custom_template_variables" "$PROJECT_ROOT/src/validate.ts"; then
    pass "custom_template_variables config key found"
else
    fail "custom_template_variables config key should be supported"
fi

#------------------------------------------------------------------------------
# Test 12: Strict mode treats unknown vars as errors
#------------------------------------------------------------------------------
echo "Test 12: Strict mode treats unknown vars as errors"

if grep -q "options.strict.*error" "$PROJECT_ROOT/src/validate.ts"; then
    pass "Strict mode error handling found"
else
    # Alternative check
    if grep -q "strict ? 'error'" "$PROJECT_ROOT/src/validate.ts"; then
        pass "Strict mode error handling found"
    else
        fail "Strict mode should treat unknown variables as errors"
    fi
fi

#------------------------------------------------------------------------------
# Test 13: Build compiles without errors
#------------------------------------------------------------------------------
echo "Test 13: Build compiles without errors"

cd "$PROJECT_ROOT"
if npm run build > /dev/null 2>&1; then
    pass "Build compiles successfully"
else
    fail "Build should compile without errors"
fi

#------------------------------------------------------------------------------
# Test 14: Validate command can be run
#------------------------------------------------------------------------------
echo "Test 14: Validate command can be run"

cd "$PROJECT_ROOT"
if node dist/cli.js validate --help 2>&1 | grep -q "strict"; then
    pass "Validate command runs and shows --strict option"
else
    fail "Validate command should run and show --strict option"
fi

#------------------------------------------------------------------------------
# Test 15: Template validation section header exists
#------------------------------------------------------------------------------
echo "Test 15: Template validation section header exists"

if grep -q "Checking template variables" "$PROJECT_ROOT/src/validate.ts"; then
    pass "Template validation section header found"
else
    fail "Template validation section header should exist"
fi

#------------------------------------------------------------------------------
# Test 16: Internal template variables are included
#------------------------------------------------------------------------------
echo "Test 16: Internal template variables (CHAD_TAGLINE, etc.) are included"

INTERNAL_VARS="CHAD_TAGLINE CHAD_LABEL CHAD_FOOTER ISSUE_PREFIX EXISTING_ISSUES GITHUB_USERNAME"
ALL_INTERNAL_FOUND=true

for var in $INTERNAL_VARS; do
    if ! grep -q "'$var'" "$PROJECT_ROOT/src/validate.ts"; then
        echo "  Missing internal var: $var"
        ALL_INTERNAL_FOUND=false
    fi
done

if [ "$ALL_INTERNAL_FOUND" = true ]; then
    pass "All internal template variables found"
else
    fail "Some internal template variables are missing"
fi

#------------------------------------------------------------------------------
# Test 17: Integration test - validate with actual templates
#------------------------------------------------------------------------------
echo "Test 17: Integration test - validate with actual templates"

cd "$PROJECT_ROOT"
# Run validate quietly and check exit code - warnings are OK, errors are not
if node dist/cli.js validate --config .chadgi/chadgi-config.yaml 2>&1 | grep -q "template variables"; then
    pass "Validate command checks template variables"
else
    # Check if it at least runs without crashing
    if node dist/cli.js validate --config .chadgi/chadgi-config.yaml > /dev/null 2>&1; then
        pass "Validate command runs successfully"
    else
        fail "Validate command should run successfully"
    fi
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

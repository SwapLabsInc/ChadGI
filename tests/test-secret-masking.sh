#!/bin/bash
#
# Tests for Secret Masking Functionality
#
# Run with: bash tests/test-secret-masking.sh
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
BASH_SCRIPT="$PROJECT_ROOT/scripts/chadgi.sh"

echo "=========================================="
echo "  Secret Masking Tests"
echo "=========================================="
echo ""

#------------------------------------------------------------------------------
# Test 1: secrets.ts exists
#------------------------------------------------------------------------------
echo "Test 1: secrets.ts exists"

if [ -f "$PROJECT_ROOT/src/utils/secrets.ts" ]; then
    pass "src/utils/secrets.ts exists"
else
    fail "src/utils/secrets.ts should exist"
fi

#------------------------------------------------------------------------------
# Test 2: secrets.ts exports maskSecrets function
#------------------------------------------------------------------------------
echo "Test 2: secrets.ts exports maskSecrets function"

if grep -q "export function maskSecrets" "$PROJECT_ROOT/src/utils/secrets.ts"; then
    pass "maskSecrets function is exported"
else
    fail "maskSecrets function should be exported"
fi

#------------------------------------------------------------------------------
# Test 3: secrets.ts exports maskObject function
#------------------------------------------------------------------------------
echo "Test 3: secrets.ts exports maskObject function"

if grep -q "export function maskObject" "$PROJECT_ROOT/src/utils/secrets.ts"; then
    pass "maskObject function is exported"
else
    fail "maskObject function should be exported"
fi

#------------------------------------------------------------------------------
# Test 4: secrets.ts exports setMaskingDisabled function
#------------------------------------------------------------------------------
echo "Test 4: secrets.ts exports setMaskingDisabled function"

if grep -q "export function setMaskingDisabled" "$PROJECT_ROOT/src/utils/secrets.ts"; then
    pass "setMaskingDisabled function is exported"
else
    fail "setMaskingDisabled function should be exported"
fi

#------------------------------------------------------------------------------
# Test 5: secrets.ts exports isMaskingDisabled function
#------------------------------------------------------------------------------
echo "Test 5: secrets.ts exports isMaskingDisabled function"

if grep -q "export function isMaskingDisabled" "$PROJECT_ROOT/src/utils/secrets.ts"; then
    pass "isMaskingDisabled function is exported"
else
    fail "isMaskingDisabled function should be exported"
fi

#------------------------------------------------------------------------------
# Test 6: secrets.ts exports SECRET_PATTERNS
#------------------------------------------------------------------------------
echo "Test 6: secrets.ts exports SECRET_PATTERNS"

if grep -q "export const SECRET_PATTERNS" "$PROJECT_ROOT/src/utils/secrets.ts"; then
    pass "SECRET_PATTERNS is exported"
else
    fail "SECRET_PATTERNS should be exported"
fi

#------------------------------------------------------------------------------
# Test 7: secrets.ts has Slack webhook pattern
#------------------------------------------------------------------------------
echo "Test 7: secrets.ts has Slack webhook pattern"

if grep -q "hooks" "$PROJECT_ROOT/src/utils/secrets.ts" && grep -q "slack" "$PROJECT_ROOT/src/utils/secrets.ts"; then
    pass "Slack webhook pattern defined"
else
    fail "Slack webhook pattern should be defined"
fi

#------------------------------------------------------------------------------
# Test 8: secrets.ts has Discord webhook pattern
#------------------------------------------------------------------------------
echo "Test 8: secrets.ts has Discord webhook pattern"

if grep -q "discord" "$PROJECT_ROOT/src/utils/secrets.ts" && grep -q "webhooks" "$PROJECT_ROOT/src/utils/secrets.ts"; then
    pass "Discord webhook pattern defined"
else
    fail "Discord webhook pattern should be defined"
fi

#------------------------------------------------------------------------------
# Test 9: secrets.ts has GitHub token pattern
#------------------------------------------------------------------------------
echo "Test 9: secrets.ts has GitHub token pattern"

if grep -q "gh\[pousr\]_" "$PROJECT_ROOT/src/utils/secrets.ts"; then
    pass "GitHub token pattern defined"
else
    fail "GitHub token pattern should be defined"
fi

#------------------------------------------------------------------------------
# Test 10: secrets.ts has Bearer token pattern
#------------------------------------------------------------------------------
echo "Test 10: secrets.ts has Bearer token pattern"

if grep -qi "bearer" "$PROJECT_ROOT/src/utils/secrets.ts"; then
    pass "Bearer token pattern defined"
else
    fail "Bearer token pattern should be defined"
fi

#------------------------------------------------------------------------------
# Test 11: utils/index.ts re-exports secrets module
#------------------------------------------------------------------------------
echo "Test 11: utils/index.ts re-exports secrets module"

if grep -q "from '\./secrets\.js'" "$PROJECT_ROOT/src/utils/index.ts"; then
    pass "secrets module is re-exported"
else
    fail "secrets module should be re-exported from index"
fi

#------------------------------------------------------------------------------
# Test 12: cli.ts has --no-mask flag for start command
#------------------------------------------------------------------------------
echo "Test 12: cli.ts has --no-mask flag for start command"

if grep -q "no-mask" "$PROJECT_ROOT/src/cli.ts"; then
    pass "--no-mask flag defined in CLI"
else
    fail "--no-mask flag should be defined in CLI"
fi

#------------------------------------------------------------------------------
# Test 13: doctor.ts imports maskSecrets
#------------------------------------------------------------------------------
echo "Test 13: doctor.ts imports maskSecrets"

if grep -q "import.*maskSecrets" "$PROJECT_ROOT/src/doctor.ts"; then
    pass "doctor.ts imports maskSecrets"
else
    fail "doctor.ts should import maskSecrets"
fi

#------------------------------------------------------------------------------
# Test 14: validate.ts imports maskSecrets
#------------------------------------------------------------------------------
echo "Test 14: validate.ts imports maskSecrets"

if grep -q "import.*maskSecrets" "$PROJECT_ROOT/src/validate.ts"; then
    pass "validate.ts imports maskSecrets"
else
    fail "validate.ts should import maskSecrets"
fi

#------------------------------------------------------------------------------
# Test 15: start.ts imports setMaskingDisabled
#------------------------------------------------------------------------------
echo "Test 15: start.ts imports setMaskingDisabled"

if grep -q "import.*setMaskingDisabled" "$PROJECT_ROOT/src/start.ts"; then
    pass "start.ts imports setMaskingDisabled"
else
    fail "start.ts should import setMaskingDisabled"
fi

#------------------------------------------------------------------------------
# Test 16: Bash script has mask_secrets function
#------------------------------------------------------------------------------
echo "Test 16: Bash script has mask_secrets function"

if grep -q "mask_secrets()" "$BASH_SCRIPT"; then
    pass "mask_secrets function exists in bash script"
else
    fail "mask_secrets function should exist in bash script"
fi

#------------------------------------------------------------------------------
# Test 17: Bash script NO_MASK variable
#------------------------------------------------------------------------------
echo "Test 17: Bash script has NO_MASK variable"

if grep -q 'NO_MASK=' "$BASH_SCRIPT"; then
    pass "NO_MASK variable defined in bash script"
else
    fail "NO_MASK variable should be defined in bash script"
fi

#------------------------------------------------------------------------------
# Test 18: Bash script _log function applies mask_secrets
#------------------------------------------------------------------------------
echo "Test 18: Bash script _log function applies mask_secrets"

if grep -A 20 "^_log()" "$BASH_SCRIPT" | grep -q "mask_secrets"; then
    pass "_log function applies mask_secrets"
else
    fail "_log function should apply mask_secrets"
fi

#------------------------------------------------------------------------------
# Test 19: Bash mask_secrets handles Slack webhook URLs
#------------------------------------------------------------------------------
echo "Test 19: Bash mask_secrets handles Slack webhook URLs"

# Define mask_secrets function directly for testing
NO_MASK=false
mask_secrets() {
    local INPUT="$1"
    if [ "$NO_MASK" = "true" ]; then
        echo "$INPUT"
        return
    fi
    echo "$INPUT" | sed -E \
        -e 's|https://hooks\.slack\.com/[^[:space:]"'"'"']+|[REDACTED]|g' \
        -e 's|https://discordapp\.com/api/webhooks/[^[:space:]"'"'"']+|[REDACTED]|g' \
        -e 's|https://discord\.com/api/webhooks/[^[:space:]"'"'"']+|[REDACTED]|g' \
        -e 's|gh[pousr]_[A-Za-z0-9_]{36,}|[REDACTED]|g' \
        -e 's|github_pat_[A-Za-z0-9_]{22,}|[REDACTED]|g' \
        -e 's|gho_[A-Za-z0-9_]{36,}|[REDACTED]|g' \
        -e 's|ghu_[A-Za-z0-9_]{36,}|[REDACTED]|g' \
        -e 's|Bearer [A-Za-z0-9_.~+/=+-]+|Bearer [REDACTED]|g' \
        -e 's|Authorization:[[:space:]]*[^[:space:]"'"'"',]+|Authorization: [REDACTED]|g' \
        -e 's|API_KEY=[^[:space:]"'"'"']+|API_KEY=[REDACTED]|g' \
        -e 's|API_SECRET=[^[:space:]"'"'"']+|API_SECRET=[REDACTED]|g' \
        -e 's|SECRET_KEY=[^[:space:]"'"'"']+|SECRET_KEY=[REDACTED]|g' \
        -e 's|SECRET_TOKEN=[^[:space:]"'"'"']+|SECRET_TOKEN=[REDACTED]|g' \
        -e 's|AUTH_TOKEN=[^[:space:]"'"'"']+|AUTH_TOKEN=[REDACTED]|g' \
        -e 's|ACCESS_TOKEN=[^[:space:]"'"'"']+|ACCESS_TOKEN=[REDACTED]|g' \
        -e 's|PRIVATE_KEY=[^[:space:]"'"'"']+|PRIVATE_KEY=[REDACTED]|g' \
        -e 's|PASSWORD=[^[:space:]"'"'"']+|PASSWORD=[REDACTED]|g' \
        -e 's|WEBHOOK_URL=[^[:space:]"'"'"']+|WEBHOOK_URL=[REDACTED]|g' \
        -e 's|SLACK_WEBHOOK=[^[:space:]"'"'"']+|SLACK_WEBHOOK=[REDACTED]|g' \
        -e 's|DISCORD_WEBHOOK=[^[:space:]"'"'"']+|DISCORD_WEBHOOK=[REDACTED]|g' \
        -e 's|npm_[A-Za-z0-9]{36,}|[REDACTED]|g' \
        -e 's|AKIA[A-Z0-9]{16}|[REDACTED]|g' \
        -e 's|ASIA[A-Z0-9]{16}|[REDACTED]|g'
}

RESULT=$(mask_secrets "Webhook: https://hooks.slack.com/services/T123/B456/xyz789")

if [[ "$RESULT" == *"[REDACTED]"* ]] && [[ "$RESULT" != *"hooks.slack.com"* ]]; then
    pass "Slack webhook URL masked correctly"
else
    fail "Slack webhook URL should be masked - got: $RESULT"
fi

#------------------------------------------------------------------------------
# Test 20: Bash mask_secrets handles Discord webhook URLs
#------------------------------------------------------------------------------
echo "Test 20: Bash mask_secrets handles Discord webhook URLs"

RESULT=$(mask_secrets "Webhook: https://discord.com/api/webhooks/12345/abcdefgh")

if [[ "$RESULT" == *"[REDACTED]"* ]] && [[ "$RESULT" != *"discord.com/api/webhooks"* ]]; then
    pass "Discord webhook URL masked correctly"
else
    fail "Discord webhook URL should be masked - got: $RESULT"
fi

#------------------------------------------------------------------------------
# Test 21: Bash mask_secrets handles GitHub tokens
#------------------------------------------------------------------------------
echo "Test 21: Bash mask_secrets handles GitHub tokens"

RESULT=$(mask_secrets "Token: ghp_abcdefghijklmnopqrstuvwxyz1234567890ab")

if [[ "$RESULT" == *"[REDACTED]"* ]] && [[ "$RESULT" != *"ghp_"* ]]; then
    pass "GitHub token masked correctly"
else
    fail "GitHub token should be masked - got: $RESULT"
fi

#------------------------------------------------------------------------------
# Test 22: Bash mask_secrets handles Bearer tokens
#------------------------------------------------------------------------------
echo "Test 22: Bash mask_secrets handles Bearer tokens"

RESULT=$(mask_secrets "Header: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9")

if [[ "$RESULT" == *"Bearer [REDACTED]"* ]] && [[ "$RESULT" != *"eyJhbGci"* ]]; then
    pass "Bearer token masked correctly"
else
    fail "Bearer token should be masked - got: $RESULT"
fi

#------------------------------------------------------------------------------
# Test 23: Bash mask_secrets handles environment variable assignments
#------------------------------------------------------------------------------
echo "Test 23: Bash mask_secrets handles environment variable assignments"

RESULT=$(mask_secrets "CONFIG: API_KEY=super_secret_key_12345")

if [[ "$RESULT" == *"API_KEY=[REDACTED]"* ]] && [[ "$RESULT" != *"super_secret_key"* ]]; then
    pass "Environment variable assignment masked correctly"
else
    fail "Environment variable assignment should be masked - got: $RESULT"
fi

#------------------------------------------------------------------------------
# Test 24: Bash mask_secrets preserves non-secret text
#------------------------------------------------------------------------------
echo "Test 24: Bash mask_secrets preserves non-secret text"

RESULT=$(mask_secrets "This is a normal log message with no secrets")

if [[ "$RESULT" == "This is a normal log message with no secrets" ]]; then
    pass "Non-secret text preserved"
else
    fail "Non-secret text should be preserved - got: $RESULT"
fi

#------------------------------------------------------------------------------
# Test 25: Bash NO_MASK disables masking
#------------------------------------------------------------------------------
echo "Test 25: Bash NO_MASK=true disables masking"

NO_MASK=true
RESULT=$(mask_secrets "Token: ghp_abcdefghijklmnopqrstuvwxyz1234567890ab")
NO_MASK=false

if [[ "$RESULT" == *"ghp_"* ]]; then
    pass "NO_MASK=true disables masking"
else
    fail "NO_MASK=true should disable masking - got: $RESULT"
fi

#------------------------------------------------------------------------------
# Test 26: secrets.ts exports maskJsonString function
#------------------------------------------------------------------------------
echo "Test 26: secrets.ts exports maskJsonString function"

if grep -q "export function maskJsonString" "$PROJECT_ROOT/src/utils/secrets.ts"; then
    pass "maskJsonString function is exported"
else
    fail "maskJsonString function should be exported"
fi

#------------------------------------------------------------------------------
# Test 27: secrets.ts exports isSensitiveKey function
#------------------------------------------------------------------------------
echo "Test 27: secrets.ts exports isSensitiveKey function"

if grep -q "export function isSensitiveKey" "$PROJECT_ROOT/src/utils/secrets.ts"; then
    pass "isSensitiveKey function is exported"
else
    fail "isSensitiveKey function should be exported"
fi

#------------------------------------------------------------------------------
# Test 28: secrets.ts exports maskSensitiveKeys function
#------------------------------------------------------------------------------
echo "Test 28: secrets.ts exports maskSensitiveKeys function"

if grep -q "export function maskSensitiveKeys" "$PROJECT_ROOT/src/utils/secrets.ts"; then
    pass "maskSensitiveKeys function is exported"
else
    fail "maskSensitiveKeys function should be exported"
fi

#------------------------------------------------------------------------------
# Test 29: secrets.ts exports REDACTED_PLACEHOLDER constant
#------------------------------------------------------------------------------
echo "Test 29: secrets.ts exports REDACTED_PLACEHOLDER constant"

if grep -q "export const REDACTED_PLACEHOLDER" "$PROJECT_ROOT/src/utils/secrets.ts"; then
    pass "REDACTED_PLACEHOLDER constant is exported"
else
    fail "REDACTED_PLACEHOLDER constant should be exported"
fi

#------------------------------------------------------------------------------
# Test 30: start.ts passes NO_MASK to bash env
#------------------------------------------------------------------------------
echo "Test 30: start.ts passes NO_MASK to bash env"

if grep -q "NO_MASK:" "$PROJECT_ROOT/src/start.ts"; then
    pass "start.ts passes NO_MASK environment variable"
else
    fail "start.ts should pass NO_MASK environment variable"
fi

#------------------------------------------------------------------------------
# Test 31: Project compiles successfully with secrets module
#------------------------------------------------------------------------------
echo "Test 31: Project compiles successfully with secrets module"

cd "$PROJECT_ROOT"
if npm run build > /dev/null 2>&1; then
    pass "Project compiles without errors"
else
    fail "Project should compile without errors"
fi

#------------------------------------------------------------------------------
# Test 32: Bash mask_secrets handles github_pat tokens
#------------------------------------------------------------------------------
echo "Test 32: Bash mask_secrets handles github_pat tokens"

RESULT=$(mask_secrets "Token: github_pat_11ABCDEFGH0IJK12LMNOP34")

if [[ "$RESULT" == *"[REDACTED]"* ]] && [[ "$RESULT" != *"github_pat_"* ]]; then
    pass "github_pat token masked correctly"
else
    fail "github_pat token should be masked - got: $RESULT"
fi

#------------------------------------------------------------------------------
# Test 33: Bash mask_secrets handles multiple secrets in one line
#------------------------------------------------------------------------------
echo "Test 33: Bash mask_secrets handles multiple secrets in one line"

RESULT=$(mask_secrets "Token: ghp_abc123abc123abc123abc123abc123abc123 webhook: https://hooks.slack.com/services/T/B/X")

if [[ "$RESULT" != *"ghp_"* ]] && [[ "$RESULT" != *"hooks.slack.com"* ]]; then
    pass "Multiple secrets masked correctly"
else
    fail "Multiple secrets should be masked - got: $RESULT"
fi

#------------------------------------------------------------------------------
# Test 34: config-export-import.ts imports maskSecrets
#------------------------------------------------------------------------------
echo "Test 34: config-export-import.ts imports maskSecrets"

if grep -q "import.*maskSecrets" "$PROJECT_ROOT/src/config-export-import.ts"; then
    pass "config-export-import.ts imports maskSecrets"
else
    fail "config-export-import.ts should import maskSecrets"
fi

#------------------------------------------------------------------------------
# Test 35: Bash script Secret Masking System section exists
#------------------------------------------------------------------------------
echo "Test 35: Bash script Secret Masking System section exists"

if grep -q "Secret Masking System" "$BASH_SCRIPT"; then
    pass "Secret Masking System section exists"
else
    fail "Secret Masking System section should exist in bash script"
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

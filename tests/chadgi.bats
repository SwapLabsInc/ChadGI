#!/usr/bin/env bats
#
# Bats unit tests for chadgi.sh bash functions
#
# Run with: npm run test:bash
# Or: npx bats tests/chadgi.bats
#

# Get the project root directory
PROJECT_ROOT="$(cd "${BATS_TEST_DIRNAME}/.." && pwd)"
CHADGI_SCRIPT="${PROJECT_ROOT}/scripts/chadgi.sh"

# Source the script in test mode (functions only, no main execution)
setup() {
    # Set source-only mode to load functions without executing main script
    export CHADGI_SOURCE_ONLY=true
    # Disable strict mode temporarily for sourcing
    set +e
    source "${CHADGI_SCRIPT}"
    set -e
}

#------------------------------------------------------------------------------
# mask_secrets tests
#------------------------------------------------------------------------------

@test "mask_secrets: redacts Slack webhook URLs" {
    NO_MASK=false
    result=$(mask_secrets "webhook: https://hooks.slack.com/services/T00/B00/xxxx")
    [[ "$result" == "webhook: [REDACTED]" ]]
}

@test "mask_secrets: redacts Discord webhook URLs (discord.com)" {
    NO_MASK=false
    result=$(mask_secrets "webhook: https://discord.com/api/webhooks/123456789/abcdefghijk")
    [[ "$result" == "webhook: [REDACTED]" ]]
}

@test "mask_secrets: redacts Discord webhook URLs (discordapp.com)" {
    NO_MASK=false
    result=$(mask_secrets "webhook: https://discordapp.com/api/webhooks/123456789/abcdefghijk")
    [[ "$result" == "webhook: [REDACTED]" ]]
}

@test "mask_secrets: redacts GitHub PATs (ghp_)" {
    NO_MASK=false
    result=$(mask_secrets "token: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")
    [[ "$result" == "token: [REDACTED]" ]]
}

@test "mask_secrets: redacts GitHub PATs (github_pat_)" {
    NO_MASK=false
    result=$(mask_secrets "token: github_pat_11ABCDEFGH0IJK12LMNOP34QRST")
    [[ "$result" == "token: [REDACTED]" ]]
}

@test "mask_secrets: redacts GitHub OAuth tokens (gho_)" {
    NO_MASK=false
    result=$(mask_secrets "token: gho_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")
    [[ "$result" == "token: [REDACTED]" ]]
}

@test "mask_secrets: redacts Bearer tokens" {
    NO_MASK=false
    result=$(mask_secrets "header: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9")
    [[ "$result" == "header: Bearer [REDACTED]" ]]
}

@test "mask_secrets: redacts API_KEY environment variables" {
    NO_MASK=false
    result=$(mask_secrets "CONFIG: API_KEY=super_secret_key_12345")
    [[ "$result" == "CONFIG: API_KEY=[REDACTED]" ]]
}

@test "mask_secrets: redacts PASSWORD environment variables" {
    NO_MASK=false
    result=$(mask_secrets "CONFIG: PASSWORD=my_secret_password")
    [[ "$result" == "CONFIG: PASSWORD=[REDACTED]" ]]
}

@test "mask_secrets: redacts AWS Access Key IDs (AKIA)" {
    NO_MASK=false
    result=$(mask_secrets "aws: AKIAIOSFODNN7EXAMPLE")
    [[ "$result" == "aws: [REDACTED]" ]]
}

@test "mask_secrets: redacts npm tokens" {
    NO_MASK=false
    result=$(mask_secrets "token: npm_1234567890abcdefghijklmnopqrstuvwxyz")
    [[ "$result" == "token: [REDACTED]" ]]
}

@test "mask_secrets: preserves non-secret text" {
    NO_MASK=false
    result=$(mask_secrets "This is a normal log message with no secrets")
    [[ "$result" == "This is a normal log message with no secrets" ]]
}

@test "mask_secrets: handles multiple secrets in one line" {
    NO_MASK=false
    result=$(mask_secrets "Token: ghp_abc123abc123abc123abc123abc123abc123 webhook: https://hooks.slack.com/services/T/B/X")
    [[ "$result" != *"ghp_"* ]] && [[ "$result" != *"hooks.slack.com"* ]]
}

@test "mask_secrets: NO_MASK=true disables masking" {
    NO_MASK=true
    result=$(mask_secrets "token: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")
    [[ "$result" == *"ghp_"* ]]
    NO_MASK=false
}

#------------------------------------------------------------------------------
# parse_log_level tests
#------------------------------------------------------------------------------

@test "parse_log_level: returns 3 for DEBUG" {
    result=$(parse_log_level "DEBUG")
    [[ "$result" == "3" ]]
}

@test "parse_log_level: returns 2 for INFO" {
    result=$(parse_log_level "INFO")
    [[ "$result" == "2" ]]
}

@test "parse_log_level: returns 1 for WARN" {
    result=$(parse_log_level "WARN")
    [[ "$result" == "1" ]]
}

@test "parse_log_level: returns 1 for WARNING" {
    result=$(parse_log_level "WARNING")
    [[ "$result" == "1" ]]
}

@test "parse_log_level: returns 0 for ERROR" {
    result=$(parse_log_level "ERROR")
    [[ "$result" == "0" ]]
}

@test "parse_log_level: handles lowercase input" {
    result=$(parse_log_level "debug")
    [[ "$result" == "3" ]]
}

@test "parse_log_level: handles mixed case input" {
    result=$(parse_log_level "Debug")
    [[ "$result" == "3" ]]
}

@test "parse_log_level: returns INFO (2) for unknown level" {
    result=$(parse_log_level "UNKNOWN")
    [[ "$result" == "2" ]]
}

@test "parse_log_level: returns INFO (2) for empty input" {
    result=$(parse_log_level "")
    [[ "$result" == "2" ]]
}

#------------------------------------------------------------------------------
# strip_colors tests
#------------------------------------------------------------------------------

@test "strip_colors: removes red ANSI escape sequence" {
    result=$(strip_colors $'\033[0;31mred text\033[0m')
    [[ "$result" == "red text" ]]
}

@test "strip_colors: removes green ANSI escape sequence" {
    result=$(strip_colors $'\033[0;32mgreen text\033[0m')
    [[ "$result" == "green text" ]]
}

@test "strip_colors: removes bold ANSI escape sequence" {
    result=$(strip_colors $'\033[1mbold text\033[0m')
    [[ "$result" == "bold text" ]]
}

@test "strip_colors: removes multiple ANSI escape sequences" {
    result=$(strip_colors $'\033[0;31mred\033[0m and \033[0;32mgreen\033[0m')
    [[ "$result" == "red and green" ]]
}

@test "strip_colors: preserves text without ANSI codes" {
    result=$(strip_colors "plain text without colors")
    [[ "$result" == "plain text without colors" ]]
}

@test "strip_colors: handles complex color codes" {
    result=$(strip_colors $'\033[1;33;40mcomplex\033[0m')
    [[ "$result" == "complex" ]]
}

#------------------------------------------------------------------------------
# format_duration tests
#------------------------------------------------------------------------------

@test "format_duration: formats seconds only (< 60s)" {
    result=$(format_duration 45)
    [[ "$result" == "45s" ]]
}

@test "format_duration: formats 0 seconds" {
    result=$(format_duration 0)
    [[ "$result" == "0s" ]]
}

@test "format_duration: formats minutes and seconds" {
    result=$(format_duration 125)
    [[ "$result" == "2m 5s" ]]
}

@test "format_duration: formats exact minutes (no remaining seconds)" {
    result=$(format_duration 120)
    [[ "$result" == "2m 0s" ]]
}

@test "format_duration: formats hours, minutes, and seconds" {
    result=$(format_duration 3665)
    [[ "$result" == "1h 1m 5s" ]]
}

@test "format_duration: formats exact hours" {
    result=$(format_duration 7200)
    [[ "$result" == "2h 0m 0s" ]]
}

@test "format_duration: formats large durations (multiple hours)" {
    result=$(format_duration 36610)
    [[ "$result" == "10h 10m 10s" ]]
}

#------------------------------------------------------------------------------
# parse_yaml_value tests
#------------------------------------------------------------------------------

@test "parse_yaml_value: extracts simple key-value pair" {
    # Create temp file with YAML content
    TMPFILE=$(mktemp)
    echo "test_key: test_value" > "$TMPFILE"
    result=$(parse_yaml_value "test_key" "$TMPFILE")
    rm -f "$TMPFILE"
    [[ "$result" == "test_value" ]]
}

@test "parse_yaml_value: extracts value with spaces" {
    TMPFILE=$(mktemp)
    echo "message: Hello World" > "$TMPFILE"
    result=$(parse_yaml_value "message" "$TMPFILE")
    rm -f "$TMPFILE"
    [[ "$result" == "Hello World" ]]
}

@test "parse_yaml_value: removes inline comments" {
    TMPFILE=$(mktemp)
    echo "test_key: test_value # this is a comment" > "$TMPFILE"
    result=$(parse_yaml_value "test_key" "$TMPFILE")
    rm -f "$TMPFILE"
    [[ "$result" == "test_value" ]]
}

@test "parse_yaml_value: removes quotes from values" {
    TMPFILE=$(mktemp)
    echo 'test_key: "quoted_value"' > "$TMPFILE"
    result=$(parse_yaml_value "test_key" "$TMPFILE")
    rm -f "$TMPFILE"
    [[ "$result" == "quoted_value" ]]
}

@test "parse_yaml_value: returns empty for non-existent key" {
    TMPFILE=$(mktemp)
    echo "other_key: some_value" > "$TMPFILE"
    result=$(parse_yaml_value "missing_key" "$TMPFILE")
    rm -f "$TMPFILE"
    [[ -z "$result" ]]
}

@test "parse_yaml_value: extracts numeric value" {
    TMPFILE=$(mktemp)
    echo "port: 8080" > "$TMPFILE"
    result=$(parse_yaml_value "port" "$TMPFILE")
    rm -f "$TMPFILE"
    [[ "$result" == "8080" ]]
}

@test "parse_yaml_value: handles boolean true" {
    TMPFILE=$(mktemp)
    echo "enabled: true" > "$TMPFILE"
    result=$(parse_yaml_value "enabled" "$TMPFILE")
    rm -f "$TMPFILE"
    [[ "$result" == "true" ]]
}

@test "parse_yaml_value: handles boolean false" {
    TMPFILE=$(mktemp)
    echo "disabled: false" > "$TMPFILE"
    result=$(parse_yaml_value "disabled" "$TMPFILE")
    rm -f "$TMPFILE"
    [[ "$result" == "false" ]]
}

#------------------------------------------------------------------------------
# calculate_budget_percentage tests
#------------------------------------------------------------------------------

@test "calculate_budget_percentage: calculates 50% correctly" {
    result=$(calculate_budget_percentage 1.0 2.0)
    [[ "$result" == "50" ]]
}

@test "calculate_budget_percentage: calculates 100% correctly" {
    result=$(calculate_budget_percentage 2.0 2.0)
    [[ "$result" == "100" ]]
}

@test "calculate_budget_percentage: calculates 0% for zero cost" {
    result=$(calculate_budget_percentage 0 2.0)
    [[ "$result" == "0" ]]
}

@test "calculate_budget_percentage: returns 0 for zero limit" {
    result=$(calculate_budget_percentage 1.0 0)
    [[ "$result" == "0" ]]
}

@test "calculate_budget_percentage: returns 0 for empty limit" {
    result=$(calculate_budget_percentage 1.0 "")
    [[ "$result" == "0" ]]
}

@test "calculate_budget_percentage: handles over 100%" {
    result=$(calculate_budget_percentage 3.0 2.0)
    [[ "$result" == "150" ]]
}

@test "calculate_budget_percentage: handles decimal values" {
    result=$(calculate_budget_percentage 0.5 2.0)
    [[ "$result" == "25" ]]
}

#------------------------------------------------------------------------------
# check_task_budget_exceeded tests
#------------------------------------------------------------------------------

@test "check_task_budget_exceeded: returns 0 (exceeded) when cost >= limit" {
    BUDGET_PER_TASK_LIMIT=2.0
    run check_task_budget_exceeded 2.0
    [[ "$status" -eq 0 ]]
}

@test "check_task_budget_exceeded: returns 0 (exceeded) when cost > limit" {
    BUDGET_PER_TASK_LIMIT=2.0
    run check_task_budget_exceeded 3.0
    [[ "$status" -eq 0 ]]
}

@test "check_task_budget_exceeded: returns 1 (not exceeded) when cost < limit" {
    BUDGET_PER_TASK_LIMIT=2.0
    run check_task_budget_exceeded 1.5
    [[ "$status" -eq 1 ]]
}

@test "check_task_budget_exceeded: returns 1 when budget limit is empty" {
    BUDGET_PER_TASK_LIMIT=""
    run check_task_budget_exceeded 10.0
    [[ "$status" -eq 1 ]]
}

#------------------------------------------------------------------------------
# check_session_budget_exceeded tests
#------------------------------------------------------------------------------

@test "check_session_budget_exceeded: returns 0 (exceeded) when cost >= limit" {
    BUDGET_PER_SESSION_LIMIT=20.0
    run check_session_budget_exceeded 20.0
    [[ "$status" -eq 0 ]]
}

@test "check_session_budget_exceeded: returns 0 (exceeded) when cost > limit" {
    BUDGET_PER_SESSION_LIMIT=20.0
    run check_session_budget_exceeded 25.0
    [[ "$status" -eq 0 ]]
}

@test "check_session_budget_exceeded: returns 1 (not exceeded) when cost < limit" {
    BUDGET_PER_SESSION_LIMIT=20.0
    run check_session_budget_exceeded 15.0
    [[ "$status" -eq 1 ]]
}

@test "check_session_budget_exceeded: returns 1 when budget limit is empty" {
    BUDGET_PER_SESSION_LIMIT=""
    run check_session_budget_exceeded 100.0
    [[ "$status" -eq 1 ]]
}

#------------------------------------------------------------------------------
# get_log_level_name tests
#------------------------------------------------------------------------------

@test "get_log_level_name: returns DEBUG for level 3" {
    result=$(get_log_level_name 3)
    [[ "$result" == "DEBUG" ]]
}

@test "get_log_level_name: returns INFO for level 2" {
    result=$(get_log_level_name 2)
    [[ "$result" == "INFO" ]]
}

@test "get_log_level_name: returns WARN for level 1" {
    result=$(get_log_level_name 1)
    [[ "$result" == "WARN" ]]
}

@test "get_log_level_name: returns ERROR for level 0" {
    result=$(get_log_level_name 0)
    [[ "$result" == "ERROR" ]]
}

@test "get_log_level_name: returns INFO for unknown level" {
    result=$(get_log_level_name 99)
    [[ "$result" == "INFO" ]]
}

#------------------------------------------------------------------------------
# is_budget_enabled tests
#------------------------------------------------------------------------------

@test "is_budget_enabled: returns 0 when task limit is set" {
    BUDGET_PER_TASK_LIMIT=2.0
    BUDGET_PER_SESSION_LIMIT=""
    run is_budget_enabled
    [[ "$status" -eq 0 ]]
}

@test "is_budget_enabled: returns 0 when session limit is set" {
    BUDGET_PER_TASK_LIMIT=""
    BUDGET_PER_SESSION_LIMIT=20.0
    run is_budget_enabled
    [[ "$status" -eq 0 ]]
}

@test "is_budget_enabled: returns 0 when both limits are set" {
    BUDGET_PER_TASK_LIMIT=2.0
    BUDGET_PER_SESSION_LIMIT=20.0
    run is_budget_enabled
    [[ "$status" -eq 0 ]]
}

@test "is_budget_enabled: returns 1 when no limits are set" {
    BUDGET_PER_TASK_LIMIT=""
    BUDGET_PER_SESSION_LIMIT=""
    run is_budget_enabled
    [[ "$status" -eq 1 ]]
}

#------------------------------------------------------------------------------
# is_masking_disabled tests
#------------------------------------------------------------------------------

@test "is_masking_disabled: returns 0 when NO_MASK is true" {
    NO_MASK=true
    run is_masking_disabled
    [[ "$status" -eq 0 ]]
}

@test "is_masking_disabled: returns 1 when NO_MASK is false" {
    NO_MASK=false
    run is_masking_disabled
    [[ "$status" -eq 1 ]]
}

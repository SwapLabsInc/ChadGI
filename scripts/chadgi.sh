#!/bin/bash
#
# ChadGI Loop - Autonomous Task Worker
#
# A configurable automation script that runs Claude Code in a loop to
# automatically work through tasks from a GitHub Project board.
#
# Features:
# - Rich streaming output showing tool calls with details
# - Configurable via chadgi-config.yaml
# - Task templates with variable substitution
# - Progress tracking with resume capability
# - Project board-based workflow (no labels needed)
#
# Press Ctrl+C at any time to stop the loop gracefully.
#

set -e

# CHADGI_DIR should be set by the CLI to point to the user's chadgi/ directory
# If not set, fall back to current directory
CHADGI_DIR="${CHADGI_DIR:-.}"

# Script directory (for the bash script itself)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Default configuration file - looks in CHADGI_DIR
CONFIG_FILE="${CONFIG_FILE:-$CHADGI_DIR/chadgi-config.yaml}"

# Dry-run mode - passed from CLI via environment variable
DRY_RUN="${DRY_RUN:-false}"

# Debug mode - passed from CLI via environment variable (overrides config log_level)
DEBUG_MODE="${DEBUG_MODE:-false}"

# Ignore dependencies - passed from CLI via environment variable
IGNORE_DEPS="${IGNORE_DEPS:-false}"

# Force claim - passed from CLI via environment variable
# When enabled, overrides stale task locks when claiming tasks
FORCE_CLAIM="${FORCE_CLAIM:-false}"

# Interactive mode - passed from CLI via environment variable
# When enabled, requires human approval at checkpoints before proceeding
INTERACTIVE_MODE="${INTERACTIVE_MODE:-false}"

# Task timeout override - passed from CLI via environment variable (in minutes)
# Empty means use config value, otherwise override
CLI_TASK_TIMEOUT="${TASK_TIMEOUT:-}"

# Template paths - also from CHADGI_DIR
TASK_TEMPLATE="$CHADGI_DIR/chadgi-task.md"
GENERATE_TASK_TEMPLATE="$CHADGI_DIR/chadgi-generate-task.md"

# Colors for visibility
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m' # No Color

#------------------------------------------------------------------------------
# Secret Masking System
#------------------------------------------------------------------------------

# Global flag to disable secret masking (set via --no-mask CLI flag)
NO_MASK="${NO_MASK:-false}"

# Mask secrets in the input string
# Replaces sensitive patterns like webhook URLs, API tokens, etc. with [REDACTED]
# Usage: mask_secrets "string with secrets"
# Returns: masked string
mask_secrets() {
    local INPUT="$1"

    # If masking is disabled, return input unchanged
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

# Check if secret masking is disabled
is_masking_disabled() {
    [ "$NO_MASK" = "true" ]
}

# Print a warning if masking is disabled
warn_if_masking_disabled() {
    if is_masking_disabled; then
        echo -e "${YELLOW}WARNING: Secret masking is DISABLED. Sensitive data may be exposed.${NC}"
    fi
}

#------------------------------------------------------------------------------
# Structured Logging System
#------------------------------------------------------------------------------

# Log level constants (higher = more verbose)
LOG_LEVEL_ERROR=0
LOG_LEVEL_WARN=1
LOG_LEVEL_INFO=2
LOG_LEVEL_DEBUG=3

# Current log level (default: INFO, can be overridden by config or --debug flag)
CURRENT_LOG_LEVEL=$LOG_LEVEL_INFO

# Log file settings (will be set from config)
LOG_FILE=""
LOG_FILE_MAX_SIZE_MB=10
LOG_FILE_MAX_COUNT=5
LOG_FILE_INITIALIZED=false

# Convert log level string to numeric value
parse_log_level() {
    local LEVEL="${1:-INFO}"
    case "$(echo "$LEVEL" | tr '[:lower:]' '[:upper:]')" in
        "DEBUG") echo $LOG_LEVEL_DEBUG ;;
        "INFO")  echo $LOG_LEVEL_INFO ;;
        "WARN"|"WARNING") echo $LOG_LEVEL_WARN ;;
        "ERROR") echo $LOG_LEVEL_ERROR ;;
        *)       echo $LOG_LEVEL_INFO ;;
    esac
}

# Get log level name from numeric value
get_log_level_name() {
    local LEVEL=$1
    case $LEVEL in
        $LOG_LEVEL_DEBUG) echo "DEBUG" ;;
        $LOG_LEVEL_INFO)  echo "INFO" ;;
        $LOG_LEVEL_WARN)  echo "WARN" ;;
        $LOG_LEVEL_ERROR) echo "ERROR" ;;
        *)                echo "INFO" ;;
    esac
}

# Format ISO timestamp for log entries
get_log_timestamp() {
    date -u +"%Y-%m-%dT%H:%M:%SZ"
}

# Strip ANSI color codes from text for log file output
strip_colors() {
    echo -e "$1" | sed 's/\x1b\[[0-9;]*m//g'
}

# Get log file size in bytes
get_log_file_size() {
    if [ -f "$LOG_FILE" ]; then
        stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE" 2>/dev/null || echo "0"
    else
        echo "0"
    fi
}

# Rotate log files when size exceeds limit
# Uses numbered rotation: chadgi.log -> chadgi.log.1 -> chadgi.log.2 etc.
rotate_logs() {
    if [ -z "$LOG_FILE" ] || [ ! -f "$LOG_FILE" ]; then
        return
    fi

    local SIZE_BYTES=$(get_log_file_size)
    local MAX_BYTES=$((LOG_FILE_MAX_SIZE_MB * 1024 * 1024))

    if [ "$SIZE_BYTES" -lt "$MAX_BYTES" ]; then
        return
    fi

    # Perform rotation
    local i=$((LOG_FILE_MAX_COUNT - 1))
    while [ $i -gt 0 ]; do
        local PREV=$((i - 1))
        if [ $PREV -eq 0 ]; then
            [ -f "${LOG_FILE}" ] && mv "${LOG_FILE}" "${LOG_FILE}.1"
        else
            [ -f "${LOG_FILE}.${PREV}" ] && mv "${LOG_FILE}.${PREV}" "${LOG_FILE}.${i}"
        fi
        i=$((i - 1))
    done

    # Remove oldest if exceeds count
    local OLDEST="${LOG_FILE}.${LOG_FILE_MAX_COUNT}"
    [ -f "$OLDEST" ] && rm -f "$OLDEST"
}

# Initialize log file
init_log_file() {
    if [ -z "$LOG_FILE" ] || [ "$LOG_FILE_INITIALIZED" = "true" ]; then
        return
    fi

    # Create parent directory if needed
    local LOG_DIR=$(dirname "$LOG_FILE")
    mkdir -p "$LOG_DIR" 2>/dev/null

    # Check for rotation before starting
    rotate_logs

    # Write session header to log file
    local TIMESTAMP=$(get_log_timestamp)
    {
        echo "============================================================"
        echo "ChadGI Session Started: $TIMESTAMP"
        echo "Log Level: $(get_log_level_name $CURRENT_LOG_LEVEL)"
        echo "============================================================"
    } >> "$LOG_FILE" 2>/dev/null

    LOG_FILE_INITIALIZED=true
}

# Write to log file (plain text without colors)
write_to_log_file() {
    local LEVEL=$1
    local MESSAGE=$2

    if [ -z "$LOG_FILE" ]; then
        return
    fi

    # Check if we should log this level
    if [ $LEVEL -gt $CURRENT_LOG_LEVEL ]; then
        return
    fi

    # Ensure log file is initialized
    if [ "$LOG_FILE_INITIALIZED" != "true" ]; then
        init_log_file
    fi

    # Check for rotation
    rotate_logs

    # Format and write log entry
    local TIMESTAMP=$(get_log_timestamp)
    local LEVEL_NAME=$(get_log_level_name $LEVEL)
    local PLAIN_MESSAGE=$(strip_colors "$MESSAGE")

    printf "[%s] [%-5s] %s\n" "$TIMESTAMP" "$LEVEL_NAME" "$PLAIN_MESSAGE" >> "$LOG_FILE" 2>/dev/null
}

# Core structured logging function
# Usage: _log <level> <color> <prefix> <message>
_log() {
    local LEVEL=$1
    local COLOR=$2
    local PREFIX=$3
    local MESSAGE=$4

    # Apply secret masking to the message
    local MASKED_MESSAGE=$(mask_secrets "$MESSAGE")

    # Check if we should output to terminal
    if [ $LEVEL -le $CURRENT_LOG_LEVEL ]; then
        echo -e "${COLOR}${PREFIX} ${MASKED_MESSAGE}${NC}"
    fi

    # Always write to log file (the write function checks level)
    write_to_log_file $LEVEL "$MASKED_MESSAGE"
}

#------------------------------------------------------------------------------
# Configuration Loading
#------------------------------------------------------------------------------

# Parse YAML value (simple key: value extraction)
parse_yaml_value() {
    local KEY=$1
    local FILE=$2
    grep "^${KEY}:" "$FILE" 2>/dev/null | sed 's/^[^:]*: *//' | sed 's/ *#.*//' | tr -d '"' || echo ""
}

# Parse nested YAML value (parent.child format)
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

# Parse deeply nested YAML value (grandparent.parent.child format - 3 levels)
parse_yaml_nested_deep() {
    local GRANDPARENT=$1
    local PARENT=$2
    local KEY=$3
    local FILE=$4
    awk -v grandparent="$GRANDPARENT" -v parent="$PARENT" -v key="$KEY" '
        $0 ~ "^"grandparent":" { in_grandparent=1; next }
        in_grandparent && /^[a-z]/ { in_grandparent=0; in_parent=0 }
        in_grandparent && $0 ~ "^  "parent":" { in_parent=1; next }
        in_grandparent && in_parent && /^  [a-z]/ { in_parent=0 }
        in_grandparent && in_parent && $0 ~ "^    "key":" {
            gsub(/^    [a-z_]+: */, "");
            gsub(/ *#.*/, "");
            gsub(/"/, "");
            print;
            exit
        }
    ' "$FILE" 2>/dev/null || echo ""
}

# Parse events from notifications config (4 levels deep: notifications.slack.events.task_started)
parse_yaml_nested_events() {
    local GRANDPARENT=$1
    local PARENT=$2
    local KEY=$3
    local FILE=$4
    awk -v grandparent="$GRANDPARENT" -v parent="$PARENT" -v key="$KEY" '
        $0 ~ "^"grandparent":" { in_grandparent=1; next }
        in_grandparent && /^[a-z]/ { in_grandparent=0; in_parent=0; in_events=0 }
        in_grandparent && $0 ~ "^  "parent":" { in_parent=1; next }
        in_grandparent && in_parent && /^  [a-z]/ { in_parent=0; in_events=0 }
        in_grandparent && in_parent && /^    events:/ { in_events=1; next }
        in_grandparent && in_parent && in_events && /^    [a-z]/ { in_events=0 }
        in_grandparent && in_parent && in_events && $0 ~ "^      "key":" {
            gsub(/^      [a-z_]+: */, "");
            gsub(/ *#.*/, "");
            gsub(/"/, "");
            print;
            exit
        }
    ' "$FILE" 2>/dev/null || echo ""
}

# Parse priority labels array from config (priority.labels.critical, etc.)
# Returns space-separated list of labels
parse_priority_labels() {
    local LEVEL=$1
    local FILE=$2
    awk -v level="$LEVEL" '
        /^priority:/ { in_priority=1; next }
        in_priority && /^[a-z]/ { in_priority=0; in_labels=0 }
        in_priority && /^  labels:/ { in_labels=1; next }
        in_priority && in_labels && /^  [a-z]/ { in_labels=0 }
        in_priority && in_labels && $0 ~ "^    "level":" {
            # Extract the array: ["label1", "label2", ...] or [label1, label2]
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

# Parse category mappings array from config (category.mappings.bug, etc.)
# Returns space-separated list of labels
parse_category_mappings() {
    local CATEGORY=$1
    local FILE=$2
    awk -v category="$CATEGORY" '
        /^category:/ { in_category=1; next }
        in_category && /^[a-z]/ { in_category=0; in_mappings=0 }
        in_category && /^  mappings:/ { in_mappings=1; next }
        in_category && in_mappings && /^  [a-z]/ { in_mappings=0 }
        in_category && in_mappings && $0 ~ "^    "category":" {
            # Extract the array: ["label1", "label2", ...] or [label1, label2]
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
# Config Inheritance Support
#------------------------------------------------------------------------------

# Global array to track config chain for cycle detection
declare -a CONFIG_CHAIN=()

# Check if a config file is already in the chain (cycle detection)
config_in_chain() {
    local config_path=$1
    local resolved_path
    resolved_path=$(cd "$(dirname "$config_path")" 2>/dev/null && pwd)/$(basename "$config_path") 2>/dev/null || resolved_path="$config_path"

    for chain_path in "${CONFIG_CHAIN[@]}"; do
        if [ "$chain_path" = "$resolved_path" ]; then
            return 0  # Found in chain (cycle detected)
        fi
    done
    return 1  # Not in chain
}

# Add a config to the chain
add_to_chain() {
    local config_path=$1
    local resolved_path
    resolved_path=$(cd "$(dirname "$config_path")" 2>/dev/null && pwd)/$(basename "$config_path") 2>/dev/null || resolved_path="$config_path"
    CONFIG_CHAIN+=("$resolved_path")
}

# Get the extends/base_config value from a config file
get_extends_path() {
    local config_file=$1
    local extends_value

    # Check for 'extends' field first, then 'base_config'
    extends_value=$(parse_yaml_value "extends" "$config_file")
    if [ -z "$extends_value" ]; then
        extends_value=$(parse_yaml_value "base_config" "$config_file")
    fi

    echo "$extends_value"
}

# Resolve a potentially relative path to an absolute path
# relative paths are resolved from the directory containing the config file
resolve_config_path() {
    local base_dir=$1
    local path=$2

    if [ -z "$path" ]; then
        echo ""
        return
    fi

    if [[ "$path" == /* ]]; then
        # Absolute path
        echo "$path"
    else
        # Relative path - resolve from base_dir
        echo "$base_dir/$path"
    fi
}

# Load all config files in the inheritance chain and return merged values
# This recursively loads base configs first, then overlays child configs
# Returns: sets global MERGED_CONFIG_FILES array with paths in load order
declare -a MERGED_CONFIG_FILES=()

load_config_chain() {
    local config_file=$1
    local config_dir
    config_dir=$(dirname "$config_file")

    # Check if file exists
    if [ ! -f "$config_file" ]; then
        log_error "Config file not found: $config_file"
        return 1
    fi

    # Check for cycles
    if config_in_chain "$config_file"; then
        log_error "Circular inheritance detected in config files!"
        log_error "Config chain: ${CONFIG_CHAIN[*]} -> $config_file"
        return 1
    fi

    # Add to chain
    add_to_chain "$config_file"

    # Get extends value
    local extends_value
    extends_value=$(get_extends_path "$config_file")

    if [ -n "$extends_value" ]; then
        # Resolve the path relative to current config's directory
        local base_config_path
        base_config_path=$(resolve_config_path "$config_dir" "$extends_value")

        if [ ! -f "$base_config_path" ]; then
            log_error "Base config file not found: $base_config_path"
            log_error "Referenced from: $config_file"
            return 1
        fi

        # Recursively load the base config first
        load_config_chain "$base_config_path" || return 1
    fi

    # Add current config to the merged list (base configs come first)
    MERGED_CONFIG_FILES+=("$config_file")

    return 0
}

# Parse a value from multiple config files, returning the last (most specific) value
# This implements the "child overrides parent" merge strategy
parse_yaml_value_merged() {
    local KEY=$1
    shift
    local FILES=("$@")
    local result=""

    for file in "${FILES[@]}"; do
        local value
        value=$(parse_yaml_value "$KEY" "$file")
        if [ -n "$value" ]; then
            result="$value"
        fi
    done

    echo "$result"
}

# Parse a nested value from multiple config files
parse_yaml_nested_merged() {
    local PARENT=$1
    local KEY=$2
    shift 2
    local FILES=("$@")
    local result=""

    for file in "${FILES[@]}"; do
        local value
        value=$(parse_yaml_nested "$PARENT" "$KEY" "$file")
        if [ -n "$value" ]; then
            result="$value"
        fi
    done

    echo "$result"
}

# Parse a deeply nested value from multiple config files
parse_yaml_nested_deep_merged() {
    local GRANDPARENT=$1
    local PARENT=$2
    local KEY=$3
    shift 3
    local FILES=("$@")
    local result=""

    for file in "${FILES[@]}"; do
        local value
        value=$(parse_yaml_nested_deep "$GRANDPARENT" "$PARENT" "$KEY" "$file")
        if [ -n "$value" ]; then
            result="$value"
        fi
    done

    echo "$result"
}

# Parse events from multiple config files
parse_yaml_nested_events_merged() {
    local GRANDPARENT=$1
    local PARENT=$2
    local KEY=$3
    shift 3
    local FILES=("$@")
    local result=""

    for file in "${FILES[@]}"; do
        local value
        value=$(parse_yaml_nested_events "$GRANDPARENT" "$PARENT" "$KEY" "$file")
        if [ -n "$value" ]; then
            result="$value"
        fi
    done

    echo "$result"
}

# Parse priority labels from multiple config files
parse_priority_labels_merged() {
    local LEVEL=$1
    shift
    local FILES=("$@")
    local result=""

    for file in "${FILES[@]}"; do
        local value
        value=$(parse_priority_labels "$LEVEL" "$file")
        if [ -n "$value" ]; then
            result="$value"
        fi
    done

    echo "$result"
}

# Parse category mappings from multiple config files
parse_category_mappings_merged() {
    local CATEGORY=$1
    shift
    local FILES=("$@")
    local result=""

    for file in "${FILES[@]}"; do
        local value
        value=$(parse_category_mappings "$CATEGORY" "$file")
        if [ -n "$value" ]; then
            result="$value"
        fi
    done

    echo "$result"
}

# Load configuration from YAML file
# Supports config inheritance via 'extends' or 'base_config' field
load_config() {
    if [ ! -f "$CONFIG_FILE" ]; then
        log_warn "Config file not found: $CONFIG_FILE"
        log_info "Using default configuration"
        set_defaults
        return
    fi

    log_step "Loading configuration from $CONFIG_FILE"

    # Reset inheritance tracking arrays
    CONFIG_CHAIN=()
    MERGED_CONFIG_FILES=()

    # Load the config chain (handles inheritance recursively)
    if ! load_config_chain "$CONFIG_FILE"; then
        log_error "Failed to load configuration chain"
        set_defaults
        return 1
    fi

    # Log inheritance chain if multiple configs
    if [ ${#MERGED_CONFIG_FILES[@]} -gt 1 ]; then
        log_info "Config inheritance chain (${#MERGED_CONFIG_FILES[@]} files):"
        for cfg in "${MERGED_CONFIG_FILES[@]}"; do
            log_info "  - $cfg"
        done
    fi

    # Task source
    TASK_SOURCE=$(parse_yaml_value_merged "task_source" "${MERGED_CONFIG_FILES[@]}")
    TASK_SOURCE="${TASK_SOURCE:-github-issues}"

    # Template files - relative to CHADGI_DIR
    PROMPT_TEMPLATE=$(parse_yaml_value_merged "prompt_template" "${MERGED_CONFIG_FILES[@]}")
    PROMPT_TEMPLATE="${PROMPT_TEMPLATE:-./chadgi-task.md}"
    GENERATE_TEMPLATE=$(parse_yaml_value_merged "generate_template" "${MERGED_CONFIG_FILES[@]}")
    GENERATE_TEMPLATE="${GENERATE_TEMPLATE:-./chadgi-generate-task.md}"
    PROGRESS_FILE=$(parse_yaml_value_merged "progress_file" "${MERGED_CONFIG_FILES[@]}")
    PROGRESS_FILE="${PROGRESS_FILE:-./chadgi-progress.json}"

    # GitHub settings
    REPO=$(parse_yaml_nested_merged "github" "repo" "${MERGED_CONFIG_FILES[@]}")
    REPO="${REPO:-owner/repo}"
    REPO_OWNER="${REPO%%/*}"
    PROJECT_NUMBER=$(parse_yaml_nested_merged "github" "project_number" "${MERGED_CONFIG_FILES[@]}")
    PROJECT_NUMBER="${PROJECT_NUMBER:-1}"

    # Project board column names
    READY_COLUMN=$(parse_yaml_nested_merged "github" "ready_column" "${MERGED_CONFIG_FILES[@]}")
    READY_COLUMN="${READY_COLUMN:-Ready}"
    IN_PROGRESS_COLUMN=$(parse_yaml_nested_merged "github" "in_progress_column" "${MERGED_CONFIG_FILES[@]}")
    IN_PROGRESS_COLUMN="${IN_PROGRESS_COLUMN:-In Progress}"
    REVIEW_COLUMN=$(parse_yaml_nested_merged "github" "review_column" "${MERGED_CONFIG_FILES[@]}")
    REVIEW_COLUMN="${REVIEW_COLUMN:-In Review}"
    DONE_COLUMN=$(parse_yaml_nested_merged "github" "done_column" "${MERGED_CONFIG_FILES[@]}")
    DONE_COLUMN="${DONE_COLUMN:-Done}"

    # Branch settings
    BASE_BRANCH=$(parse_yaml_nested_merged "branch" "base" "${MERGED_CONFIG_FILES[@]}")
    BASE_BRANCH="${BASE_BRANCH:-main}"
    BRANCH_PREFIX=$(parse_yaml_nested_merged "branch" "prefix" "${MERGED_CONFIG_FILES[@]}")
    BRANCH_PREFIX="${BRANCH_PREFIX:-feature/issue-}"

    # Polling settings
    POLL_INTERVAL=$(parse_yaml_value_merged "poll_interval" "${MERGED_CONFIG_FILES[@]}")
    POLL_INTERVAL="${POLL_INTERVAL:-10}"
    CONSECUTIVE_EMPTY_THRESHOLD=$(parse_yaml_value_merged "consecutive_empty_threshold" "${MERGED_CONFIG_FILES[@]}")
    CONSECUTIVE_EMPTY_THRESHOLD="${CONSECUTIVE_EMPTY_THRESHOLD:-2}"

    # On empty queue behavior
    ON_EMPTY_QUEUE=$(parse_yaml_value_merged "on_empty_queue" "${MERGED_CONFIG_FILES[@]}")
    ON_EMPTY_QUEUE="${ON_EMPTY_QUEUE:-generate}"

    # Output settings
    SHOW_TOOL_DETAILS=$(parse_yaml_nested_merged "output" "show_tool_details" "${MERGED_CONFIG_FILES[@]}")
    SHOW_TOOL_DETAILS="${SHOW_TOOL_DETAILS:-true}"
    SHOW_COST=$(parse_yaml_nested_merged "output" "show_cost" "${MERGED_CONFIG_FILES[@]}")
    SHOW_COST="${SHOW_COST:-true}"
    TRUNCATE_LENGTH=$(parse_yaml_nested_merged "output" "truncate_length" "${MERGED_CONFIG_FILES[@]}")
    TRUNCATE_LENGTH="${TRUNCATE_LENGTH:-60}"

    # Logging settings
    local CONFIG_LOG_LEVEL=$(parse_yaml_nested_merged "output" "log_level" "${MERGED_CONFIG_FILES[@]}")
    CONFIG_LOG_LEVEL="${CONFIG_LOG_LEVEL:-INFO}"
    local CONFIG_LOG_FILE=$(parse_yaml_nested_merged "output" "log_file" "${MERGED_CONFIG_FILES[@]}")
    CONFIG_LOG_FILE="${CONFIG_LOG_FILE:-./chadgi.log}"
    LOG_FILE_MAX_SIZE_MB=$(parse_yaml_nested_merged "output" "max_log_size_mb" "${MERGED_CONFIG_FILES[@]}")
    LOG_FILE_MAX_SIZE_MB="${LOG_FILE_MAX_SIZE_MB:-10}"
    LOG_FILE_MAX_COUNT=$(parse_yaml_nested_merged "output" "max_log_files" "${MERGED_CONFIG_FILES[@]}")
    LOG_FILE_MAX_COUNT="${LOG_FILE_MAX_COUNT:-5}"

    # Set log level (DEBUG_MODE from CLI overrides config)
    if [ "$DEBUG_MODE" = "true" ]; then
        CURRENT_LOG_LEVEL=$LOG_LEVEL_DEBUG
    else
        CURRENT_LOG_LEVEL=$(parse_log_level "$CONFIG_LOG_LEVEL")
    fi

    # Resolve log file path (relative to CHADGI_DIR)
    if [[ "$CONFIG_LOG_FILE" != /* ]]; then
        LOG_FILE="$CHADGI_DIR/$CONFIG_LOG_FILE"
    else
        LOG_FILE="$CONFIG_LOG_FILE"
    fi

    # Branding settings - Chad does what Chad wants
    ISSUE_PREFIX=$(parse_yaml_nested_merged "branding" "issue_prefix" "${MERGED_CONFIG_FILES[@]}")
    ISSUE_PREFIX="${ISSUE_PREFIX:-[CHAD]}"
    CHAD_LABEL=$(parse_yaml_nested_merged "branding" "label" "${MERGED_CONFIG_FILES[@]}")
    CHAD_LABEL="${CHAD_LABEL:-touched-by-chad}"
    INCLUDE_FOOTER=$(parse_yaml_nested_merged "branding" "include_footer" "${MERGED_CONFIG_FILES[@]}")
    INCLUDE_FOOTER="${INCLUDE_FOOTER:-true}"
    CHAD_TAGLINE=$(parse_yaml_nested_merged "branding" "tagline" "${MERGED_CONFIG_FILES[@]}")
    CHAD_TAGLINE="${CHAD_TAGLINE:-Chad does what Chad wants.}"

    # Iteration settings (the core ChadGI pattern)
    MAX_ITERATIONS=$(parse_yaml_nested_merged "iteration" "max_iterations" "${MERGED_CONFIG_FILES[@]}")
    MAX_ITERATIONS="${MAX_ITERATIONS:-5}"
    COMPLETION_PROMISE=$(parse_yaml_nested_merged "iteration" "completion_promise" "${MERGED_CONFIG_FILES[@]}")
    COMPLETION_PROMISE="${COMPLETION_PROMISE:-COMPLETE}"
    READY_PROMISE=$(parse_yaml_nested_merged "iteration" "ready_promise" "${MERGED_CONFIG_FILES[@]}")
    READY_PROMISE="${READY_PROMISE:-READY_FOR_PR}"
    TEST_COMMAND=$(parse_yaml_nested_merged "iteration" "test_command" "${MERGED_CONFIG_FILES[@]}")
    TEST_COMMAND="${TEST_COMMAND:-}"
    BUILD_COMMAND=$(parse_yaml_nested_merged "iteration" "build_command" "${MERGED_CONFIG_FILES[@]}")
    BUILD_COMMAND="${BUILD_COMMAND:-}"
    ON_MAX_ITERATIONS=$(parse_yaml_nested_merged "iteration" "on_max_iterations" "${MERGED_CONFIG_FILES[@]}")
    ON_MAX_ITERATIONS="${ON_MAX_ITERATIONS:-skip}"
    GIGACHAD_MODE=$(parse_yaml_nested_merged "iteration" "gigachad_mode" "${MERGED_CONFIG_FILES[@]}")
    GIGACHAD_MODE="${GIGACHAD_MODE:-false}"
    GIGACHAD_COMMIT_PREFIX=$(parse_yaml_nested_merged "iteration" "gigachad_commit_prefix" "${MERGED_CONFIG_FILES[@]}")
    GIGACHAD_COMMIT_PREFIX="${GIGACHAD_COMMIT_PREFIX:-[GIGACHAD]}"

    # Task timeout (in minutes, 0 = no timeout)
    TASK_TIMEOUT=$(parse_yaml_nested_merged "iteration" "task_timeout" "${MERGED_CONFIG_FILES[@]}")
    TASK_TIMEOUT="${TASK_TIMEOUT:-30}"

    # Retry settings
    RETRY_DELAY=$(parse_yaml_nested_merged "iteration" "retry_delay" "${MERGED_CONFIG_FILES[@]}")
    RETRY_DELAY="${RETRY_DELAY:-5}"
    RETRY_BACKOFF=$(parse_yaml_nested_merged "iteration" "retry_backoff" "${MERGED_CONFIG_FILES[@]}")
    RETRY_BACKOFF="${RETRY_BACKOFF:-exponential}"
    RETRY_MAX_DELAY=$(parse_yaml_nested_merged "iteration" "retry_max_delay" "${MERGED_CONFIG_FILES[@]}")
    RETRY_MAX_DELAY="${RETRY_MAX_DELAY:-60}"
    RETRY_JITTER=$(parse_yaml_nested_merged "iteration" "retry_jitter" "${MERGED_CONFIG_FILES[@]}")
    RETRY_JITTER="${RETRY_JITTER:-false}"

    # Error diagnostics settings
    ERROR_DIAGNOSTICS=$(parse_yaml_nested_merged "iteration" "error_diagnostics" "${MERGED_CONFIG_FILES[@]}")
    ERROR_DIAGNOSTICS="${ERROR_DIAGNOSTICS:-true}"

    # Notification settings
    NOTIFICATIONS_ENABLED=$(parse_yaml_nested_merged "notifications" "enabled" "${MERGED_CONFIG_FILES[@]}")
    NOTIFICATIONS_ENABLED="${NOTIFICATIONS_ENABLED:-false}"

    # Rate limiting
    NOTIFY_RATE_MIN_INTERVAL=$(parse_yaml_nested_deep_merged "notifications" "rate_limit" "min_interval" "${MERGED_CONFIG_FILES[@]}")
    NOTIFY_RATE_MIN_INTERVAL="${NOTIFY_RATE_MIN_INTERVAL:-10}"
    NOTIFY_RATE_BURST_LIMIT=$(parse_yaml_nested_deep_merged "notifications" "rate_limit" "burst_limit" "${MERGED_CONFIG_FILES[@]}")
    NOTIFY_RATE_BURST_LIMIT="${NOTIFY_RATE_BURST_LIMIT:-5}"
    NOTIFY_RATE_BURST_WINDOW=$(parse_yaml_nested_deep_merged "notifications" "rate_limit" "burst_window" "${MERGED_CONFIG_FILES[@]}")
    NOTIFY_RATE_BURST_WINDOW="${NOTIFY_RATE_BURST_WINDOW:-60}"

    # Slack notifications
    SLACK_ENABLED=$(parse_yaml_nested_deep_merged "notifications" "slack" "enabled" "${MERGED_CONFIG_FILES[@]}")
    SLACK_ENABLED="${SLACK_ENABLED:-false}"
    SLACK_WEBHOOK_URL=$(parse_yaml_nested_deep_merged "notifications" "slack" "webhook_url" "${MERGED_CONFIG_FILES[@]}")
    SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
    SLACK_EVENT_TASK_STARTED=$(parse_yaml_nested_events_merged "notifications" "slack" "task_started" "${MERGED_CONFIG_FILES[@]}")
    SLACK_EVENT_TASK_STARTED="${SLACK_EVENT_TASK_STARTED:-true}"
    SLACK_EVENT_TASK_COMPLETED=$(parse_yaml_nested_events_merged "notifications" "slack" "task_completed" "${MERGED_CONFIG_FILES[@]}")
    SLACK_EVENT_TASK_COMPLETED="${SLACK_EVENT_TASK_COMPLETED:-true}"
    SLACK_EVENT_TASK_FAILED=$(parse_yaml_nested_events_merged "notifications" "slack" "task_failed" "${MERGED_CONFIG_FILES[@]}")
    SLACK_EVENT_TASK_FAILED="${SLACK_EVENT_TASK_FAILED:-true}"
    SLACK_EVENT_GIGACHAD_MERGE=$(parse_yaml_nested_events_merged "notifications" "slack" "gigachad_merge" "${MERGED_CONFIG_FILES[@]}")
    SLACK_EVENT_GIGACHAD_MERGE="${SLACK_EVENT_GIGACHAD_MERGE:-true}"
    SLACK_EVENT_SESSION_ENDED=$(parse_yaml_nested_events_merged "notifications" "slack" "session_ended" "${MERGED_CONFIG_FILES[@]}")
    SLACK_EVENT_SESSION_ENDED="${SLACK_EVENT_SESSION_ENDED:-true}"

    # Discord notifications
    DISCORD_ENABLED=$(parse_yaml_nested_deep_merged "notifications" "discord" "enabled" "${MERGED_CONFIG_FILES[@]}")
    DISCORD_ENABLED="${DISCORD_ENABLED:-false}"
    DISCORD_WEBHOOK_URL=$(parse_yaml_nested_deep_merged "notifications" "discord" "webhook_url" "${MERGED_CONFIG_FILES[@]}")
    DISCORD_WEBHOOK_URL="${DISCORD_WEBHOOK_URL:-}"
    DISCORD_EVENT_TASK_STARTED=$(parse_yaml_nested_events_merged "notifications" "discord" "task_started" "${MERGED_CONFIG_FILES[@]}")
    DISCORD_EVENT_TASK_STARTED="${DISCORD_EVENT_TASK_STARTED:-true}"
    DISCORD_EVENT_TASK_COMPLETED=$(parse_yaml_nested_events_merged "notifications" "discord" "task_completed" "${MERGED_CONFIG_FILES[@]}")
    DISCORD_EVENT_TASK_COMPLETED="${DISCORD_EVENT_TASK_COMPLETED:-true}"
    DISCORD_EVENT_TASK_FAILED=$(parse_yaml_nested_events_merged "notifications" "discord" "task_failed" "${MERGED_CONFIG_FILES[@]}")
    DISCORD_EVENT_TASK_FAILED="${DISCORD_EVENT_TASK_FAILED:-true}"
    DISCORD_EVENT_GIGACHAD_MERGE=$(parse_yaml_nested_events_merged "notifications" "discord" "gigachad_merge" "${MERGED_CONFIG_FILES[@]}")
    DISCORD_EVENT_GIGACHAD_MERGE="${DISCORD_EVENT_GIGACHAD_MERGE:-true}"
    DISCORD_EVENT_SESSION_ENDED=$(parse_yaml_nested_events_merged "notifications" "discord" "session_ended" "${MERGED_CONFIG_FILES[@]}")
    DISCORD_EVENT_SESSION_ENDED="${DISCORD_EVENT_SESSION_ENDED:-true}"

    # Generic webhook notifications
    GENERIC_WEBHOOK_ENABLED=$(parse_yaml_nested_deep_merged "notifications" "generic" "enabled" "${MERGED_CONFIG_FILES[@]}")
    GENERIC_WEBHOOK_ENABLED="${GENERIC_WEBHOOK_ENABLED:-false}"
    GENERIC_WEBHOOK_URL=$(parse_yaml_nested_deep_merged "notifications" "generic" "webhook_url" "${MERGED_CONFIG_FILES[@]}")
    GENERIC_WEBHOOK_URL="${GENERIC_WEBHOOK_URL:-}"
    GENERIC_EVENT_TASK_STARTED=$(parse_yaml_nested_events_merged "notifications" "generic" "task_started" "${MERGED_CONFIG_FILES[@]}")
    GENERIC_EVENT_TASK_STARTED="${GENERIC_EVENT_TASK_STARTED:-true}"
    GENERIC_EVENT_TASK_COMPLETED=$(parse_yaml_nested_events_merged "notifications" "generic" "task_completed" "${MERGED_CONFIG_FILES[@]}")
    GENERIC_EVENT_TASK_COMPLETED="${GENERIC_EVENT_TASK_COMPLETED:-true}"
    GENERIC_EVENT_TASK_FAILED=$(parse_yaml_nested_events_merged "notifications" "generic" "task_failed" "${MERGED_CONFIG_FILES[@]}")
    GENERIC_EVENT_TASK_FAILED="${GENERIC_EVENT_TASK_FAILED:-true}"
    GENERIC_EVENT_GIGACHAD_MERGE=$(parse_yaml_nested_events_merged "notifications" "generic" "gigachad_merge" "${MERGED_CONFIG_FILES[@]}")
    GENERIC_EVENT_GIGACHAD_MERGE="${GENERIC_EVENT_GIGACHAD_MERGE:-true}"
    GENERIC_EVENT_SESSION_ENDED=$(parse_yaml_nested_events_merged "notifications" "generic" "session_ended" "${MERGED_CONFIG_FILES[@]}")
    GENERIC_EVENT_SESSION_ENDED="${GENERIC_EVENT_SESSION_ENDED:-true}"

    # Priority settings - task queue ordering by priority labels
    PRIORITY_ENABLED=$(parse_yaml_nested_merged "priority" "enabled" "${MERGED_CONFIG_FILES[@]}")
    PRIORITY_ENABLED="${PRIORITY_ENABLED:-true}"

    # Parse priority labels for each level (space-separated)
    PRIORITY_LABELS_CRITICAL=$(parse_priority_labels_merged "critical" "${MERGED_CONFIG_FILES[@]}")
    PRIORITY_LABELS_CRITICAL="${PRIORITY_LABELS_CRITICAL:-priority:critical P0 urgent}"
    PRIORITY_LABELS_HIGH=$(parse_priority_labels_merged "high" "${MERGED_CONFIG_FILES[@]}")
    PRIORITY_LABELS_HIGH="${PRIORITY_LABELS_HIGH:-priority:high P1}"
    PRIORITY_LABELS_NORMAL=$(parse_priority_labels_merged "normal" "${MERGED_CONFIG_FILES[@]}")
    PRIORITY_LABELS_NORMAL="${PRIORITY_LABELS_NORMAL:-priority:normal P2}"
    PRIORITY_LABELS_LOW=$(parse_priority_labels_merged "low" "${MERGED_CONFIG_FILES[@]}")
    PRIORITY_LABELS_LOW="${PRIORITY_LABELS_LOW:-priority:low P3 backlog}"

    # Task categorization settings - classify tasks by type
    CATEGORY_ENABLED=$(parse_yaml_nested_merged "category" "enabled" "${MERGED_CONFIG_FILES[@]}")
    CATEGORY_ENABLED="${CATEGORY_ENABLED:-true}"

    # Parse category mappings (label -> category mappings)
    CATEGORY_LABELS_BUG=$(parse_category_mappings_merged "bug" "${MERGED_CONFIG_FILES[@]}")
    CATEGORY_LABELS_BUG="${CATEGORY_LABELS_BUG:-bug bugfix fix hotfix}"
    CATEGORY_LABELS_FEATURE=$(parse_category_mappings_merged "feature" "${MERGED_CONFIG_FILES[@]}")
    CATEGORY_LABELS_FEATURE="${CATEGORY_LABELS_FEATURE:-feature enhancement new-feature}"
    CATEGORY_LABELS_REFACTOR=$(parse_category_mappings_merged "refactor" "${MERGED_CONFIG_FILES[@]}")
    CATEGORY_LABELS_REFACTOR="${CATEGORY_LABELS_REFACTOR:-refactor refactoring cleanup tech-debt}"
    CATEGORY_LABELS_DOCS=$(parse_category_mappings_merged "docs" "${MERGED_CONFIG_FILES[@]}")
    CATEGORY_LABELS_DOCS="${CATEGORY_LABELS_DOCS:-docs documentation}"
    CATEGORY_LABELS_TEST=$(parse_category_mappings_merged "test" "${MERGED_CONFIG_FILES[@]}")
    CATEGORY_LABELS_TEST="${CATEGORY_LABELS_TEST:-test testing tests}"
    CATEGORY_LABELS_CHORE=$(parse_category_mappings_merged "chore" "${MERGED_CONFIG_FILES[@]}")
    CATEGORY_LABELS_CHORE="${CATEGORY_LABELS_CHORE:-chore maintenance ci build}"

    # Task lock settings - prevent concurrent processing of same issue
    TASK_LOCK_TIMEOUT_MINUTES=$(parse_yaml_value_merged "task_lock_timeout_minutes" "${MERGED_CONFIG_FILES[@]}")
    TASK_LOCK_TIMEOUT_MINUTES="${TASK_LOCK_TIMEOUT_MINUTES:-120}"

    # Task dependency settings - check dependencies before processing tasks
    DEPENDENCIES_ENABLED=$(parse_yaml_nested_merged "dependencies" "enabled" "${MERGED_CONFIG_FILES[@]}")
    DEPENDENCIES_ENABLED="${DEPENDENCIES_ENABLED:-true}"

    # Parse dependency patterns (regex patterns to match in issue body)
    DEPENDENCY_PATTERNS=$(parse_yaml_value_merged "dependency_patterns" "${MERGED_CONFIG_FILES[@]}")
    DEPENDENCY_PATTERNS="${DEPENDENCY_PATTERNS:-depends on blocked by requires}"

    # Whether to check GitHub linked issues for blocking relationships
    DEPENDENCIES_CHECK_LINKED=$(parse_yaml_nested_merged "dependencies" "check_linked_issues" "${MERGED_CONFIG_FILES[@]}")
    DEPENDENCIES_CHECK_LINKED="${DEPENDENCIES_CHECK_LINKED:-true}"

    # Cache timeout for dependency resolution (in seconds)
    DEPENDENCY_CACHE_TIMEOUT=$(parse_yaml_nested_merged "dependencies" "cache_timeout" "${MERGED_CONFIG_FILES[@]}")
    DEPENDENCY_CACHE_TIMEOUT="${DEPENDENCY_CACHE_TIMEOUT:-300}"

    # Budget settings - protect against runaway costs
    BUDGET_PER_TASK_LIMIT=$(parse_yaml_nested_merged "budget" "per_task_limit" "${MERGED_CONFIG_FILES[@]}")
    BUDGET_PER_TASK_LIMIT="${BUDGET_PER_TASK_LIMIT:-}"
    BUDGET_PER_SESSION_LIMIT=$(parse_yaml_nested_merged "budget" "per_session_limit" "${MERGED_CONFIG_FILES[@]}")
    BUDGET_PER_SESSION_LIMIT="${BUDGET_PER_SESSION_LIMIT:-}"
    BUDGET_ON_TASK_EXCEEDED=$(parse_yaml_nested_merged "budget" "on_task_budget_exceeded" "${MERGED_CONFIG_FILES[@]}")
    BUDGET_ON_TASK_EXCEEDED="${BUDGET_ON_TASK_EXCEEDED:-skip}"
    BUDGET_ON_SESSION_EXCEEDED=$(parse_yaml_nested_merged "budget" "on_session_budget_exceeded" "${MERGED_CONFIG_FILES[@]}")
    BUDGET_ON_SESSION_EXCEEDED="${BUDGET_ON_SESSION_EXCEEDED:-stop}"
    BUDGET_WARNING_THRESHOLD=$(parse_yaml_nested_merged "budget" "warning_threshold" "${MERGED_CONFIG_FILES[@]}")
    BUDGET_WARNING_THRESHOLD="${BUDGET_WARNING_THRESHOLD:-80}"

    # Interactive approval settings - human-in-the-loop mode
    # Note: Can be enabled via --interactive CLI flag or config file
    INTERACTIVE_ENABLED=$(parse_yaml_nested_merged "interactive" "enabled" "${MERGED_CONFIG_FILES[@]}")
    INTERACTIVE_ENABLED="${INTERACTIVE_ENABLED:-false}"
    INTERACTIVE_APPROVE_PRE_TASK=$(parse_yaml_nested_merged "interactive" "approve_pre_task" "${MERGED_CONFIG_FILES[@]}")
    INTERACTIVE_APPROVE_PRE_TASK="${INTERACTIVE_APPROVE_PRE_TASK:-false}"
    INTERACTIVE_APPROVE_PHASE1=$(parse_yaml_nested_merged "interactive" "approve_phase1" "${MERGED_CONFIG_FILES[@]}")
    INTERACTIVE_APPROVE_PHASE1="${INTERACTIVE_APPROVE_PHASE1:-true}"
    INTERACTIVE_APPROVE_PHASE2=$(parse_yaml_nested_merged "interactive" "approve_phase2" "${MERGED_CONFIG_FILES[@]}")
    INTERACTIVE_APPROVE_PHASE2="${INTERACTIVE_APPROVE_PHASE2:-true}"
    INTERACTIVE_SHOW_DIFF=$(parse_yaml_nested_merged "interactive" "show_diff" "${MERGED_CONFIG_FILES[@]}")
    INTERACTIVE_SHOW_DIFF="${INTERACTIVE_SHOW_DIFF:-true}"
    INTERACTIVE_TIMEOUT=$(parse_yaml_nested_merged "interactive" "timeout" "${MERGED_CONFIG_FILES[@]}")
    INTERACTIVE_TIMEOUT="${INTERACTIVE_TIMEOUT:-0}"

    # CLI flag takes precedence over config for enabling interactive mode
    if [ "$INTERACTIVE_MODE" = "true" ]; then
        INTERACTIVE_ENABLED="true"
    fi

    # Load lifecycle hooks configuration
    load_hooks_config "${MERGED_CONFIG_FILES[@]}"

    # Resolve relative paths to CHADGI_DIR
    [[ "$PROMPT_TEMPLATE" != /* ]] && PROMPT_TEMPLATE="$CHADGI_DIR/$PROMPT_TEMPLATE"
    [[ "$GENERATE_TEMPLATE" != /* ]] && GENERATE_TEMPLATE="$CHADGI_DIR/$GENERATE_TEMPLATE"
    [[ "$PROGRESS_FILE" != /* ]] && PROGRESS_FILE="$CHADGI_DIR/$PROGRESS_FILE"

    # Apply CLI override for task timeout if provided
    if [ -n "$CLI_TASK_TIMEOUT" ]; then
        TASK_TIMEOUT="$CLI_TASK_TIMEOUT"
    fi

    log_success "Configuration loaded"
    if has_hooks_configured; then
        log_info "Lifecycle hooks configured"
    fi
}

# Set default configuration
set_defaults() {
    TASK_SOURCE="github-issues"
    PROMPT_TEMPLATE="$CHADGI_DIR/chadgi-task.md"
    GENERATE_TEMPLATE="$CHADGI_DIR/chadgi-generate-task.md"
    PROGRESS_FILE="$CHADGI_DIR/chadgi-progress.json"
    REPO="${REPO:-owner/repo}"
    REPO_OWNER="${REPO%%/*}"
    PROJECT_NUMBER="${PROJECT_NUMBER:-1}"
    READY_COLUMN="${READY_COLUMN:-Ready}"
    IN_PROGRESS_COLUMN="${IN_PROGRESS_COLUMN:-In Progress}"
    REVIEW_COLUMN="${REVIEW_COLUMN:-In Review}"
    DONE_COLUMN="${DONE_COLUMN:-Done}"
    BASE_BRANCH="${BASE_BRANCH:-main}"
    BRANCH_PREFIX="${BRANCH_PREFIX:-feature/issue-}"
    POLL_INTERVAL="${POLL_INTERVAL:-10}"
    CONSECUTIVE_EMPTY_THRESHOLD="${CONSECUTIVE_EMPTY_THRESHOLD:-2}"
    ON_EMPTY_QUEUE="${ON_EMPTY_QUEUE:-generate}"
    SHOW_TOOL_DETAILS="true"
    SHOW_COST="true"
    TRUNCATE_LENGTH="60"
    # Logging defaults
    LOG_FILE="$CHADGI_DIR/chadgi.log"
    LOG_FILE_MAX_SIZE_MB="${LOG_FILE_MAX_SIZE_MB:-10}"
    LOG_FILE_MAX_COUNT="${LOG_FILE_MAX_COUNT:-5}"
    # Apply DEBUG_MODE override if set
    if [ "$DEBUG_MODE" = "true" ]; then
        CURRENT_LOG_LEVEL=$LOG_LEVEL_DEBUG
    else
        CURRENT_LOG_LEVEL=$LOG_LEVEL_INFO
    fi
    # Branding defaults - Chad does what Chad wants
    ISSUE_PREFIX="${ISSUE_PREFIX:-[CHAD]}"
    CHAD_LABEL="${CHAD_LABEL:-touched-by-chad}"
    INCLUDE_FOOTER="${INCLUDE_FOOTER:-true}"
    CHAD_TAGLINE="${CHAD_TAGLINE:-Chad does what Chad wants.}"
    MAX_ITERATIONS="${MAX_ITERATIONS:-5}"
    COMPLETION_PROMISE="${COMPLETION_PROMISE:-COMPLETE}"
    READY_PROMISE="${READY_PROMISE:-READY_FOR_PR}"
    TEST_COMMAND="${TEST_COMMAND:-}"
    BUILD_COMMAND="${BUILD_COMMAND:-}"
    ON_MAX_ITERATIONS="${ON_MAX_ITERATIONS:-skip}"
    GIGACHAD_MODE="${GIGACHAD_MODE:-false}"
    GIGACHAD_COMMIT_PREFIX="${GIGACHAD_COMMIT_PREFIX:-[GIGACHAD]}"
    # Task timeout (in minutes, 0 = no timeout)
    TASK_TIMEOUT="${TASK_TIMEOUT:-30}"
    # Retry settings
    RETRY_DELAY="${RETRY_DELAY:-5}"
    RETRY_BACKOFF="${RETRY_BACKOFF:-exponential}"
    RETRY_MAX_DELAY="${RETRY_MAX_DELAY:-60}"
    RETRY_JITTER="${RETRY_JITTER:-false}"
    # Error diagnostics
    ERROR_DIAGNOSTICS="${ERROR_DIAGNOSTICS:-true}"
    # Task dependency defaults
    DEPENDENCIES_ENABLED="${DEPENDENCIES_ENABLED:-true}"
    DEPENDENCY_PATTERNS="${DEPENDENCY_PATTERNS:-depends on blocked by requires}"
    DEPENDENCIES_CHECK_LINKED="${DEPENDENCIES_CHECK_LINKED:-true}"
    DEPENDENCY_CACHE_TIMEOUT="${DEPENDENCY_CACHE_TIMEOUT:-300}"
    # Task lock defaults
    TASK_LOCK_TIMEOUT_MINUTES="${TASK_LOCK_TIMEOUT_MINUTES:-120}"
    FORCE_CLAIM="${FORCE_CLAIM:-false}"

    # Notification settings
    NOTIFICATIONS_ENABLED="${NOTIFICATIONS_ENABLED:-false}"
    NOTIFY_RATE_MIN_INTERVAL="${NOTIFY_RATE_MIN_INTERVAL:-10}"
    NOTIFY_RATE_BURST_LIMIT="${NOTIFY_RATE_BURST_LIMIT:-5}"
    NOTIFY_RATE_BURST_WINDOW="${NOTIFY_RATE_BURST_WINDOW:-60}"

    # Slack notifications
    SLACK_ENABLED="${SLACK_ENABLED:-false}"
    SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
    SLACK_EVENT_TASK_STARTED="${SLACK_EVENT_TASK_STARTED:-true}"
    SLACK_EVENT_TASK_COMPLETED="${SLACK_EVENT_TASK_COMPLETED:-true}"
    SLACK_EVENT_TASK_FAILED="${SLACK_EVENT_TASK_FAILED:-true}"
    SLACK_EVENT_GIGACHAD_MERGE="${SLACK_EVENT_GIGACHAD_MERGE:-true}"
    SLACK_EVENT_SESSION_ENDED="${SLACK_EVENT_SESSION_ENDED:-true}"

    # Discord notifications
    DISCORD_ENABLED="${DISCORD_ENABLED:-false}"
    DISCORD_WEBHOOK_URL="${DISCORD_WEBHOOK_URL:-}"
    DISCORD_EVENT_TASK_STARTED="${DISCORD_EVENT_TASK_STARTED:-true}"
    DISCORD_EVENT_TASK_COMPLETED="${DISCORD_EVENT_TASK_COMPLETED:-true}"
    DISCORD_EVENT_TASK_FAILED="${DISCORD_EVENT_TASK_FAILED:-true}"
    DISCORD_EVENT_GIGACHAD_MERGE="${DISCORD_EVENT_GIGACHAD_MERGE:-true}"
    DISCORD_EVENT_SESSION_ENDED="${DISCORD_EVENT_SESSION_ENDED:-true}"

    # Generic webhook notifications
    GENERIC_WEBHOOK_ENABLED="${GENERIC_WEBHOOK_ENABLED:-false}"
    GENERIC_WEBHOOK_URL="${GENERIC_WEBHOOK_URL:-}"
    GENERIC_EVENT_TASK_STARTED="${GENERIC_EVENT_TASK_STARTED:-true}"
    GENERIC_EVENT_TASK_COMPLETED="${GENERIC_EVENT_TASK_COMPLETED:-true}"
    GENERIC_EVENT_TASK_FAILED="${GENERIC_EVENT_TASK_FAILED:-true}"
    GENERIC_EVENT_GIGACHAD_MERGE="${GENERIC_EVENT_GIGACHAD_MERGE:-true}"
    GENERIC_EVENT_SESSION_ENDED="${GENERIC_EVENT_SESSION_ENDED:-true}"

    # Priority settings
    PRIORITY_ENABLED="${PRIORITY_ENABLED:-true}"
    PRIORITY_LABELS_CRITICAL="${PRIORITY_LABELS_CRITICAL:-priority:critical P0 urgent}"
    PRIORITY_LABELS_HIGH="${PRIORITY_LABELS_HIGH:-priority:high P1}"
    PRIORITY_LABELS_NORMAL="${PRIORITY_LABELS_NORMAL:-priority:normal P2}"
    PRIORITY_LABELS_LOW="${PRIORITY_LABELS_LOW:-priority:low P3 backlog}"

    # Category settings
    CATEGORY_ENABLED="${CATEGORY_ENABLED:-true}"
    CATEGORY_LABELS_BUG="${CATEGORY_LABELS_BUG:-bug bugfix fix hotfix}"
    CATEGORY_LABELS_FEATURE="${CATEGORY_LABELS_FEATURE:-feature enhancement new-feature}"
    CATEGORY_LABELS_REFACTOR="${CATEGORY_LABELS_REFACTOR:-refactor refactoring cleanup tech-debt}"
    CATEGORY_LABELS_DOCS="${CATEGORY_LABELS_DOCS:-docs documentation}"
    CATEGORY_LABELS_TEST="${CATEGORY_LABELS_TEST:-test testing tests}"
    CATEGORY_LABELS_CHORE="${CATEGORY_LABELS_CHORE:-chore maintenance ci build}"
}

#------------------------------------------------------------------------------
# Retry Delay Calculation
#------------------------------------------------------------------------------

# Calculate the retry delay based on backoff strategy and iteration
# Usage: calculate_retry_delay <iteration_number>
# Returns: delay in seconds (printed to stdout)
calculate_retry_delay() {
    local ITERATION=$1
    local DELAY=0

    case "$RETRY_BACKOFF" in
        "fixed")
            # Always wait retry_delay seconds
            DELAY=$RETRY_DELAY
            ;;
        "linear")
            # Wait retry_delay * iteration_number seconds
            DELAY=$((RETRY_DELAY * ITERATION))
            ;;
        "exponential"|*)
            # Wait retry_delay * 2^(iteration-1) seconds (capped at max_delay)
            local EXPONENT=$((ITERATION - 1))
            local POWER=1
            local i=0
            while [ $i -lt $EXPONENT ]; do
                POWER=$((POWER * 2))
                i=$((i + 1))
            done
            DELAY=$((RETRY_DELAY * POWER))
            ;;
    esac

    # Cap at max delay
    if [ $DELAY -gt $RETRY_MAX_DELAY ]; then
        DELAY=$RETRY_MAX_DELAY
    fi

    # Apply jitter if enabled (±20% randomness)
    if [ "$RETRY_JITTER" = "true" ]; then
        # Calculate 20% of delay
        local JITTER_RANGE=$((DELAY * 20 / 100))
        if [ $JITTER_RANGE -gt 0 ]; then
            # Generate random value between -jitter_range and +jitter_range
            local RANDOM_VAL=$((RANDOM % (JITTER_RANGE * 2 + 1) - JITTER_RANGE))
            DELAY=$((DELAY + RANDOM_VAL))
            # Ensure delay doesn't go below 1 second
            if [ $DELAY -lt 1 ]; then
                DELAY=1
            fi
        fi
    fi

    echo $DELAY
}

# Log the retry delay being applied
# Usage: log_retry_delay <delay_seconds> <iteration_number>
log_retry_delay() {
    local DELAY=$1
    local ITERATION=$2
    local JITTER_STR=""

    if [ "$RETRY_JITTER" = "true" ]; then
        JITTER_STR=" with jitter"
    fi

    log_info "Retrying in ${DELAY} seconds (backoff: ${RETRY_BACKOFF}${JITTER_STR}, iteration ${ITERATION})"
}

#------------------------------------------------------------------------------
# Task Timeout Management
#------------------------------------------------------------------------------

# Global timeout state
TASK_TIMEOUT_START=0
TASK_TIMEOUT_PID=""
TASK_TIMEOUT_TRIGGERED=false
TIMEOUT_WARNING_75_SHOWN=false
TIMEOUT_WARNING_90_SHOWN=false

# Convert timeout in minutes to seconds
get_timeout_seconds() {
    echo $((TASK_TIMEOUT * 60))
}

# Check if timeout is enabled (non-zero)
is_timeout_enabled() {
    [ "$TASK_TIMEOUT" -gt 0 ] 2>/dev/null
}

# Start the timeout monitor for a task
# Spawns a background process that monitors elapsed time
start_task_timeout() {
    if ! is_timeout_enabled; then
        return
    fi

    TASK_TIMEOUT_START=$(date +%s)
    TASK_TIMEOUT_TRIGGERED=false
    TIMEOUT_WARNING_75_SHOWN=false
    TIMEOUT_WARNING_90_SHOWN=false

    local TIMEOUT_SECS=$(get_timeout_seconds)
    local TIMEOUT_75=$((TIMEOUT_SECS * 75 / 100))
    local TIMEOUT_90=$((TIMEOUT_SECS * 90 / 100))

    # Start background timeout monitor
    (
        while true; do
            sleep 30  # Check every 30 seconds
            local ELAPSED=$(($(date +%s) - TASK_TIMEOUT_START))

            # Check for 75% warning
            if [ $ELAPSED -ge $TIMEOUT_75 ] && [ ! -f "/tmp/chadgi_timeout_75_$$" ]; then
                touch "/tmp/chadgi_timeout_75_$$"
                echo -e "\n${YELLOW}${BOLD}WARNING: Task has used 75% of timeout (${TASK_TIMEOUT} minutes)${NC}" >&2
                echo -e "${YELLOW}  Elapsed: $((ELAPSED / 60)) minutes, Remaining: $(((TIMEOUT_SECS - ELAPSED) / 60)) minutes${NC}" >&2
            fi

            # Check for 90% warning
            if [ $ELAPSED -ge $TIMEOUT_90 ] && [ ! -f "/tmp/chadgi_timeout_90_$$" ]; then
                touch "/tmp/chadgi_timeout_90_$$"
                echo -e "\n${RED}${BOLD}WARNING: Task has used 90% of timeout (${TASK_TIMEOUT} minutes)${NC}" >&2
                echo -e "${RED}  Elapsed: $((ELAPSED / 60)) minutes, Remaining: $(((TIMEOUT_SECS - ELAPSED) / 60)) minutes${NC}" >&2
                echo -e "${RED}  Task will be interrupted soon!${NC}" >&2
            fi

            # Check for timeout
            if [ $ELAPSED -ge $TIMEOUT_SECS ]; then
                touch "/tmp/chadgi_timeout_triggered_$$"
                break
            fi
        done
    ) &
    TASK_TIMEOUT_PID=$!
}

# Stop the timeout monitor
stop_task_timeout() {
    if [ -n "$TASK_TIMEOUT_PID" ]; then
        kill $TASK_TIMEOUT_PID 2>/dev/null || true
        wait $TASK_TIMEOUT_PID 2>/dev/null || true
        TASK_TIMEOUT_PID=""
    fi
    # Clean up temp files
    rm -f "/tmp/chadgi_timeout_75_$$" "/tmp/chadgi_timeout_90_$$" "/tmp/chadgi_timeout_triggered_$$" 2>/dev/null || true
}

# Check if timeout has been triggered
check_task_timeout() {
    if [ -f "/tmp/chadgi_timeout_triggered_$$" ]; then
        TASK_TIMEOUT_TRIGGERED=true
        return 0
    fi
    return 1
}

# Get elapsed time since task started
get_task_elapsed() {
    if [ "$TASK_TIMEOUT_START" -gt 0 ]; then
        echo $(($(date +%s) - TASK_TIMEOUT_START))
    else
        echo 0
    fi
}

# Log timeout warning
log_timeout_warning() {
    local PERCENT=$1
    local ELAPSED=$2
    local REMAINING=$3
    echo -e "${YELLOW}${BOLD}TIMEOUT WARNING: ${PERCENT}% of time limit reached${NC}"
    echo -e "${YELLOW}  Elapsed: $((ELAPSED / 60)) minutes, Remaining: $((REMAINING / 60)) minutes${NC}"
}

# Gracefully interrupt a Claude session
# First tries SIGTERM, then SIGKILL if needed
graceful_interrupt_claude() {
    local PID=$1
    local GRACE_PERIOD=10

    log_warn "Timeout reached - initiating graceful interruption..."

    # First, try SIGTERM for graceful shutdown
    if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
        log_step "Sending SIGTERM to Claude process ($PID)..."
        kill -TERM "$PID" 2>/dev/null || true

        # Wait for grace period
        local WAITED=0
        while [ $WAITED -lt $GRACE_PERIOD ] && kill -0 "$PID" 2>/dev/null; do
            sleep 1
            WAITED=$((WAITED + 1))
        done

        # If still running, use SIGKILL
        if kill -0 "$PID" 2>/dev/null; then
            log_warn "Process still running, sending SIGKILL..."
            kill -KILL "$PID" 2>/dev/null || true
            wait "$PID" 2>/dev/null || true
        fi
    fi

    log_info "Claude process interrupted"
}

# Try to save partial work before timeout
# Commits any uncommitted changes with a WIP prefix
save_partial_work() {
    log_step "Attempting to save partial work..."

    # Check if there are uncommitted changes
    if git status --porcelain 2>/dev/null | grep -q .; then
        log_info "Found uncommitted changes, creating WIP commit..."
        git add -A 2>/dev/null || true
        git commit -m "[WIP] Partial work before timeout - task #$ISSUE_NUMBER" 2>/dev/null || true
        log_success "Partial work saved in WIP commit"
    else
        log_info "No uncommitted changes to save"
    fi
}

#------------------------------------------------------------------------------
# Error Classification and Diagnostic Artifacts
#------------------------------------------------------------------------------

# Error types for classification
# - build_failure: test/build commands failed
# - timeout_failure: task exceeded time limit
# - git_error: version control operations failed
# - api_error: GitHub API or external service failure
# - execution_error: Claude execution issue

# Global diagnostic state
LAST_ERROR_TYPE=""
LAST_ERROR_DETAILS=""
DIAGNOSTICS_DIR=""

# Classify an error based on context and output
# Usage: classify_error <exit_code> <output_file> <context>
# Sets LAST_ERROR_TYPE and LAST_ERROR_DETAILS
classify_error() {
    local EXIT_CODE=$1
    local OUTPUT_FILE=$2
    local CONTEXT=${3:-"unknown"}

    LAST_ERROR_TYPE=""
    LAST_ERROR_DETAILS=""

    # Check for timeout (exit code 124 is standard timeout)
    if [ "$EXIT_CODE" -eq 124 ] || [ "$TASK_TIMEOUT_TRIGGERED" = "true" ]; then
        LAST_ERROR_TYPE="timeout_failure"
        LAST_ERROR_DETAILS="Task exceeded time limit of ${TASK_TIMEOUT} minutes"
        return 0
    fi

    # Check for specific error patterns in output
    if [ -f "$OUTPUT_FILE" ]; then
        local OUTPUT_CONTENT=$(cat "$OUTPUT_FILE" 2>/dev/null || echo "")

        # Check for git errors
        if echo "$OUTPUT_CONTENT" | grep -qiE "(fatal: |error: cannot|git.*failed|merge conflict|not a git repository)"; then
            LAST_ERROR_TYPE="git_error"
            LAST_ERROR_DETAILS=$(echo "$OUTPUT_CONTENT" | grep -iE "(fatal: |error: cannot|git.*failed|merge conflict)" | head -3 | tr '\n' ' ')
            return 0
        fi

        # Check for GitHub API errors
        if echo "$OUTPUT_CONTENT" | grep -qiE "(gh: |API rate limit|403 Forbidden|404 Not Found|could not find|authentication required|GraphQL)"; then
            LAST_ERROR_TYPE="api_error"
            LAST_ERROR_DETAILS=$(echo "$OUTPUT_CONTENT" | grep -iE "(gh: |API rate limit|403|404|could not find|authentication)" | head -3 | tr '\n' ' ')
            return 0
        fi

        # Check for build/test failures (based on context)
        if [ "$CONTEXT" = "test" ] || [ "$CONTEXT" = "build" ] || [ "$CONTEXT" = "verification" ]; then
            if echo "$OUTPUT_CONTENT" | grep -qiE "(FAILED|FAIL|Error:|error\[|npm ERR!|test.*failed|build.*failed|compilation error|syntax error)"; then
                LAST_ERROR_TYPE="build_failure"
                LAST_ERROR_DETAILS=$(echo "$OUTPUT_CONTENT" | grep -iE "(FAILED|FAIL|Error:|error\[|npm ERR!)" | head -5 | tr '\n' ' ')
                return 0
            fi
        fi
    fi

    # Default to execution error for non-zero exit codes
    if [ "$EXIT_CODE" -ne 0 ]; then
        LAST_ERROR_TYPE="execution_error"
        LAST_ERROR_DETAILS="Claude execution failed with exit code $EXIT_CODE"
        return 0
    fi

    # No error detected
    return 1
}

# Create diagnostics directory for the current task
# Usage: create_diagnostics_dir <issue_number>
# Sets DIAGNOSTICS_DIR to the created directory path
create_diagnostics_dir() {
    local ISSUE_NUM=$1
    local TIMESTAMP=$(date +%Y%m%d-%H%M%S)

    DIAGNOSTICS_DIR="${CHADGI_DIR}/diagnostics/${ISSUE_NUM}-${TIMESTAMP}"

    # Create the directory
    mkdir -p "$DIAGNOSTICS_DIR" 2>/dev/null

    if [ -d "$DIAGNOSTICS_DIR" ]; then
        return 0
    else
        log_warn "Could not create diagnostics directory: $DIAGNOSTICS_DIR"
        DIAGNOSTICS_DIR=""
        return 1
    fi
}

# Capture git diff showing what was attempted
# Usage: capture_git_diff <diagnostics_dir>
capture_git_diff() {
    local DIAG_DIR=$1

    if [ -z "$DIAG_DIR" ] || [ ! -d "$DIAG_DIR" ]; then
        return 1
    fi

    local DIFF_FILE="${DIAG_DIR}/git-diff.txt"

    {
        echo "=== Git Diff (staged and unstaged changes) ==="
        echo "Generated at: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
        echo ""
        git diff HEAD 2>/dev/null || echo "(No diff available)"
        echo ""
        echo "=== Staged Changes ==="
        git diff --cached 2>/dev/null || echo "(No staged changes)"
    } > "$DIFF_FILE" 2>&1

    return 0
}

# Capture last N lines of build/test output
# Usage: capture_build_output <diagnostics_dir> <output_file> [lines]
capture_build_output() {
    local DIAG_DIR=$1
    local OUTPUT_FILE=$2
    local LINES=${3:-50}

    if [ -z "$DIAG_DIR" ] || [ ! -d "$DIAG_DIR" ]; then
        return 1
    fi

    local OUTPUT_CAPTURE="${DIAG_DIR}/build-output.txt"

    {
        echo "=== Last ${LINES} Lines of Build/Test Output ==="
        echo "Generated at: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
        echo ""
        if [ -f "$OUTPUT_FILE" ]; then
            tail -n "$LINES" "$OUTPUT_FILE" 2>/dev/null || echo "(Could not read output file)"
        else
            echo "(No output file available)"
        fi
    } > "$OUTPUT_CAPTURE" 2>&1

    return 0
}

# Capture system state snapshot
# Usage: capture_system_state <diagnostics_dir>
capture_system_state() {
    local DIAG_DIR=$1

    if [ -z "$DIAG_DIR" ] || [ ! -d "$DIAG_DIR" ]; then
        return 1
    fi

    local STATE_FILE="${DIAG_DIR}/system-state.txt"

    {
        echo "=== System State Snapshot ==="
        echo "Generated at: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
        echo ""

        echo "--- Git Status ---"
        echo "Current branch: $(git branch --show-current 2>/dev/null || echo 'unknown')"
        echo "Repository: ${REPO:-unknown}"
        echo ""
        git status --short 2>/dev/null || echo "(Git status unavailable)"
        echo ""

        echo "--- Recent Commits ---"
        git log --oneline -5 2>/dev/null || echo "(Git log unavailable)"
        echo ""

        echo "--- Task Context ---"
        echo "Issue Number: ${ISSUE_NUMBER:-unknown}"
        echo "Issue Title: ${ISSUE_TITLE:-unknown}"
        echo "Branch Name: ${BRANCH_NAME:-unknown}"
        echo "Base Branch: ${BASE_BRANCH:-unknown}"
        echo ""

        echo "--- Configuration ---"
        echo "Max Iterations: ${MAX_ITERATIONS:-unknown}"
        echo "Task Timeout: ${TASK_TIMEOUT:-unknown} minutes"
        echo "Test Command: ${TEST_COMMAND:-not configured}"
        echo "Build Command: ${BUILD_COMMAND:-not configured}"
        echo ""

        echo "--- Environment ---"
        echo "Working Directory: $(pwd)"
        echo "ChadGI Directory: ${CHADGI_DIR:-unknown}"
        echo "Platform: $(uname -s 2>/dev/null || echo 'unknown')"
        echo "Date: $(date)"
    } > "$STATE_FILE" 2>&1

    return 0
}

# Create error summary file
# Usage: create_error_summary <diagnostics_dir> <error_type> <error_details>
create_error_summary() {
    local DIAG_DIR=$1
    local ERROR_TYPE=$2
    local ERROR_DETAILS=$3

    if [ -z "$DIAG_DIR" ] || [ ! -d "$DIAG_DIR" ]; then
        return 1
    fi

    local SUMMARY_FILE="${DIAG_DIR}/error-summary.txt"

    {
        echo "=== Error Summary ==="
        echo "Generated at: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
        echo ""
        echo "Error Type: ${ERROR_TYPE}"
        echo ""
        echo "Error Details:"
        echo "${ERROR_DETAILS}"
        echo ""
        echo "=== Diagnostic Files ==="
        echo "- error-summary.txt (this file)"
        echo "- git-diff.txt (changes attempted)"
        echo "- build-output.txt (last 50 lines of output)"
        echo "- system-state.txt (system snapshot)"
        echo ""
        echo "=== Quick Reference ==="
        case "$ERROR_TYPE" in
            "build_failure")
                echo "This error indicates test/build commands failed."
                echo "Check build-output.txt for specific error messages."
                ;;
            "timeout_failure")
                echo "This error indicates the task exceeded the time limit."
                echo "Consider increasing task_timeout in config or breaking the task into smaller parts."
                ;;
            "git_error")
                echo "This error indicates version control operations failed."
                echo "Common causes: merge conflicts, permission issues, or branch problems."
                ;;
            "api_error")
                echo "This error indicates GitHub API or external service failure."
                echo "Common causes: rate limits, authentication issues, or network problems."
                ;;
            "execution_error")
                echo "This error indicates a Claude execution issue."
                echo "Check system-state.txt and build-output.txt for more context."
                ;;
            *)
                echo "Unknown error type. Check all diagnostic files for more information."
                ;;
        esac
    } > "$SUMMARY_FILE" 2>&1

    return 0
}

# Collect all diagnostic artifacts for a failed task
# Usage: collect_diagnostics <issue_number> <error_type> <error_details> <output_file>
collect_diagnostics() {
    local ISSUE_NUM=$1
    local ERROR_TYPE=$2
    local ERROR_DETAILS=$3
    local OUTPUT_FILE=$4

    # Check if diagnostics are enabled
    if [ "$ERROR_DIAGNOSTICS" != "true" ]; then
        return 0
    fi

    log_step "Collecting diagnostic artifacts..."

    # Create diagnostics directory
    if ! create_diagnostics_dir "$ISSUE_NUM"; then
        log_warn "Could not create diagnostics directory"
        return 1
    fi

    # Collect all artifacts
    capture_git_diff "$DIAGNOSTICS_DIR"
    capture_build_output "$DIAGNOSTICS_DIR" "$OUTPUT_FILE" 50
    capture_system_state "$DIAGNOSTICS_DIR"
    create_error_summary "$DIAGNOSTICS_DIR" "$ERROR_TYPE" "$ERROR_DETAILS"

    log_success "Diagnostics saved to: $DIAGNOSTICS_DIR"

    return 0
}

# Display enhanced error report
# Usage: display_error_report <error_type> <error_details> <diagnostics_dir>
display_error_report() {
    local ERROR_TYPE=$1
    local ERROR_DETAILS=$2
    local DIAG_DIR=$3

    echo ""
    echo -e "${RED}${BOLD}==========================================================${NC}"
    echo -e "${RED}${BOLD}                   TASK FAILURE REPORT                    ${NC}"
    echo -e "${RED}${BOLD}==========================================================${NC}"
    echo ""

    # Error type with icon
    local ERROR_ICON=""
    case "$ERROR_TYPE" in
        "build_failure")   ERROR_ICON="[BUILD]" ;;
        "timeout_failure") ERROR_ICON="[TIMEOUT]" ;;
        "git_error")       ERROR_ICON="[GIT]" ;;
        "api_error")       ERROR_ICON="[API]" ;;
        "execution_error") ERROR_ICON="[EXEC]" ;;
        *)                 ERROR_ICON="[ERROR]" ;;
    esac

    echo -e "${RED}Error Type:${NC} ${ERROR_ICON} ${ERROR_TYPE}"
    echo ""

    echo -e "${RED}Error Details:${NC}"
    echo "  ${ERROR_DETAILS}"
    echo ""

    # Show diagnostics path if available
    if [ -n "$DIAG_DIR" ] && [ -d "$DIAG_DIR" ]; then
        echo -e "${CYAN}Diagnostics Path:${NC}"
        echo "  ${DIAG_DIR}"
        echo ""
        echo -e "${CYAN}Diagnostic Files:${NC}"
        ls -la "$DIAG_DIR" 2>/dev/null | tail -n +2 | sed 's/^/  /'
    fi

    echo ""
    echo -e "${RED}${BOLD}==========================================================${NC}"
}

#------------------------------------------------------------------------------
# Webhook Notifications
#------------------------------------------------------------------------------

# Rate limiting state
LAST_NOTIFICATION_TIME=0
NOTIFICATION_BURST_COUNT=0
NOTIFICATION_BURST_START=0

# Check if rate limit allows sending a notification
# Returns 0 if allowed, 1 if rate limited
check_notification_rate_limit() {
    local CURRENT_TIME=$(date +%s)

    # Check minimum interval
    local TIME_SINCE_LAST=$((CURRENT_TIME - LAST_NOTIFICATION_TIME))
    if [ $TIME_SINCE_LAST -lt $NOTIFY_RATE_MIN_INTERVAL ]; then
        log_info "Notification rate limited: ${TIME_SINCE_LAST}s since last (min: ${NOTIFY_RATE_MIN_INTERVAL}s)"
        return 1
    fi

    # Check burst limit
    local BURST_ELAPSED=$((CURRENT_TIME - NOTIFICATION_BURST_START))
    if [ $BURST_ELAPSED -gt $NOTIFY_RATE_BURST_WINDOW ]; then
        # Reset burst counter
        NOTIFICATION_BURST_COUNT=0
        NOTIFICATION_BURST_START=$CURRENT_TIME
    fi

    if [ $NOTIFICATION_BURST_COUNT -ge $NOTIFY_RATE_BURST_LIMIT ]; then
        log_info "Notification rate limited: burst limit reached (${NOTIFICATION_BURST_COUNT}/${NOTIFY_RATE_BURST_LIMIT})"
        return 1
    fi

    return 0
}

# Update rate limiting state after sending
update_notification_rate_limit() {
    LAST_NOTIFICATION_TIME=$(date +%s)
    NOTIFICATION_BURST_COUNT=$((NOTIFICATION_BURST_COUNT + 1))
    if [ $NOTIFICATION_BURST_START -eq 0 ]; then
        NOTIFICATION_BURST_START=$LAST_NOTIFICATION_TIME
    fi
}

# Send a generic webhook POST request
# Usage: send_webhook <url> <json_payload> [headers...]
send_webhook() {
    local URL=$1
    local PAYLOAD=$2
    shift 2
    local HEADERS=("$@")

    if [ -z "$URL" ]; then
        return 1
    fi

    # Build curl command
    local CURL_CMD="curl -s -X POST -H 'Content-Type: application/json'"

    # Add custom headers
    for HEADER in "${HEADERS[@]}"; do
        CURL_CMD="$CURL_CMD -H '$HEADER'"
    done

    # Add payload and URL
    CURL_CMD="$CURL_CMD -d '$PAYLOAD' '$URL'"

    # Execute (with timeout)
    local RESPONSE
    RESPONSE=$(timeout 10 bash -c "$CURL_CMD" 2>/dev/null)
    local EXIT_CODE=$?

    if [ $EXIT_CODE -eq 0 ]; then
        return 0
    else
        log_warn "Webhook request failed (exit code: $EXIT_CODE)"
        return 1
    fi
}

# Send Slack notification
# Usage: send_slack_notification <event_type> <title> <message> [color] [fields_json]
send_slack_notification() {
    local EVENT_TYPE=$1
    local TITLE=$2
    local MESSAGE=$3
    local COLOR=${4:-"#36a64f"}
    local FIELDS_JSON=${5:-"[]"}

    if [ "$SLACK_ENABLED" != "true" ] || [ -z "$SLACK_WEBHOOK_URL" ]; then
        return 0
    fi

    # Check event is enabled
    case "$EVENT_TYPE" in
        "task_started") [ "$SLACK_EVENT_TASK_STARTED" != "true" ] && return 0 ;;
        "task_completed") [ "$SLACK_EVENT_TASK_COMPLETED" != "true" ] && return 0 ;;
        "task_failed") [ "$SLACK_EVENT_TASK_FAILED" != "true" ] && return 0 ;;
        "gigachad_merge") [ "$SLACK_EVENT_GIGACHAD_MERGE" != "true" ] && return 0 ;;
        "session_ended") [ "$SLACK_EVENT_SESSION_ENDED" != "true" ] && return 0 ;;
    esac

    # Build Slack payload
    local TIMESTAMP=$(date +%s)
    local PAYLOAD=$(cat << SLACK_EOF
{
  "attachments": [
    {
      "color": "$COLOR",
      "title": "$TITLE",
      "text": "$MESSAGE",
      "fields": $FIELDS_JSON,
      "footer": "ChadGI | $CHAD_TAGLINE",
      "ts": $TIMESTAMP
    }
  ]
}
SLACK_EOF
)

    if send_webhook "$SLACK_WEBHOOK_URL" "$PAYLOAD"; then
        log_info "Slack notification sent: $EVENT_TYPE"
        return 0
    else
        log_warn "Failed to send Slack notification"
        return 1
    fi
}

# Send Discord notification
# Usage: send_discord_notification <event_type> <title> <message> [color] [fields_json]
send_discord_notification() {
    local EVENT_TYPE=$1
    local TITLE=$2
    local MESSAGE=$3
    local COLOR=${4:-"3066993"}  # Discord uses decimal colors
    local FIELDS_JSON=${5:-"[]"}

    if [ "$DISCORD_ENABLED" != "true" ] || [ -z "$DISCORD_WEBHOOK_URL" ]; then
        return 0
    fi

    # Check event is enabled
    case "$EVENT_TYPE" in
        "task_started") [ "$DISCORD_EVENT_TASK_STARTED" != "true" ] && return 0 ;;
        "task_completed") [ "$DISCORD_EVENT_TASK_COMPLETED" != "true" ] && return 0 ;;
        "task_failed") [ "$DISCORD_EVENT_TASK_FAILED" != "true" ] && return 0 ;;
        "gigachad_merge") [ "$DISCORD_EVENT_GIGACHAD_MERGE" != "true" ] && return 0 ;;
        "session_ended") [ "$DISCORD_EVENT_SESSION_ENDED" != "true" ] && return 0 ;;
    esac

    # Build Discord payload
    local TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    local PAYLOAD=$(cat << DISCORD_EOF
{
  "embeds": [
    {
      "title": "$TITLE",
      "description": "$MESSAGE",
      "color": $COLOR,
      "fields": $FIELDS_JSON,
      "footer": {
        "text": "ChadGI | $CHAD_TAGLINE"
      },
      "timestamp": "$TIMESTAMP"
    }
  ]
}
DISCORD_EOF
)

    if send_webhook "$DISCORD_WEBHOOK_URL" "$PAYLOAD"; then
        log_info "Discord notification sent: $EVENT_TYPE"
        return 0
    else
        log_warn "Failed to send Discord notification"
        return 1
    fi
}

# Send generic webhook notification
# Usage: send_generic_notification <event_type> <event_data_json>
send_generic_notification() {
    local EVENT_TYPE=$1
    local EVENT_DATA=$2

    if [ "$GENERIC_WEBHOOK_ENABLED" != "true" ] || [ -z "$GENERIC_WEBHOOK_URL" ]; then
        return 0
    fi

    # Check event is enabled
    case "$EVENT_TYPE" in
        "task_started") [ "$GENERIC_EVENT_TASK_STARTED" != "true" ] && return 0 ;;
        "task_completed") [ "$GENERIC_EVENT_TASK_COMPLETED" != "true" ] && return 0 ;;
        "task_failed") [ "$GENERIC_EVENT_TASK_FAILED" != "true" ] && return 0 ;;
        "gigachad_merge") [ "$GENERIC_EVENT_GIGACHAD_MERGE" != "true" ] && return 0 ;;
        "session_ended") [ "$GENERIC_EVENT_SESSION_ENDED" != "true" ] && return 0 ;;
    esac

    # Build generic payload
    local TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    local PAYLOAD=$(cat << GENERIC_EOF
{
  "event": "$EVENT_TYPE",
  "timestamp": "$TIMESTAMP",
  "repo": "$REPO",
  "source": "chadgi",
  "data": $EVENT_DATA
}
GENERIC_EOF
)

    if send_webhook "$GENERIC_WEBHOOK_URL" "$PAYLOAD"; then
        log_info "Generic webhook notification sent: $EVENT_TYPE"
        return 0
    else
        log_warn "Failed to send generic webhook notification"
        return 1
    fi
}

# Send notification to all configured channels
# Usage: notify_event <event_type> <title> <message> [slack_color] [discord_color] [event_data_json]
notify_event() {
    local EVENT_TYPE=$1
    local TITLE=$2
    local MESSAGE=$3
    local SLACK_COLOR=${4:-"#36a64f"}
    local DISCORD_COLOR=${5:-"3066993"}
    local EVENT_DATA=${6:-"{}"}

    # Skip if notifications disabled
    if [ "$NOTIFICATIONS_ENABLED" != "true" ]; then
        return 0
    fi

    # Check rate limit
    if ! check_notification_rate_limit; then
        return 0
    fi

    local SENT=false

    # Escape message for JSON (basic escaping)
    local ESCAPED_TITLE=$(echo "$TITLE" | sed 's/"/\\"/g' | tr '\n' ' ')
    local ESCAPED_MESSAGE=$(echo "$MESSAGE" | sed 's/"/\\"/g' | tr '\n' ' ')

    # Send to Slack
    if [ "$SLACK_ENABLED" = "true" ] && [ -n "$SLACK_WEBHOOK_URL" ]; then
        send_slack_notification "$EVENT_TYPE" "$ESCAPED_TITLE" "$ESCAPED_MESSAGE" "$SLACK_COLOR" "[]"
        SENT=true
    fi

    # Send to Discord
    if [ "$DISCORD_ENABLED" = "true" ] && [ -n "$DISCORD_WEBHOOK_URL" ]; then
        send_discord_notification "$EVENT_TYPE" "$ESCAPED_TITLE" "$ESCAPED_MESSAGE" "$DISCORD_COLOR" "[]"
        SENT=true
    fi

    # Send to generic webhook
    if [ "$GENERIC_WEBHOOK_ENABLED" = "true" ] && [ -n "$GENERIC_WEBHOOK_URL" ]; then
        send_generic_notification "$EVENT_TYPE" "$EVENT_DATA"
        SENT=true
    fi

    # Update rate limit if we sent something
    if [ "$SENT" = "true" ]; then
        update_notification_rate_limit
    fi
}

# Convenience functions for specific events
notify_task_started() {
    local ISSUE_NUM=$1
    local TITLE=$2
    local URL=$3
    local PRIORITY=${4:-""}

    local TITLE_TEXT="Task Started: #${ISSUE_NUM}"
    local MESSAGE="Working on: ${TITLE}\n${URL}"

    # Include priority in message if available
    if [ -n "$PRIORITY" ]; then
        TITLE_TEXT="Task Started: #${ISSUE_NUM} (priority: ${PRIORITY})"
        MESSAGE="Working on: ${TITLE}\nPriority: ${PRIORITY}\n${URL}"
    fi

    local EVENT_DATA="{\"issue_number\": ${ISSUE_NUM}, \"title\": \"${TITLE}\", \"url\": \"${URL}\", \"priority\": \"${PRIORITY}\"}"

    notify_event "task_started" "$TITLE_TEXT" "$MESSAGE" "#3498db" "3447003" "$EVENT_DATA"
}

notify_task_completed() {
    local ISSUE_NUM=$1
    local TITLE=$2
    local PR_URL=${3:-""}

    local TITLE_TEXT="Task Completed: #${ISSUE_NUM}"
    local MESSAGE="Completed: ${TITLE}"
    [ -n "$PR_URL" ] && MESSAGE="${MESSAGE}\nPR: ${PR_URL}"
    local EVENT_DATA="{\"issue_number\": ${ISSUE_NUM}, \"title\": \"${TITLE}\", \"pr_url\": \"${PR_URL}\"}"

    notify_event "task_completed" "$TITLE_TEXT" "$MESSAGE" "#2ecc71" "3066993" "$EVENT_DATA"
}

notify_task_failed() {
    local ISSUE_NUM=$1
    local TITLE=$2
    local REASON=$3
    local ITERATIONS=$4

    local TITLE_TEXT="Task Failed: #${ISSUE_NUM}"
    local MESSAGE="Failed: ${TITLE}\nReason: ${REASON}\nIterations: ${ITERATIONS}"
    local EVENT_DATA="{\"issue_number\": ${ISSUE_NUM}, \"title\": \"${TITLE}\", \"reason\": \"${REASON}\", \"iterations\": ${ITERATIONS}}"

    notify_event "task_failed" "$TITLE_TEXT" "$MESSAGE" "#e74c3c" "15158332" "$EVENT_DATA"
}

notify_gigachad_merge() {
    local PR_NUM=$1
    local COMMIT_SHA=$2

    local TITLE_TEXT="GigaChad Merge: PR #${PR_NUM}"
    local MESSAGE="Auto-merged PR #${PR_NUM}\nCommit: ${COMMIT_SHA}"
    local EVENT_DATA="{\"pr_number\": ${PR_NUM}, \"commit_sha\": \"${COMMIT_SHA}\"}"

    notify_event "gigachad_merge" "$TITLE_TEXT" "$MESSAGE" "#9b59b6" "10181046" "$EVENT_DATA"
}

notify_session_ended() {
    local TASKS_COMPLETED=$1
    local TASKS_FAILED=$2
    local DURATION_SECS=$3
    local TOTAL_COST_USD=$4

    local TITLE_TEXT="ChadGI Session Ended"
    local MESSAGE="Completed: ${TASKS_COMPLETED} tasks\nFailed: ${TASKS_FAILED} tasks\nDuration: $(format_duration $DURATION_SECS)\nCost: \$${TOTAL_COST_USD}"
    local EVENT_DATA="{\"tasks_completed\": ${TASKS_COMPLETED}, \"tasks_failed\": ${TASKS_FAILED}, \"duration_secs\": ${DURATION_SECS}, \"total_cost_usd\": ${TOTAL_COST_USD}}"

    notify_event "session_ended" "$TITLE_TEXT" "$MESSAGE" "#95a5a6" "10070709" "$EVENT_DATA"
}

notify_budget_warning() {
    local BUDGET_TYPE=$1      # "task" or "session"
    local CURRENT_COST=$2
    local LIMIT=$3
    local PERCENTAGE=$4
    local ISSUE_NUM=${5:-""}

    local TITLE_TEXT="Budget Warning: ${BUDGET_TYPE^} approaching limit"
    local MESSAGE="Current cost: \$${CURRENT_COST}\nLimit: \$${LIMIT}\nUsage: ${PERCENTAGE}%"
    [ -n "$ISSUE_NUM" ] && MESSAGE="${MESSAGE}\nTask: #${ISSUE_NUM}"
    local EVENT_DATA="{\"budget_type\": \"${BUDGET_TYPE}\", \"current_cost\": ${CURRENT_COST}, \"limit\": ${LIMIT}, \"percentage\": ${PERCENTAGE}, \"issue_number\": ${ISSUE_NUM:-null}}"

    notify_event "budget_warning" "$TITLE_TEXT" "$MESSAGE" "#f39c12" "15844367" "$EVENT_DATA"
}

notify_budget_exceeded() {
    local BUDGET_TYPE=$1      # "task" or "session"
    local CURRENT_COST=$2
    local LIMIT=$3
    local ACTION=$4           # "skip", "fail", "stop", "warn"
    local ISSUE_NUM=${5:-""}

    local TITLE_TEXT="Budget Exceeded: ${BUDGET_TYPE^} limit reached"
    local MESSAGE="Cost: \$${CURRENT_COST}\nLimit: \$${LIMIT}\nAction: ${ACTION}"
    [ -n "$ISSUE_NUM" ] && MESSAGE="${MESSAGE}\nTask: #${ISSUE_NUM}"
    local EVENT_DATA="{\"budget_type\": \"${BUDGET_TYPE}\", \"current_cost\": ${CURRENT_COST}, \"limit\": ${LIMIT}, \"action\": \"${ACTION}\", \"issue_number\": ${ISSUE_NUM:-null}}"

    notify_event "budget_exceeded" "$TITLE_TEXT" "$MESSAGE" "#e74c3c" "15158332" "$EVENT_DATA"
}

# Test webhook connectivity
# Usage: test_webhook_connectivity
# Returns 0 if at least one webhook works, 1 if all fail or none configured
test_webhook_connectivity() {
    local ANY_SUCCESS=false
    local ANY_CONFIGURED=false

    log_step "Testing webhook connectivity..."

    # Test Slack
    if [ "$SLACK_ENABLED" = "true" ] && [ -n "$SLACK_WEBHOOK_URL" ]; then
        ANY_CONFIGURED=true
        log_info "Testing Slack webhook..."
        local SLACK_PAYLOAD='{"text": "ChadGI webhook test - connection successful!"}'
        if send_webhook "$SLACK_WEBHOOK_URL" "$SLACK_PAYLOAD"; then
            log_success "Slack webhook: OK"
            ANY_SUCCESS=true
        else
            log_error "Slack webhook: FAILED"
        fi
    fi

    # Test Discord
    if [ "$DISCORD_ENABLED" = "true" ] && [ -n "$DISCORD_WEBHOOK_URL" ]; then
        ANY_CONFIGURED=true
        log_info "Testing Discord webhook..."
        local DISCORD_PAYLOAD='{"content": "ChadGI webhook test - connection successful!"}'
        if send_webhook "$DISCORD_WEBHOOK_URL" "$DISCORD_PAYLOAD"; then
            log_success "Discord webhook: OK"
            ANY_SUCCESS=true
        else
            log_error "Discord webhook: FAILED"
        fi
    fi

    # Test Generic
    if [ "$GENERIC_WEBHOOK_ENABLED" = "true" ] && [ -n "$GENERIC_WEBHOOK_URL" ]; then
        ANY_CONFIGURED=true
        log_info "Testing generic webhook..."
        local GENERIC_PAYLOAD='{"event": "test", "message": "ChadGI webhook test - connection successful!", "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}'
        if send_webhook "$GENERIC_WEBHOOK_URL" "$GENERIC_PAYLOAD"; then
            log_success "Generic webhook: OK"
            ANY_SUCCESS=true
        else
            log_error "Generic webhook: FAILED"
        fi
    fi

    if [ "$ANY_CONFIGURED" = "false" ]; then
        log_warn "No webhooks configured"
        return 1
    fi

    if [ "$ANY_SUCCESS" = "true" ]; then
        return 0
    else
        return 1
    fi
}

#------------------------------------------------------------------------------
# Lifecycle Hooks System
#------------------------------------------------------------------------------

# Hook configuration state variables
HOOK_PRE_TASK_SCRIPT=""
HOOK_PRE_TASK_TIMEOUT=30
HOOK_PRE_TASK_CAN_ABORT=false
HOOK_PRE_TASK_ENABLED=true

HOOK_POST_IMPL_SCRIPT=""
HOOK_POST_IMPL_TIMEOUT=30
HOOK_POST_IMPL_CAN_ABORT=false
HOOK_POST_IMPL_ENABLED=true

HOOK_PRE_PR_SCRIPT=""
HOOK_PRE_PR_TIMEOUT=30
HOOK_PRE_PR_CAN_ABORT=false
HOOK_PRE_PR_ENABLED=true

HOOK_POST_PR_SCRIPT=""
HOOK_POST_PR_TIMEOUT=30
HOOK_POST_PR_CAN_ABORT=false
HOOK_POST_PR_ENABLED=true

HOOK_POST_MERGE_SCRIPT=""
HOOK_POST_MERGE_TIMEOUT=30
HOOK_POST_MERGE_CAN_ABORT=false
HOOK_POST_MERGE_ENABLED=true

HOOK_ON_FAILURE_SCRIPT=""
HOOK_ON_FAILURE_TIMEOUT=30
HOOK_ON_FAILURE_CAN_ABORT=false
HOOK_ON_FAILURE_ENABLED=true

HOOK_ON_BUDGET_WARNING_SCRIPT=""
HOOK_ON_BUDGET_WARNING_TIMEOUT=10
HOOK_ON_BUDGET_WARNING_CAN_ABORT=false
HOOK_ON_BUDGET_WARNING_ENABLED=true

# Parse hook configuration from config files
# Usage: parse_hook_config <hook_name> <config_files...>
# Sets: HOOK_<UPPER_NAME>_SCRIPT, HOOK_<UPPER_NAME>_TIMEOUT, etc.
parse_hook_config() {
    local HOOK_NAME=$1
    shift
    local CONFIG_FILES=("$@")

    # Convert hook name for YAML parsing (e.g., "pre_task" stays as is)
    local YAML_NAME="$HOOK_NAME"
    # Convert for variable names (e.g., "pre_task" -> "PRE_TASK")
    local VAR_PREFIX="HOOK_$(echo "$HOOK_NAME" | tr '[:lower:]' '[:upper:]')"

    # Parse values from config files (last value wins, for inheritance)
    local SCRIPT=""
    local TIMEOUT=""
    local CAN_ABORT=""
    local ENABLED=""

    for CONFIG_FILE in "${CONFIG_FILES[@]}"; do
        if [ -f "$CONFIG_FILE" ]; then
            local VAL
            # Script path
            VAL=$(awk -v hook="$YAML_NAME" '
                /^hooks:/ { in_hooks=1; next }
                in_hooks && /^[a-z]/ { in_hooks=0; in_hook=0 }
                in_hooks && $0 ~ "^  "hook":" { in_hook=1; next }
                in_hooks && in_hook && /^  [a-z]/ { in_hook=0 }
                in_hooks && in_hook && /^    script:/ {
                    gsub(/^    script: */, "");
                    gsub(/ *#.*/, "");
                    gsub(/"/, "");
                    gsub(/'\''/, "");
                    print;
                    exit
                }
            ' "$CONFIG_FILE" 2>/dev/null)
            [ -n "$VAL" ] && SCRIPT="$VAL"

            # Timeout
            VAL=$(awk -v hook="$YAML_NAME" '
                /^hooks:/ { in_hooks=1; next }
                in_hooks && /^[a-z]/ { in_hooks=0; in_hook=0 }
                in_hooks && $0 ~ "^  "hook":" { in_hook=1; next }
                in_hooks && in_hook && /^  [a-z]/ { in_hook=0 }
                in_hooks && in_hook && /^    timeout:/ {
                    gsub(/^    timeout: */, "");
                    gsub(/ *#.*/, "");
                    print;
                    exit
                }
            ' "$CONFIG_FILE" 2>/dev/null)
            [ -n "$VAL" ] && TIMEOUT="$VAL"

            # Can abort
            VAL=$(awk -v hook="$YAML_NAME" '
                /^hooks:/ { in_hooks=1; next }
                in_hooks && /^[a-z]/ { in_hooks=0; in_hook=0 }
                in_hooks && $0 ~ "^  "hook":" { in_hook=1; next }
                in_hooks && in_hook && /^  [a-z]/ { in_hook=0 }
                in_hooks && in_hook && /^    can_abort:/ {
                    gsub(/^    can_abort: */, "");
                    gsub(/ *#.*/, "");
                    print;
                    exit
                }
            ' "$CONFIG_FILE" 2>/dev/null)
            [ -n "$VAL" ] && CAN_ABORT="$VAL"

            # Enabled
            VAL=$(awk -v hook="$YAML_NAME" '
                /^hooks:/ { in_hooks=1; next }
                in_hooks && /^[a-z]/ { in_hooks=0; in_hook=0 }
                in_hooks && $0 ~ "^  "hook":" { in_hook=1; next }
                in_hooks && in_hook && /^  [a-z]/ { in_hook=0 }
                in_hooks && in_hook && /^    enabled:/ {
                    gsub(/^    enabled: */, "");
                    gsub(/ *#.*/, "");
                    print;
                    exit
                }
            ' "$CONFIG_FILE" 2>/dev/null)
            [ -n "$VAL" ] && ENABLED="$VAL"
        fi
    done

    # Set global variables based on hook name
    case "$HOOK_NAME" in
        "pre_task")
            HOOK_PRE_TASK_SCRIPT="$SCRIPT"
            [ -n "$TIMEOUT" ] && HOOK_PRE_TASK_TIMEOUT="$TIMEOUT"
            [ "$CAN_ABORT" = "true" ] && HOOK_PRE_TASK_CAN_ABORT=true || [ "$CAN_ABORT" = "false" ] && HOOK_PRE_TASK_CAN_ABORT=false || true
            [ "$ENABLED" = "false" ] && HOOK_PRE_TASK_ENABLED=false || [ "$ENABLED" = "true" ] && HOOK_PRE_TASK_ENABLED=true || true
            ;;
        "post_implementation")
            HOOK_POST_IMPL_SCRIPT="$SCRIPT"
            [ -n "$TIMEOUT" ] && HOOK_POST_IMPL_TIMEOUT="$TIMEOUT"
            [ "$CAN_ABORT" = "true" ] && HOOK_POST_IMPL_CAN_ABORT=true || [ "$CAN_ABORT" = "false" ] && HOOK_POST_IMPL_CAN_ABORT=false || true
            [ "$ENABLED" = "false" ] && HOOK_POST_IMPL_ENABLED=false || [ "$ENABLED" = "true" ] && HOOK_POST_IMPL_ENABLED=true || true
            ;;
        "pre_pr")
            HOOK_PRE_PR_SCRIPT="$SCRIPT"
            [ -n "$TIMEOUT" ] && HOOK_PRE_PR_TIMEOUT="$TIMEOUT"
            [ "$CAN_ABORT" = "true" ] && HOOK_PRE_PR_CAN_ABORT=true || [ "$CAN_ABORT" = "false" ] && HOOK_PRE_PR_CAN_ABORT=false || true
            [ "$ENABLED" = "false" ] && HOOK_PRE_PR_ENABLED=false || [ "$ENABLED" = "true" ] && HOOK_PRE_PR_ENABLED=true || true
            ;;
        "post_pr")
            HOOK_POST_PR_SCRIPT="$SCRIPT"
            [ -n "$TIMEOUT" ] && HOOK_POST_PR_TIMEOUT="$TIMEOUT"
            [ "$CAN_ABORT" = "true" ] && HOOK_POST_PR_CAN_ABORT=true || [ "$CAN_ABORT" = "false" ] && HOOK_POST_PR_CAN_ABORT=false || true
            [ "$ENABLED" = "false" ] && HOOK_POST_PR_ENABLED=false || [ "$ENABLED" = "true" ] && HOOK_POST_PR_ENABLED=true || true
            ;;
        "post_merge")
            HOOK_POST_MERGE_SCRIPT="$SCRIPT"
            [ -n "$TIMEOUT" ] && HOOK_POST_MERGE_TIMEOUT="$TIMEOUT"
            [ "$CAN_ABORT" = "true" ] && HOOK_POST_MERGE_CAN_ABORT=true || [ "$CAN_ABORT" = "false" ] && HOOK_POST_MERGE_CAN_ABORT=false || true
            [ "$ENABLED" = "false" ] && HOOK_POST_MERGE_ENABLED=false || [ "$ENABLED" = "true" ] && HOOK_POST_MERGE_ENABLED=true || true
            ;;
        "on_failure")
            HOOK_ON_FAILURE_SCRIPT="$SCRIPT"
            [ -n "$TIMEOUT" ] && HOOK_ON_FAILURE_TIMEOUT="$TIMEOUT"
            [ "$CAN_ABORT" = "true" ] && HOOK_ON_FAILURE_CAN_ABORT=true || [ "$CAN_ABORT" = "false" ] && HOOK_ON_FAILURE_CAN_ABORT=false || true
            [ "$ENABLED" = "false" ] && HOOK_ON_FAILURE_ENABLED=false || [ "$ENABLED" = "true" ] && HOOK_ON_FAILURE_ENABLED=true || true
            ;;
        "on_budget_warning")
            HOOK_ON_BUDGET_WARNING_SCRIPT="$SCRIPT"
            [ -n "$TIMEOUT" ] && HOOK_ON_BUDGET_WARNING_TIMEOUT="$TIMEOUT"
            [ "$CAN_ABORT" = "true" ] && HOOK_ON_BUDGET_WARNING_CAN_ABORT=true || [ "$CAN_ABORT" = "false" ] && HOOK_ON_BUDGET_WARNING_CAN_ABORT=false || true
            [ "$ENABLED" = "false" ] && HOOK_ON_BUDGET_WARNING_ENABLED=false || [ "$ENABLED" = "true" ] && HOOK_ON_BUDGET_WARNING_ENABLED=true || true
            ;;
    esac
}

# Load all hook configurations from config files
load_hooks_config() {
    local CONFIG_FILES=("$@")

    parse_hook_config "pre_task" "${CONFIG_FILES[@]}"
    parse_hook_config "post_implementation" "${CONFIG_FILES[@]}"
    parse_hook_config "pre_pr" "${CONFIG_FILES[@]}"
    parse_hook_config "post_pr" "${CONFIG_FILES[@]}"
    parse_hook_config "post_merge" "${CONFIG_FILES[@]}"
    parse_hook_config "on_failure" "${CONFIG_FILES[@]}"
    parse_hook_config "on_budget_warning" "${CONFIG_FILES[@]}"

    log_debug "Hooks config loaded:"
    log_debug "  pre_task: script=$HOOK_PRE_TASK_SCRIPT, timeout=$HOOK_PRE_TASK_TIMEOUT, can_abort=$HOOK_PRE_TASK_CAN_ABORT, enabled=$HOOK_PRE_TASK_ENABLED"
    log_debug "  post_implementation: script=$HOOK_POST_IMPL_SCRIPT, timeout=$HOOK_POST_IMPL_TIMEOUT, enabled=$HOOK_POST_IMPL_ENABLED"
    log_debug "  pre_pr: script=$HOOK_PRE_PR_SCRIPT, timeout=$HOOK_PRE_PR_TIMEOUT, can_abort=$HOOK_PRE_PR_CAN_ABORT, enabled=$HOOK_PRE_PR_ENABLED"
    log_debug "  post_pr: script=$HOOK_POST_PR_SCRIPT, timeout=$HOOK_POST_PR_TIMEOUT, enabled=$HOOK_POST_PR_ENABLED"
    log_debug "  post_merge: script=$HOOK_POST_MERGE_SCRIPT, timeout=$HOOK_POST_MERGE_TIMEOUT, enabled=$HOOK_POST_MERGE_ENABLED"
    log_debug "  on_failure: script=$HOOK_ON_FAILURE_SCRIPT, timeout=$HOOK_ON_FAILURE_TIMEOUT, enabled=$HOOK_ON_FAILURE_ENABLED"
    log_debug "  on_budget_warning: script=$HOOK_ON_BUDGET_WARNING_SCRIPT, timeout=$HOOK_ON_BUDGET_WARNING_TIMEOUT, enabled=$HOOK_ON_BUDGET_WARNING_ENABLED"
}

# Resolve hook script path (relative to CHADGI_DIR or absolute)
# Usage: resolve_hook_script <script_path>
# Returns: absolute path to script
resolve_hook_script() {
    local SCRIPT_PATH=$1

    if [ -z "$SCRIPT_PATH" ]; then
        echo ""
        return
    fi

    # If already absolute, return as is
    if [[ "$SCRIPT_PATH" == /* ]]; then
        echo "$SCRIPT_PATH"
        return
    fi

    # Resolve relative to CHADGI_DIR
    echo "$CHADGI_DIR/$SCRIPT_PATH"
}

# Execute a lifecycle hook
# Usage: run_hook <hook_name>
# Environment variables are set before execution:
#   CHADGI_ISSUE_NUMBER, CHADGI_BRANCH, CHADGI_PR_URL, CHADGI_COST,
#   CHADGI_PHASE, CHADGI_REPO, CHADGI_HOOK_NAME
# Returns: 0 if hook succeeded or not configured, non-zero if hook failed and can_abort is true
run_hook() {
    local HOOK_NAME=$1
    local SCRIPT=""
    local TIMEOUT=30
    local CAN_ABORT=false
    local ENABLED=true

    # Get hook configuration based on name
    case "$HOOK_NAME" in
        "pre_task")
            SCRIPT="$HOOK_PRE_TASK_SCRIPT"
            TIMEOUT="$HOOK_PRE_TASK_TIMEOUT"
            CAN_ABORT="$HOOK_PRE_TASK_CAN_ABORT"
            ENABLED="$HOOK_PRE_TASK_ENABLED"
            ;;
        "post_implementation")
            SCRIPT="$HOOK_POST_IMPL_SCRIPT"
            TIMEOUT="$HOOK_POST_IMPL_TIMEOUT"
            CAN_ABORT="$HOOK_POST_IMPL_CAN_ABORT"
            ENABLED="$HOOK_POST_IMPL_ENABLED"
            ;;
        "pre_pr")
            SCRIPT="$HOOK_PRE_PR_SCRIPT"
            TIMEOUT="$HOOK_PRE_PR_TIMEOUT"
            CAN_ABORT="$HOOK_PRE_PR_CAN_ABORT"
            ENABLED="$HOOK_PRE_PR_ENABLED"
            ;;
        "post_pr")
            SCRIPT="$HOOK_POST_PR_SCRIPT"
            TIMEOUT="$HOOK_POST_PR_TIMEOUT"
            CAN_ABORT="$HOOK_POST_PR_CAN_ABORT"
            ENABLED="$HOOK_POST_PR_ENABLED"
            ;;
        "post_merge")
            SCRIPT="$HOOK_POST_MERGE_SCRIPT"
            TIMEOUT="$HOOK_POST_MERGE_TIMEOUT"
            CAN_ABORT="$HOOK_POST_MERGE_CAN_ABORT"
            ENABLED="$HOOK_POST_MERGE_ENABLED"
            ;;
        "on_failure")
            SCRIPT="$HOOK_ON_FAILURE_SCRIPT"
            TIMEOUT="$HOOK_ON_FAILURE_TIMEOUT"
            CAN_ABORT="$HOOK_ON_FAILURE_CAN_ABORT"
            ENABLED="$HOOK_ON_FAILURE_ENABLED"
            ;;
        "on_budget_warning")
            SCRIPT="$HOOK_ON_BUDGET_WARNING_SCRIPT"
            TIMEOUT="$HOOK_ON_BUDGET_WARNING_TIMEOUT"
            CAN_ABORT="$HOOK_ON_BUDGET_WARNING_CAN_ABORT"
            ENABLED="$HOOK_ON_BUDGET_WARNING_ENABLED"
            ;;
        *)
            log_warn "Unknown hook: $HOOK_NAME"
            return 0
            ;;
    esac

    # Skip if no script configured
    if [ -z "$SCRIPT" ]; then
        log_debug "Hook $HOOK_NAME: not configured (no script)"
        return 0
    fi

    # Skip if disabled
    if [ "$ENABLED" != "true" ]; then
        log_debug "Hook $HOOK_NAME: disabled"
        return 0
    fi

    # Resolve script path
    local RESOLVED_SCRIPT
    RESOLVED_SCRIPT=$(resolve_hook_script "$SCRIPT")

    # Check if script exists and is executable
    if [ ! -f "$RESOLVED_SCRIPT" ]; then
        log_warn "Hook $HOOK_NAME: script not found: $RESOLVED_SCRIPT"
        return 0
    fi

    if [ ! -x "$RESOLVED_SCRIPT" ]; then
        log_warn "Hook $HOOK_NAME: script not executable: $RESOLVED_SCRIPT"
        log_info "Run: chmod +x $RESOLVED_SCRIPT"
        return 0
    fi

    log_step "Running hook: $HOOK_NAME"
    log_debug "  Script: $RESOLVED_SCRIPT"
    log_debug "  Timeout: ${TIMEOUT}s"
    log_debug "  Can abort: $CAN_ABORT"

    # Set up environment variables for the hook
    local HOOK_START_TIME=$(date +%s)
    local HOOK_OUTPUT
    local HOOK_EXIT_CODE

    # Execute hook with timeout and capture output
    HOOK_OUTPUT=$(
        export CHADGI_ISSUE_NUMBER="${ISSUE_NUMBER:-}"
        export CHADGI_BRANCH="${BRANCH_NAME:-}"
        export CHADGI_PR_URL="${COMPLETED_PR_URL:-}"
        export CHADGI_COST="${TASK_COST:-0}"
        export CHADGI_SESSION_COST="${TOTAL_COST:-0}"
        export CHADGI_PHASE="$HOOK_NAME"
        export CHADGI_REPO="${REPO:-}"
        export CHADGI_HOOK_NAME="$HOOK_NAME"
        export CHADGI_ISSUE_TITLE="${ISSUE_TITLE:-}"
        export CHADGI_ISSUE_URL="${ISSUE_URL:-}"
        export CHADGI_BASE_BRANCH="${BASE_BRANCH:-main}"
        export CHADGI_ITERATION="${ITERATION:-1}"
        export CHADGI_MAX_ITERATIONS="${MAX_ITERATIONS:-5}"

        timeout "$TIMEOUT" "$RESOLVED_SCRIPT" 2>&1
    )
    HOOK_EXIT_CODE=$?

    local HOOK_END_TIME=$(date +%s)
    local HOOK_DURATION=$((HOOK_END_TIME - HOOK_START_TIME))

    # Log hook execution to structured log
    if [ $HOOK_EXIT_CODE -eq 0 ]; then
        log_success "Hook $HOOK_NAME completed successfully (${HOOK_DURATION}s)"
        if [ -n "$HOOK_OUTPUT" ]; then
            log_debug "Hook output: $(echo "$HOOK_OUTPUT" | head -10)"
        fi
        return 0
    elif [ $HOOK_EXIT_CODE -eq 124 ]; then
        # Timeout exit code
        log_warn "Hook $HOOK_NAME timed out after ${TIMEOUT}s"
        if [ "$CAN_ABORT" = "true" ]; then
            log_error "Hook $HOOK_NAME: aborting due to timeout (can_abort=true)"
            return 1
        fi
        return 0
    else
        log_warn "Hook $HOOK_NAME failed with exit code $HOOK_EXIT_CODE (${HOOK_DURATION}s)"
        if [ -n "$HOOK_OUTPUT" ]; then
            log_info "Hook output:"
            echo "$HOOK_OUTPUT" | head -20 | sed 's/^/  /'
        fi

        if [ "$CAN_ABORT" = "true" ]; then
            log_error "Hook $HOOK_NAME: aborting due to non-zero exit (can_abort=true)"
            return $HOOK_EXIT_CODE
        fi

        log_info "Continuing despite hook failure (can_abort=false)"
        return 0
    fi
}

# Check if any hooks are configured
has_hooks_configured() {
    [ -n "$HOOK_PRE_TASK_SCRIPT" ] || \
    [ -n "$HOOK_POST_IMPL_SCRIPT" ] || \
    [ -n "$HOOK_PRE_PR_SCRIPT" ] || \
    [ -n "$HOOK_POST_PR_SCRIPT" ] || \
    [ -n "$HOOK_POST_MERGE_SCRIPT" ] || \
    [ -n "$HOOK_ON_FAILURE_SCRIPT" ] || \
    [ -n "$HOOK_ON_BUDGET_WARNING_SCRIPT" ]
}

#------------------------------------------------------------------------------
# Budget Management
#------------------------------------------------------------------------------

# State variables for budget warning tracking (to avoid repeated warnings)
TASK_BUDGET_WARNING_SENT=false
SESSION_BUDGET_WARNING_SENT=false

# Check if budget limits are enabled (non-empty values)
is_budget_enabled() {
    [ -n "$BUDGET_PER_TASK_LIMIT" ] || [ -n "$BUDGET_PER_SESSION_LIMIT" ]
}

is_task_budget_enabled() {
    [ -n "$BUDGET_PER_TASK_LIMIT" ]
}

is_session_budget_enabled() {
    [ -n "$BUDGET_PER_SESSION_LIMIT" ]
}

# Calculate percentage of budget used
# Usage: calculate_budget_percentage <current> <limit>
# Returns: integer percentage (0-100+)
calculate_budget_percentage() {
    local CURRENT=$1
    local LIMIT=$2

    if [ -z "$LIMIT" ] || [ "$LIMIT" = "0" ]; then
        echo "0"
        return
    fi

    # Use bc for floating point math, multiply by 100 and truncate to integer
    local PERCENTAGE=$(echo "scale=0; ($CURRENT * 100) / $LIMIT" | bc 2>/dev/null || echo "0")
    echo "$PERCENTAGE"
}

# Check if task budget warning threshold is reached
# Usage: check_task_budget_warning <current_task_cost>
# Returns: 0 if warning should be issued, 1 otherwise
check_task_budget_warning() {
    local CURRENT_COST=$1

    if ! is_task_budget_enabled; then
        return 1
    fi

    if [ "$TASK_BUDGET_WARNING_SENT" = "true" ]; then
        return 1
    fi

    local PERCENTAGE=$(calculate_budget_percentage "$CURRENT_COST" "$BUDGET_PER_TASK_LIMIT")

    if [ "$PERCENTAGE" -ge "$BUDGET_WARNING_THRESHOLD" ] && [ "$PERCENTAGE" -lt 100 ]; then
        return 0
    fi

    return 1
}

# Check if session budget warning threshold is reached
# Usage: check_session_budget_warning <total_session_cost>
# Returns: 0 if warning should be issued, 1 otherwise
check_session_budget_warning() {
    local CURRENT_COST=$1

    if ! is_session_budget_enabled; then
        return 1
    fi

    if [ "$SESSION_BUDGET_WARNING_SENT" = "true" ]; then
        return 1
    fi

    local PERCENTAGE=$(calculate_budget_percentage "$CURRENT_COST" "$BUDGET_PER_SESSION_LIMIT")

    if [ "$PERCENTAGE" -ge "$BUDGET_WARNING_THRESHOLD" ] && [ "$PERCENTAGE" -lt 100 ]; then
        return 0
    fi

    return 1
}

# Check if task budget is exceeded
# Usage: check_task_budget_exceeded <current_task_cost>
# Returns: 0 if budget exceeded, 1 otherwise
check_task_budget_exceeded() {
    local CURRENT_COST=$1

    if ! is_task_budget_enabled; then
        return 1
    fi

    # Compare using bc for floating point
    local EXCEEDED=$(echo "$CURRENT_COST >= $BUDGET_PER_TASK_LIMIT" | bc 2>/dev/null || echo "0")

    [ "$EXCEEDED" = "1" ]
}

# Check if session budget is exceeded
# Usage: check_session_budget_exceeded <total_session_cost>
# Returns: 0 if budget exceeded, 1 otherwise
check_session_budget_exceeded() {
    local CURRENT_COST=$1

    if ! is_session_budget_enabled; then
        return 1
    fi

    # Compare using bc for floating point
    local EXCEEDED=$(echo "$CURRENT_COST >= $BUDGET_PER_SESSION_LIMIT" | bc 2>/dev/null || echo "0")

    [ "$EXCEEDED" = "1" ]
}

# Handle task budget exceeded
# Usage: handle_task_budget_exceeded <current_task_cost> <issue_number>
# Returns: 0 if task should be skipped/failed, 1 if continue (warn mode)
handle_task_budget_exceeded() {
    local CURRENT_COST=$1
    local ISSUE_NUMBER=$2

    log_error "Task budget exceeded: \$${CURRENT_COST} >= \$${BUDGET_PER_TASK_LIMIT}"
    notify_budget_exceeded "task" "$CURRENT_COST" "$BUDGET_PER_TASK_LIMIT" "$BUDGET_ON_TASK_EXCEEDED" "$ISSUE_NUMBER"

    case "$BUDGET_ON_TASK_EXCEEDED" in
        "skip")
            log_warn "Action: Skipping task #${ISSUE_NUMBER} (on_task_budget_exceeded: skip)"
            return 0
            ;;
        "fail")
            log_warn "Action: Failing task #${ISSUE_NUMBER} (on_task_budget_exceeded: fail)"
            return 0
            ;;
        "warn")
            log_warn "Action: Continuing despite budget (on_task_budget_exceeded: warn)"
            return 1
            ;;
        *)
            log_warn "Unknown action '${BUDGET_ON_TASK_EXCEEDED}', defaulting to skip"
            return 0
            ;;
    esac
}

# Handle session budget exceeded
# Usage: handle_session_budget_exceeded <total_session_cost>
# Returns: 0 if session should stop, 1 if continue (warn mode)
handle_session_budget_exceeded() {
    local CURRENT_COST=$1

    log_error "Session budget exceeded: \$${CURRENT_COST} >= \$${BUDGET_PER_SESSION_LIMIT}"
    notify_budget_exceeded "session" "$CURRENT_COST" "$BUDGET_PER_SESSION_LIMIT" "$BUDGET_ON_SESSION_EXCEEDED" ""

    case "$BUDGET_ON_SESSION_EXCEEDED" in
        "stop")
            log_warn "Action: Stopping session (on_session_budget_exceeded: stop)"
            return 0
            ;;
        "warn")
            log_warn "Action: Continuing despite budget (on_session_budget_exceeded: warn)"
            return 1
            ;;
        *)
            log_warn "Unknown action '${BUDGET_ON_SESSION_EXCEEDED}', defaulting to stop"
            return 0
            ;;
    esac
}

# Check budgets and emit warnings/actions
# Called after cost is updated from Claude output
# Usage: check_budgets_and_act <task_cost> <session_cost> <issue_number>
# Returns: 0 = continue, 1 = skip task, 2 = stop session
check_budgets_and_act() {
    local TASK_COST=$1
    local SESSION_COST=$2
    local ISSUE_NUMBER=$3

    # Skip budget checks in dry-run mode
    if [ "$DRY_RUN" = "true" ]; then
        return 0
    fi

    # Check session budget first (higher priority)
    if check_session_budget_exceeded "$SESSION_COST"; then
        if handle_session_budget_exceeded "$SESSION_COST"; then
            return 2  # Stop session
        fi
    elif check_session_budget_warning "$SESSION_COST"; then
        local PERCENTAGE=$(calculate_budget_percentage "$SESSION_COST" "$BUDGET_PER_SESSION_LIMIT")
        log_warn "Session budget warning: \$${SESSION_COST} (${PERCENTAGE}% of \$${BUDGET_PER_SESSION_LIMIT})"
        notify_budget_warning "session" "$SESSION_COST" "$BUDGET_PER_SESSION_LIMIT" "$PERCENTAGE" ""
        # LIFECYCLE HOOK: on_budget_warning (session budget)
        run_hook "on_budget_warning"
        SESSION_BUDGET_WARNING_SENT=true
    fi

    # Check task budget
    if check_task_budget_exceeded "$TASK_COST"; then
        if handle_task_budget_exceeded "$TASK_COST" "$ISSUE_NUMBER"; then
            return 1  # Skip/fail task
        fi
    elif check_task_budget_warning "$TASK_COST"; then
        local PERCENTAGE=$(calculate_budget_percentage "$TASK_COST" "$BUDGET_PER_TASK_LIMIT")
        log_warn "Task budget warning: \$${TASK_COST} (${PERCENTAGE}% of \$${BUDGET_PER_TASK_LIMIT})"
        notify_budget_warning "task" "$TASK_COST" "$BUDGET_PER_TASK_LIMIT" "$PERCENTAGE" "$ISSUE_NUMBER"
        # LIFECYCLE HOOK: on_budget_warning (task budget)
        run_hook "on_budget_warning"
        TASK_BUDGET_WARNING_SENT=true
    fi

    return 0
}

# Reset task budget tracking for new task
reset_task_budget_state() {
    TASK_BUDGET_WARNING_SENT=false
}

#------------------------------------------------------------------------------
# Progress File Management
#------------------------------------------------------------------------------

# Initialize or load progress file
init_progress() {
    if [ -f "$PROGRESS_FILE" ]; then
        local STATUS=$(jq -r '.status // "unknown"' "$PROGRESS_FILE" 2>/dev/null)
        if [ "$STATUS" = "in_progress" ]; then
            log_warn "Found interrupted session in progress file"
            RESUME_TASK=$(jq -r '.current_task.id // empty' "$PROGRESS_FILE" 2>/dev/null)
            if [ -n "$RESUME_TASK" ]; then
                log_info "Previous task: $RESUME_TASK"
                log_info "You may want to check its status before continuing"
            fi
        fi
    fi

    # Initialize fresh progress
    save_progress "idle" "" "" ""
}

# Save progress to file
# Usage: save_progress <status> <task_id> <task_title> <branch>
save_progress() {
    local STATUS=$1
    local TASK_ID=$2
    local TASK_TITLE=$3
    local BRANCH=$4

    cat > "$PROGRESS_FILE" << PROGRESS_EOF
{
  "status": "$STATUS",
  "current_task": {
    "id": "$TASK_ID",
    "title": "$TASK_TITLE",
    "branch": "$BRANCH",
    "started_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  },
  "session": {
    "started_at": "${SESSION_START:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}",
    "tasks_completed": ${ISSUES_COMPLETED:-0},
    "total_cost_usd": ${TOTAL_COST:-0}
  },
  "last_updated": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
PROGRESS_EOF
}

#------------------------------------------------------------------------------
# Pause/Resume Support
#------------------------------------------------------------------------------

# Path to the pause lock file
PAUSE_LOCK_FILE="$CHADGI_DIR/pause.lock"

#------------------------------------------------------------------------------
# Task Lock Support
#------------------------------------------------------------------------------

# Path to the task locks directory
TASK_LOCKS_DIR="$CHADGI_DIR/locks"

# Session ID for this instance
SESSION_ID="${HOSTNAME:-$(hostname)}-$$-$(date +%s)-$(( RANDOM ))"

# Generate a unique session ID for this ChadGI instance
generate_session_id() {
    echo "${HOSTNAME:-$(hostname)}-$$-$(date +%s)-$(( RANDOM % 1000000 ))"
}

# Get lock file path for an issue
get_task_lock_path() {
    local ISSUE_NUM=$1
    echo "$TASK_LOCKS_DIR/issue-${ISSUE_NUM}.lock"
}

# Check if a task is locked by another session
# Returns: 0 if not locked or locked by us, 1 if locked by another session
is_task_locked() {
    local ISSUE_NUM=$1
    local LOCK_FILE=$(get_task_lock_path "$ISSUE_NUM")

    if [ ! -f "$LOCK_FILE" ]; then
        return 0  # Not locked
    fi

    # Read lock file
    local LOCK_SESSION_ID=""
    local LOCK_HOSTNAME=""
    local LOCK_PID=""
    local LOCK_HEARTBEAT=""

    if command -v jq &>/dev/null; then
        LOCK_SESSION_ID=$(jq -r '.session_id // empty' "$LOCK_FILE" 2>/dev/null)
        LOCK_HOSTNAME=$(jq -r '.hostname // empty' "$LOCK_FILE" 2>/dev/null)
        LOCK_PID=$(jq -r '.pid // empty' "$LOCK_FILE" 2>/dev/null)
        LOCK_HEARTBEAT=$(jq -r '.last_heartbeat // empty' "$LOCK_FILE" 2>/dev/null)
    fi

    # If same session owns the lock, we're good
    if [ "$LOCK_SESSION_ID" = "$SESSION_ID" ]; then
        return 0
    fi

    # Check if lock is stale (older than TASK_LOCK_TIMEOUT_MINUTES)
    if [ -n "$LOCK_HEARTBEAT" ]; then
        local NOW_EPOCH=$(date +%s)
        local HEARTBEAT_EPOCH=$(date -d "$LOCK_HEARTBEAT" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%SZ" "$LOCK_HEARTBEAT" +%s 2>/dev/null || echo "0")
        local TIMEOUT_SECS=$((TASK_LOCK_TIMEOUT_MINUTES * 60))
        local AGE=$((NOW_EPOCH - HEARTBEAT_EPOCH))

        if [ "$AGE" -gt "$TIMEOUT_SECS" ]; then
            log_debug "Lock for issue #$ISSUE_NUM is stale (age: ${AGE}s > ${TIMEOUT_SECS}s)"
            return 0  # Stale lock - can be claimed
        fi
    fi

    # Check if the locking process is dead (only works on same host)
    if [ "$LOCK_HOSTNAME" = "${HOSTNAME:-$(hostname)}" ] && [ -n "$LOCK_PID" ]; then
        if ! kill -0 "$LOCK_PID" 2>/dev/null; then
            log_debug "Lock for issue #$ISSUE_NUM held by dead process (PID: $LOCK_PID)"
            return 0  # Process is dead - can be claimed
        fi
    fi

    # Lock is held by another active session
    return 1
}

# Acquire a task lock
# Returns: 0 on success, 1 on failure
acquire_task_lock() {
    local ISSUE_NUM=$1

    # Ensure locks directory exists
    mkdir -p "$TASK_LOCKS_DIR"

    local LOCK_FILE=$(get_task_lock_path "$ISSUE_NUM")
    local NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    # Check if already locked by another session
    if [ -f "$LOCK_FILE" ]; then
        if ! is_task_locked "$ISSUE_NUM"; then
            # Stale lock or our own lock - can override
            log_debug "Overriding stale/own lock for issue #$ISSUE_NUM"
        elif [ "$FORCE_CLAIM" = "true" ]; then
            log_warn "Force-claiming locked issue #$ISSUE_NUM"
        else
            return 1  # Locked by another active session
        fi
    fi

    # Create/update lock file atomically
    local TEMP_LOCK="${LOCK_FILE}.tmp.$$"
    cat > "$TEMP_LOCK" << LOCK_EOF
{
  "issue_number": $ISSUE_NUM,
  "session_id": "$SESSION_ID",
  "pid": $$,
  "hostname": "${HOSTNAME:-$(hostname)}",
  "locked_at": "$NOW",
  "last_heartbeat": "$NOW"
}
LOCK_EOF

    mv "$TEMP_LOCK" "$LOCK_FILE"
    return 0
}

# Release a task lock
release_task_lock() {
    local ISSUE_NUM=$1
    local LOCK_FILE=$(get_task_lock_path "$ISSUE_NUM")

    if [ -f "$LOCK_FILE" ]; then
        # Verify we own the lock before releasing
        local LOCK_SESSION_ID=""
        if command -v jq &>/dev/null; then
            LOCK_SESSION_ID=$(jq -r '.session_id // empty' "$LOCK_FILE" 2>/dev/null)
        fi

        if [ "$LOCK_SESSION_ID" = "$SESSION_ID" ] || [ -z "$LOCK_SESSION_ID" ]; then
            rm -f "$LOCK_FILE"
            log_debug "Released lock for issue #$ISSUE_NUM"
        else
            log_debug "Cannot release lock for issue #$ISSUE_NUM - owned by another session"
        fi
    fi
}

# Update heartbeat for a held lock
update_task_lock_heartbeat() {
    local ISSUE_NUM=$1
    local LOCK_FILE=$(get_task_lock_path "$ISSUE_NUM")

    if [ -f "$LOCK_FILE" ]; then
        local NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
        if command -v jq &>/dev/null; then
            jq --arg ts "$NOW" '.last_heartbeat = $ts' "$LOCK_FILE" > "${LOCK_FILE}.tmp" && \
                mv "${LOCK_FILE}.tmp" "$LOCK_FILE"
        fi
    fi
}

# Background heartbeat process for task locks
HEARTBEAT_PID=""

start_task_lock_heartbeat() {
    local ISSUE_NUM=$1

    # Start background heartbeat loop
    (
        while true; do
            sleep 30
            update_task_lock_heartbeat "$ISSUE_NUM"
        done
    ) &
    HEARTBEAT_PID=$!
    log_debug "Started heartbeat process (PID: $HEARTBEAT_PID) for issue #$ISSUE_NUM"
}

stop_task_lock_heartbeat() {
    if [ -n "$HEARTBEAT_PID" ]; then
        kill "$HEARTBEAT_PID" 2>/dev/null
        wait "$HEARTBEAT_PID" 2>/dev/null
        HEARTBEAT_PID=""
        log_debug "Stopped heartbeat process"
    fi
}

# Cleanup function for graceful shutdown
cleanup_task_locks() {
    # Stop heartbeat
    stop_task_lock_heartbeat

    # Release any locks we hold
    if [ -n "$ISSUE_NUMBER" ]; then
        release_task_lock "$ISSUE_NUMBER"
    fi
}

# Check if pause lock exists and handle accordingly
# Returns: 0 if should continue, 1 if paused (and will wait)
check_pause_lock() {
    if [ ! -f "$PAUSE_LOCK_FILE" ]; then
        return 0
    fi

    log_header "PAUSED - WAITING FOR RESUME"

    # Update progress to show paused state
    save_progress "paused" "${ISSUE_NUMBER:-}" "${ISSUE_TITLE:-}" "${BRANCH_NAME:-}"

    # Read pause lock for info
    local PAUSE_REASON=""
    local RESUME_AT=""
    if command -v jq &>/dev/null; then
        PAUSE_REASON=$(jq -r '.reason // empty' "$PAUSE_LOCK_FILE" 2>/dev/null)
        RESUME_AT=$(jq -r '.resume_at // empty' "$PAUSE_LOCK_FILE" 2>/dev/null)
    fi

    if [ -n "$PAUSE_REASON" ]; then
        log_info "Pause reason: $PAUSE_REASON"
    fi

    if [ -n "$RESUME_AT" ]; then
        log_info "Auto-resume scheduled at: $RESUME_AT"
    fi

    echo -e "${YELLOW}${BOLD}"
    echo "  ||  PAUSED - Waiting for 'chadgi resume' command..."
    echo -e "${NC}"
    log_info "Run 'chadgi resume' in another terminal to continue."
    log_info "Run 'chadgi status' to check current state."

    # Wait loop - check every 5 seconds for resume or auto-resume time
    while [ -f "$PAUSE_LOCK_FILE" ]; do
        # Check for auto-resume time
        if [ -n "$RESUME_AT" ]; then
            local NOW_EPOCH=$(date +%s)
            local RESUME_EPOCH=$(date -d "$RESUME_AT" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%SZ" "$RESUME_AT" +%s 2>/dev/null || echo "0")
            if [ "$RESUME_EPOCH" -gt 0 ] && [ "$NOW_EPOCH" -ge "$RESUME_EPOCH" ]; then
                log_info "Auto-resume time reached. Removing pause lock..."
                rm -f "$PAUSE_LOCK_FILE"
                break
            fi
        fi
        sleep 5
    done

    log_header "RESUMED - CONTINUING PROCESSING"
    log_success "Pause lock removed. Continuing with task queue."

    # Update progress back to previous state
    if [ -n "$ISSUE_NUMBER" ]; then
        save_progress "in_progress" "$ISSUE_NUMBER" "$ISSUE_TITLE" "$BRANCH_NAME"
    else
        save_progress "idle" "" "" ""
    fi

    return 0
}

#------------------------------------------------------------------------------
# Interactive Approval Mode
#------------------------------------------------------------------------------

# Create an approval lock file for a checkpoint
# Args: $1 = phase (pre_task, phase1, phase2), $2 = issue_number, $3 = issue_title, $4 = branch
create_approval_lock() {
    local PHASE=$1
    local ISSUE_NUM=$2
    local ISSUE_TITLE_ARG=$3
    local BRANCH_ARG=$4

    local LOCK_FILE="$CHADGI_DIR/approval-${PHASE}-${ISSUE_NUM}.lock"
    local TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    # Get diff stats if available and in phase1 or phase2
    local FILES_CHANGED=""
    local INSERTIONS=""
    local DELETIONS=""

    if [ "$PHASE" != "pre_task" ]; then
        local DIFF_STAT=$(git diff --stat "$BASE_BRANCH"...HEAD 2>/dev/null | tail -1)
        if [ -n "$DIFF_STAT" ]; then
            FILES_CHANGED=$(echo "$DIFF_STAT" | grep -oE '[0-9]+ file' | grep -oE '[0-9]+' || echo "")
            INSERTIONS=$(echo "$DIFF_STAT" | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+' || echo "")
            DELETIONS=$(echo "$DIFF_STAT" | grep -oE '[0-9]+ deletion' | grep -oE '[0-9]+' || echo "")
        fi
    fi

    # Build JSON lock file
    cat > "$LOCK_FILE" << EOF
{
  "status": "pending",
  "created_at": "$TIMESTAMP",
  "issue_number": $ISSUE_NUM,
  "issue_title": "$ISSUE_TITLE_ARG",
  "branch": "$BRANCH_ARG",
  "phase": "$PHASE"${FILES_CHANGED:+,
  "files_changed": $FILES_CHANGED}${INSERTIONS:+,
  "insertions": $INSERTIONS}${DELETIONS:+,
  "deletions": $DELETIONS}
}
EOF

    echo "$LOCK_FILE"
}

# Remove an approval lock file
remove_approval_lock() {
    local PHASE=$1
    local ISSUE_NUM=$2

    local LOCK_FILE="$CHADGI_DIR/approval-${PHASE}-${ISSUE_NUM}.lock"
    rm -f "$LOCK_FILE"
}

# Get the approval status from a lock file
# Returns: pending, approved, rejected, or empty if file doesn't exist
get_approval_status() {
    local LOCK_FILE=$1

    if [ ! -f "$LOCK_FILE" ]; then
        echo ""
        return
    fi

    jq -r '.status // empty' "$LOCK_FILE" 2>/dev/null || echo ""
}

# Get feedback from a rejected approval
get_rejection_feedback() {
    local LOCK_FILE=$1

    if [ ! -f "$LOCK_FILE" ]; then
        echo ""
        return
    fi

    jq -r '.feedback // empty' "$LOCK_FILE" 2>/dev/null || echo ""
}

# Display diff summary for approval checkpoint
display_diff_summary() {
    local BASE=$1

    echo ""
    echo -e "${CYAN}${BOLD}Changes Summary${NC}"
    echo -e "${DIM}─────────────────────────────────────────────────────${NC}"

    # Get diff stats
    local DIFF_OUTPUT=$(git diff --stat "$BASE"...HEAD 2>/dev/null)
    if [ -n "$DIFF_OUTPUT" ]; then
        echo "$DIFF_OUTPUT" | head -20
        local LINE_COUNT=$(echo "$DIFF_OUTPUT" | wc -l)
        if [ "$LINE_COUNT" -gt 20 ]; then
            echo -e "${DIM}  ... and $((LINE_COUNT - 20)) more files${NC}"
        fi
    else
        echo -e "${DIM}  No changes detected${NC}"
    fi

    echo -e "${DIM}─────────────────────────────────────────────────────${NC}"
    echo ""
}

# Display interactive approval prompt with keyboard shortcuts
display_approval_prompt() {
    local PHASE=$1
    local ISSUE_NUM=$2
    local ISSUE_TITLE_ARG=$3

    local PHASE_NAME=""
    case "$PHASE" in
        "pre_task") PHASE_NAME="Pre-Task Review" ;;
        "phase1")   PHASE_NAME="Post-Implementation Review" ;;
        "phase2")   PHASE_NAME="Pre-PR Creation Review" ;;
        *)          PHASE_NAME="$PHASE" ;;
    esac

    echo ""
    echo -e "${PURPLE}${BOLD}=========================================================="
    echo "                APPROVAL REQUIRED                         "
    echo "==========================================================${NC}"
    echo ""
    echo -e "${CYAN}Issue:${NC}  #${ISSUE_NUM}"
    echo -e "${CYAN}Title:${NC}  ${ISSUE_TITLE_ARG}"
    echo -e "${CYAN}Phase:${NC}  ${PHASE_NAME}"
    echo ""

    # Show diff if enabled
    if [ "$INTERACTIVE_SHOW_DIFF" = "true" ] && [ "$PHASE" != "pre_task" ]; then
        display_diff_summary "$BASE_BRANCH"
    fi

    echo -e "${YELLOW}${BOLD}Keyboard Shortcuts:${NC}"
    echo -e "  ${GREEN}y${NC} - Approve and continue"
    echo -e "  ${RED}n${NC} - Reject and provide feedback"
    echo -e "  ${CYAN}d${NC} - View full diff (chadgi diff)"
    echo -e "  ${YELLOW}s${NC} - Skip task (move back to Ready)"
    echo ""
    echo -e "Or run in another terminal:"
    echo -e "  ${GREEN}chadgi approve${NC} - Approve this checkpoint"
    echo -e "  ${RED}chadgi reject -m \"feedback\"${NC} - Reject with feedback"
    echo ""
}

# Wait for approval at a checkpoint
# Returns: 0 = approved, 1 = rejected (iterate), 2 = skip task
wait_for_approval() {
    local PHASE=$1
    local ISSUE_NUM=$2
    local ISSUE_TITLE_ARG=$3
    local BRANCH_ARG=$4

    if [ "$INTERACTIVE_ENABLED" != "true" ]; then
        return 0
    fi

    # Check which approvals are required based on config
    case "$PHASE" in
        "pre_task")
            if [ "$INTERACTIVE_APPROVE_PRE_TASK" != "true" ]; then
                return 0
            fi
            ;;
        "phase1")
            if [ "$INTERACTIVE_APPROVE_PHASE1" != "true" ]; then
                return 0
            fi
            ;;
        "phase2")
            if [ "$INTERACTIVE_APPROVE_PHASE2" != "true" ]; then
                return 0
            fi
            ;;
    esac

    # Create the approval lock file
    local LOCK_FILE=$(create_approval_lock "$PHASE" "$ISSUE_NUM" "$ISSUE_TITLE_ARG" "$BRANCH_ARG")

    # Update progress to show awaiting approval
    save_progress "awaiting_approval" "$ISSUE_NUM" "$ISSUE_TITLE_ARG" "$BRANCH_ARG"

    # Display the approval prompt
    display_approval_prompt "$PHASE" "$ISSUE_NUM" "$ISSUE_TITLE_ARG"

    # Calculate timeout
    local TIMEOUT_SECS=0
    if [ "$INTERACTIVE_TIMEOUT" -gt 0 ]; then
        TIMEOUT_SECS=$((INTERACTIVE_TIMEOUT))
    fi
    local START_TIME=$(date +%s)

    # Wait loop - check for keyboard input and lock file changes
    local RESULT=0
    while true; do
        # Check for keyboard input (non-blocking read with 1 second timeout)
        local KEY=""
        read -t 1 -n 1 KEY 2>/dev/null || true

        case "$KEY" in
            y|Y)
                log_success "Approved via keyboard"
                # Update lock file status
                jq '.status = "approved" | .approved_at = "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'" | .approver = "'"$(whoami)"'"' "$LOCK_FILE" > "${LOCK_FILE}.tmp" && mv "${LOCK_FILE}.tmp" "$LOCK_FILE"
                RESULT=0
                break
                ;;
            n|N)
                echo ""
                echo -e "${YELLOW}Enter feedback for Claude (press Enter when done):${NC}"
                local FEEDBACK=""
                read -r FEEDBACK
                log_warn "Rejected via keyboard"
                # Update lock file status with feedback
                jq '.status = "rejected" | .rejected_at = "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'" | .approver = "'"$(whoami)"'" | .feedback = "'"$FEEDBACK"'"' "$LOCK_FILE" > "${LOCK_FILE}.tmp" && mv "${LOCK_FILE}.tmp" "$LOCK_FILE"
                APPROVAL_FEEDBACK="$FEEDBACK"
                RESULT=1
                break
                ;;
            d|D)
                echo ""
                echo -e "${CYAN}Showing full diff...${NC}"
                echo ""
                git diff "$BASE_BRANCH"...HEAD 2>/dev/null | head -100
                echo ""
                echo -e "${DIM}(Showing first 100 lines. Run 'chadgi diff' for full output)${NC}"
                echo ""
                display_approval_prompt "$PHASE" "$ISSUE_NUM" "$ISSUE_TITLE_ARG"
                ;;
            s|S)
                log_warn "Task skipped via keyboard"
                # Update lock file status
                jq '.status = "rejected" | .rejected_at = "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'" | .approver = "'"$(whoami)"'" | .feedback = "Task skipped by user"' "$LOCK_FILE" > "${LOCK_FILE}.tmp" && mv "${LOCK_FILE}.tmp" "$LOCK_FILE"
                RESULT=2
                break
                ;;
        esac

        # Check if lock file was updated externally (via chadgi approve/reject)
        local STATUS=$(get_approval_status "$LOCK_FILE")
        if [ "$STATUS" = "approved" ]; then
            log_success "Approved via 'chadgi approve' command"
            RESULT=0
            break
        elif [ "$STATUS" = "rejected" ]; then
            log_warn "Rejected via 'chadgi reject' command"
            APPROVAL_FEEDBACK=$(get_rejection_feedback "$LOCK_FILE")
            RESULT=1
            break
        fi

        # Check for timeout
        if [ "$TIMEOUT_SECS" -gt 0 ]; then
            local ELAPSED=$(($(date +%s) - START_TIME))
            if [ "$ELAPSED" -ge "$TIMEOUT_SECS" ]; then
                log_warn "Approval timeout reached ($INTERACTIVE_TIMEOUT seconds). Auto-approving."
                # Update lock file status
                jq '.status = "approved" | .approved_at = "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'" | .approver = "auto-timeout"' "$LOCK_FILE" > "${LOCK_FILE}.tmp" && mv "${LOCK_FILE}.tmp" "$LOCK_FILE"
                RESULT=0
                break
            fi
        fi
    done

    # Update progress back to in_progress
    save_progress "in_progress" "$ISSUE_NUM" "$ISSUE_TITLE_ARG" "$BRANCH_ARG"

    # Clean up lock file
    rm -f "$LOCK_FILE"

    return $RESULT
}

# Global variable to store rejection feedback
APPROVAL_FEEDBACK=""

#------------------------------------------------------------------------------
# Session Statistics
#------------------------------------------------------------------------------

# Calculate human-readable duration from seconds
format_duration() {
    local SECONDS=$1
    local HOURS=$((SECONDS / 3600))
    local MINUTES=$(((SECONDS % 3600) / 60))
    local SECS=$((SECONDS % 60))

    if [ $HOURS -gt 0 ]; then
        printf "%dh %dm %ds" $HOURS $MINUTES $SECS
    elif [ $MINUTES -gt 0 ]; then
        printf "%dm %ds" $MINUTES $SECS
    else
        printf "%ds" $SECS
    fi
}

# Calculate average from a list of values
calculate_average() {
    local VALUES=$1
    local COUNT=0
    local TOTAL=0

    for VAL in $VALUES; do
        TOTAL=$(echo "$TOTAL + $VAL" | bc 2>/dev/null || echo "$TOTAL")
        COUNT=$((COUNT + 1))
    done

    if [ $COUNT -gt 0 ]; then
        echo "scale=4; $TOTAL / $COUNT" | bc 2>/dev/null || echo "0"
    else
        echo "0"
    fi
}

# Print session statistics summary
print_session_summary() {
    local SESSION_END_EPOCH=$(date +%s)
    local SESSION_END=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    local SESSION_DURATION=$((SESSION_END_EPOCH - SESSION_START_EPOCH))

    echo ""
    echo -e "${PURPLE}${BOLD}==========================================================${NC}"
    echo -e "${PURPLE}${BOLD}                   SESSION STATISTICS                      ${NC}"
    echo -e "${PURPLE}${BOLD}==========================================================${NC}"
    echo ""

    # Session timing
    echo -e "${CYAN}Session Timing${NC}"
    echo -e "  Started:   ${SESSION_START}"
    echo -e "  Ended:     ${SESSION_END}"
    echo -e "  Duration:  $(format_duration $SESSION_DURATION)"
    echo ""

    # Task completion stats
    echo -e "${CYAN}Task Completion${NC}"
    echo -e "  Attempted:  ${ISSUES_ATTEMPTED}"
    echo -e "  Completed:  ${ISSUES_COMPLETED}"
    local FAILED_COUNT=0
    for TASK in $FAILED_TASKS; do
        FAILED_COUNT=$((FAILED_COUNT + 1))
    done
    echo -e "  Failed:     ${FAILED_COUNT}"

    # Success rate
    if [ $ISSUES_ATTEMPTED -gt 0 ]; then
        local SUCCESS_RATE=$(echo "scale=1; $ISSUES_COMPLETED * 100 / $ISSUES_ATTEMPTED" | bc 2>/dev/null || echo "0")
        echo -e "  Success:    ${SUCCESS_RATE}%"
    fi
    echo ""

    # Successful tasks breakdown
    if [ -n "$SUCCESSFUL_TASKS" ]; then
        echo -e "${GREEN}Successful Tasks${NC}"
        local DURATIONS=""
        for TASK in $SUCCESSFUL_TASKS; do
            local ISSUE_NUM=$(echo "$TASK" | cut -d: -f1)
            local DURATION_SECS=$(echo "$TASK" | cut -d: -f2)
            DURATIONS="$DURATIONS $DURATION_SECS"
            echo -e "  - Issue #${ISSUE_NUM}: $(format_duration $DURATION_SECS)"
        done

        # Calculate average time per task
        local AVG_DURATION=$(calculate_average "$DURATIONS")
        AVG_DURATION=$(printf "%.0f" "$AVG_DURATION")
        if [ -n "$AVG_DURATION" ] && [ "$AVG_DURATION" != "0" ]; then
            echo -e "  ${DIM}Average: $(format_duration $AVG_DURATION)${NC}"
        fi
        echo ""
    fi

    # Failed tasks breakdown
    if [ -n "$FAILED_TASKS" ]; then
        echo -e "${RED}Failed Tasks${NC}"
        for TASK in $FAILED_TASKS; do
            local ISSUE_NUM=$(echo "$TASK" | cut -d: -f1)
            local REASON=$(echo "$TASK" | cut -d: -f2-)
            echo -e "  - Issue #${ISSUE_NUM}: ${REASON}"
        done
        echo ""
    fi

    # Cost breakdown
    echo -e "${CYAN}API Costs${NC}"
    echo -e "  Total Cost: \$${TOTAL_COST:-0}"

    if [ $ISSUES_COMPLETED -gt 0 ] && [ -n "$TOTAL_COST" ] && [ "$TOTAL_COST" != "0" ]; then
        local AVG_COST=$(echo "scale=4; $TOTAL_COST / $ISSUES_COMPLETED" | bc 2>/dev/null || echo "0")
        printf "  Avg/Task:   \$%.4f\n" "$AVG_COST"
    fi
    echo ""

    # GigaChad mode stats
    if [ "$GIGACHAD_MODE" = "true" ]; then
        echo -e "${PURPLE}GigaChad Mode${NC}"
        echo -e "  Auto-merged: ${GIGACHAD_MERGES} PRs"
        echo ""
    fi

    echo -e "${PURPLE}${BOLD}==========================================================${NC}"
    echo -e "${PURPLE}                  ${CHAD_TAGLINE}${NC}"
    echo -e "${PURPLE}${BOLD}==========================================================${NC}"
}

# Save session statistics to historical log file
save_session_stats() {
    local STATS_FILE="${CHADGI_DIR}/chadgi-stats.json"
    local SESSION_END_EPOCH=$(date +%s)
    local SESSION_END=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    local SESSION_DURATION=$((SESSION_END_EPOCH - SESSION_START_EPOCH))

    # Build successful tasks array
    local SUCCESSFUL_ARRAY="["
    local FIRST=true
    for TASK in $SUCCESSFUL_TASKS; do
        local ISSUE_NUM=$(echo "$TASK" | cut -d: -f1)
        local DURATION_SECS=$(echo "$TASK" | cut -d: -f2)
        if [ "$FIRST" = "true" ]; then
            FIRST=false
        else
            SUCCESSFUL_ARRAY="${SUCCESSFUL_ARRAY},"
        fi
        SUCCESSFUL_ARRAY="${SUCCESSFUL_ARRAY}{\"issue\":${ISSUE_NUM},\"duration_secs\":${DURATION_SECS}}"
    done
    SUCCESSFUL_ARRAY="${SUCCESSFUL_ARRAY}]"

    # Build failed tasks array
    local FAILED_ARRAY="["
    FIRST=true
    for TASK in $FAILED_TASKS; do
        local ISSUE_NUM=$(echo "$TASK" | cut -d: -f1)
        local REASON=$(echo "$TASK" | cut -d: -f2-)
        if [ "$FIRST" = "true" ]; then
            FIRST=false
        else
            FAILED_ARRAY="${FAILED_ARRAY},"
        fi
        FAILED_ARRAY="${FAILED_ARRAY}{\"issue\":${ISSUE_NUM},\"reason\":\"${REASON}\"}"
    done
    FAILED_ARRAY="${FAILED_ARRAY}]"

    # Create new stats entry
    local NEW_ENTRY=$(cat << STATS_EOF
{
  "session_id": "$(uuidgen 2>/dev/null || echo "session-${SESSION_START_EPOCH}")",
  "started_at": "${SESSION_START}",
  "ended_at": "${SESSION_END}",
  "duration_secs": ${SESSION_DURATION},
  "tasks_attempted": ${ISSUES_ATTEMPTED},
  "tasks_completed": ${ISSUES_COMPLETED},
  "successful_tasks": ${SUCCESSFUL_ARRAY},
  "failed_tasks": ${FAILED_ARRAY},
  "total_cost_usd": ${TOTAL_COST:-0},
  "gigachad_mode": ${GIGACHAD_MODE:-false},
  "gigachad_merges": ${GIGACHAD_MERGES},
  "repo": "${REPO}"
}
STATS_EOF
)

    # Append to stats file (create if doesn't exist)
    if [ ! -f "$STATS_FILE" ]; then
        echo "[$NEW_ENTRY]" > "$STATS_FILE"
    else
        # Read existing file, remove trailing ] and append new entry
        local EXISTING=$(cat "$STATS_FILE")
        # Remove trailing ] and whitespace
        EXISTING=$(echo "$EXISTING" | sed 's/][ \t\n]*$//')
        # Append new entry with comma
        echo "${EXISTING},${NEW_ENTRY}]" > "$STATS_FILE"
    fi

    log_info "Session statistics saved to $STATS_FILE"
}

#------------------------------------------------------------------------------
# Task Metrics - Detailed per-task performance profiling
#------------------------------------------------------------------------------

# Track per-task metrics for insights command
# These variables are reset at the start of each task
TASK_PHASE1_START=0
TASK_PHASE1_END=0
TASK_PHASE2_START=0
TASK_PHASE2_END=0
TASK_VERIFICATION_TIME=0
TASK_GIT_OPS_TIME=0
TASK_ITERATIONS=0
TASK_RETRY_COUNT=0
TASK_ERROR_RECOVERY_TIME=0
TASK_COST=0
TASK_FAILURE_PHASE=""
TASK_BUDGET_EXCEEDED=false
SESSION_BUDGET_EXCEEDED=false

# Reset task metrics for a new task
reset_task_metrics() {
    TASK_PHASE1_START=0
    TASK_PHASE1_END=0
    TASK_PHASE2_START=0
    TASK_PHASE2_END=0
    TASK_VERIFICATION_TIME=0
    TASK_GIT_OPS_TIME=0
    TASK_ITERATIONS=0
    TASK_RETRY_COUNT=0
    TASK_ERROR_RECOVERY_TIME=0
    TASK_COST=0
    TASK_FAILURE_PHASE=""
    TASK_BUDGET_EXCEEDED=false
    # Reset task-level budget warning state
    reset_task_budget_state
}

# Save detailed task metrics to chadgi-metrics.json
save_task_metrics() {
    local ISSUE_NUM=$1
    local STATUS=$2            # "completed" or "failed"
    local DURATION=$3          # Total task duration in seconds
    local FAILURE_REASON=${4:-""}
    local FAILURE_PHASE=${5:-""}

    local METRICS_FILE="${CHADGI_DIR}/chadgi-metrics.json"
    local NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    # Calculate phase durations
    local PHASE1_DURATION=0
    if [ $TASK_PHASE1_START -gt 0 ] && [ $TASK_PHASE1_END -gt 0 ]; then
        PHASE1_DURATION=$((TASK_PHASE1_END - TASK_PHASE1_START))
    elif [ $TASK_PHASE1_START -gt 0 ]; then
        # Phase 1 didn't complete
        local NOW_EPOCH=$(date +%s)
        PHASE1_DURATION=$((NOW_EPOCH - TASK_PHASE1_START))
    fi

    local PHASE2_DURATION=0
    if [ $TASK_PHASE2_START -gt 0 ] && [ $TASK_PHASE2_END -gt 0 ]; then
        PHASE2_DURATION=$((TASK_PHASE2_END - TASK_PHASE2_START))
    elif [ $TASK_PHASE2_START -gt 0 ]; then
        # Phase 2 didn't complete
        local NOW_EPOCH=$(date +%s)
        PHASE2_DURATION=$((NOW_EPOCH - TASK_PHASE2_START))
    fi

    # Get files modified and lines changed from git
    local FILES_MODIFIED=0
    local LINES_CHANGED=0
    if command -v git &> /dev/null; then
        FILES_MODIFIED=$(git diff --stat "origin/$BASE_BRANCH"...HEAD 2>/dev/null | tail -1 | grep -oE "[0-9]+ file" | grep -oE "[0-9]+" || echo "0")
        local INSERTIONS=$(git diff --stat "origin/$BASE_BRANCH"...HEAD 2>/dev/null | tail -1 | grep -oE "[0-9]+ insertion" | grep -oE "[0-9]+" || echo "0")
        local DELETIONS=$(git diff --stat "origin/$BASE_BRANCH"...HEAD 2>/dev/null | tail -1 | grep -oE "[0-9]+ deletion" | grep -oE "[0-9]+" || echo "0")
        LINES_CHANGED=$((${INSERTIONS:-0} + ${DELETIONS:-0}))
    fi

    # Build the task metric JSON entry
    local METRIC_ENTRY=$(cat << METRIC_EOF
{
  "issue_number": ${ISSUE_NUM},
  "started_at": "$(date -d "@$CURRENT_TASK_START_EPOCH" -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -r "$CURRENT_TASK_START_EPOCH" -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo "$NOW")",
  "completed_at": "${NOW}",
  "duration_secs": ${DURATION},
  "status": "${STATUS}",
  "iterations": ${TASK_ITERATIONS:-1},
  "cost_usd": ${TASK_COST:-0},
  "phases": {
    "phase1_duration_secs": ${PHASE1_DURATION},
    "phase2_duration_secs": ${PHASE2_DURATION},
    "verification_duration_secs": ${TASK_VERIFICATION_TIME:-0},
    "git_operations_duration_secs": ${TASK_GIT_OPS_TIME:-0}
  },
  "failure_reason": $([ -n "$FAILURE_REASON" ] && echo "\"$FAILURE_REASON\"" || echo "null"),
  "failure_phase": $([ -n "$FAILURE_PHASE" ] && echo "\"$FAILURE_PHASE\"" || echo "null"),
  "error_recovery_time_secs": ${TASK_ERROR_RECOVERY_TIME:-0},
  "files_modified": ${FILES_MODIFIED:-0},
  "lines_changed": ${LINES_CHANGED:-0},
  "retry_count": ${TASK_RETRY_COUNT:-0},
  "category": $([ -n "$CURRENT_TASK_CATEGORY" ] && echo "\"$CURRENT_TASK_CATEGORY\"" || echo "null")
}
METRIC_EOF
)

    # Initialize metrics file if it doesn't exist
    if [ ! -f "$METRICS_FILE" ]; then
        cat > "$METRICS_FILE" << INIT_EOF
{
  "version": "1.0.0",
  "last_updated": "${NOW}",
  "retention_days": 30,
  "tasks": [${METRIC_ENTRY}]
}
INIT_EOF
        log_info "Task metrics initialized in $METRICS_FILE"
        return
    fi

    # Read existing file, update last_updated and append new task
    local TMP_FILE=$(mktemp)

    # Use jq if available for proper JSON manipulation, otherwise use sed
    if command -v jq &> /dev/null; then
        jq --argjson new_task "$METRIC_ENTRY" \
           --arg now "$NOW" \
           '.last_updated = $now | .tasks += [$new_task]' \
           "$METRICS_FILE" > "$TMP_FILE" 2>/dev/null && mv "$TMP_FILE" "$METRICS_FILE"
    else
        # Fallback: simple JSON append without jq
        # Find the last ] in the tasks array and insert before it
        local EXISTING=$(cat "$METRICS_FILE")
        # Update last_updated
        EXISTING=$(echo "$EXISTING" | sed "s/\"last_updated\": \"[^\"]*\"/\"last_updated\": \"${NOW}\"/")
        # Insert new task entry before closing ] of tasks array
        EXISTING=$(echo "$EXISTING" | sed 's/"tasks": \[/"tasks": [NEWENTRY/')
        # Find the position to insert (before the final ] of tasks array)
        # This is simplified - we append after existing entries
        EXISTING=$(echo "$EXISTING" | sed "s/\][ \t\n]*\}$/,${METRIC_ENTRY}]\n}/")
        # Handle case where tasks array was empty
        EXISTING=$(echo "$EXISTING" | sed "s/NEWENTRY,/NEWENTRY/")
        EXISTING=$(echo "$EXISTING" | sed "s/NEWENTRY/${METRIC_ENTRY},/")
        # Clean up if it was the first entry
        EXISTING=$(echo "$EXISTING" | sed 's/,\]/]/')
        echo "$EXISTING" > "$METRICS_FILE"
    fi

    log_info "Task metrics saved for issue #${ISSUE_NUM}"
}

# Apply metrics retention policy (remove old entries)
apply_metrics_retention() {
    local METRICS_FILE="${CHADGI_DIR}/chadgi-metrics.json"
    [ ! -f "$METRICS_FILE" ] && return

    if command -v jq &> /dev/null; then
        local RETENTION_DAYS=$(jq -r '.retention_days // 30' "$METRICS_FILE")
        local CUTOFF_DATE=$(date -d "-${RETENTION_DAYS} days" -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || \
                          date -v-${RETENTION_DAYS}d -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null)

        if [ -n "$CUTOFF_DATE" ]; then
            local TMP_FILE=$(mktemp)
            jq --arg cutoff "$CUTOFF_DATE" \
               '.tasks = [.tasks[] | select(.started_at >= $cutoff)]' \
               "$METRICS_FILE" > "$TMP_FILE" 2>/dev/null && mv "$TMP_FILE" "$METRICS_FILE"
        fi
    fi
}

#------------------------------------------------------------------------------
# Branding - Chad does what Chad wants
#------------------------------------------------------------------------------

# Generate the Chad footer (ASCII art + tagline)
# Returns empty string if INCLUDE_FOOTER is not "true"
get_chad_footer() {
    local CONTEXT=${1:-issue}  # "issue" or "pr"

    if [ "$INCLUDE_FOOTER" != "true" ]; then
        echo ""
        return
    fi

    local FOOTER_TEXT
    if [ "$CONTEXT" = "pr" ]; then
        FOOTER_TEXT="_${CHAD_TAGLINE} No humans mass-produced in the mass-production of this PR._"
    else
        FOOTER_TEXT="_${CHAD_TAGLINE} No humans were mass-produced in the making of this ticket._"
    fi

    cat << 'CHAD_EOF'

---
```
⣿⣿⣿⣿⣿⣿⣿⣿⡿⠿⠛⠛⠛⠋⠉⠈⠉⠉⠉⠉⠛⠻⢿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣿⡿⠋⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠛⢿⣿⣿⣿⣿
⣿⣿⣿⣿⡏⣀⠀⠀⠀⠀⠀⠀⠀⣀⣤⣤⣤⣄⡀⠀⠀⠀⠀⠀⠀⠀⠙⢿⣿⣿
⣿⣿⣿⢏⣴⣿⣷⠀⠀⠀⠀⠀⢾⣿⣿⣿⣿⣿⣿⡆⠀⠀⠀⠀⠀⠀⠀⠈⣿⣿
⣿⣿⣟⣾⣿⡟⠁⠀⠀⠀⠀⠀⢀⣾⣿⣿⣿⣿⣿⣷⢢⠀⠀⠀⠀⠀⠀⠀⢸⣿
⣿⣿⣿⣿⣟⠀⡴⠄⠀⠀⠀⠀⠀⠀⠙⠻⣿⣿⣿⣿⣷⣄⠀⠀⠀⠀⠀⠀⠀⣿
⣿⣿⣿⠟⠻⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠶⢴⣿⣿⣿⣿⣿⣧⠀⠀⠀⠀⠀⠀⣿
⣿⣁⡀⠀⠀⢰⢠⣦⠀⠀⠀⠀⠀⠀⠀⠀⢀⣼⣿⣿⣿⣿⣿⡄⠀⣴⣶⣿⡄⣿
⣿⡋⠀⠀⠀⠎⢸⣿⡆⠀⠀⠀⠀⠀⠀⣴⣿⣿⣿⣿⣿⣿⣿⠗⢘⣿⣟⠛⠿⣼
⣿⣿⠋⢀⡌⢰⣿⡿⢿⡀⠀⠀⠀⠀⠀⠙⠿⣿⣿⣿⣿⣿⡇⠀⢸⣿⣿⣧⢀⣼
⣿⣿⣷⢻⠄⠘⠛⠋⠛⠃⠀⠀⠀⠀⠀⢿⣧⠈⠉⠙⠛⠋⠀⠀⠀⣿⣿⣿⣿⣿
⣿⣿⣧⠀⠈⢸⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠟⠀⠀⠀⠀⢀⢃⠀⠀⢸⣿⣿⣿⣿
⣿⣿⡿⠀⠴⢗⣠⣤⣴⡶⠶⠖⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⡸⠀⣿⣿⣿⣿
⣿⣿⣿⡀⢠⣾⣿⠏⠀⠠⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠛⠉⠀⣿⣿⣿⣿
⣿⣿⣿⣧⠈⢹⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣰⣿⣿⣿⣿
⣿⣿⣿⣿⡄⠈⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣠⣴⣾⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣧⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣠⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣷⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣴⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣿⣦⣄⣀⣀⣀⣀⠀⠀⠀⠀⠘⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⡄⠀⠀⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣧⠀⠀⠀⠙⣿⣿⡟⢻⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠇⠀⠁⠀⠀⠹⣿⠃⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣿⣿⣿⣿⡿⠛⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⢐⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⠿⠛⠉⠉⠁⠀⢻⣿⡇⠀⠀⠀⠀⠀⠀⢀⠈⣿⣿⡿⠉⠛⠛⠛⠉⠉
⣿⡿⠋⠁⠀⠀⢀⣀⣠⡴⣸⣿⣇⡄⠀⠀⠀⠀⢀⡿⠄⠙⠛⠀⣀⣠⣤⣤⠄
```
CHAD_EOF
    echo "$FOOTER_TEXT"
}

# Get label flag for gh commands (empty if no label configured)
get_label_flag() {
    if [ -n "$CHAD_LABEL" ]; then
        echo "--label \"$CHAD_LABEL\""
    else
        echo ""
    fi
}

#------------------------------------------------------------------------------
# Template Processing
#------------------------------------------------------------------------------

# Substitute variables in template (handles multiline content safely)
# Usage: process_template <template_file> <output_file>
process_template() {
    local TEMPLATE_FILE=$1
    local OUTPUT_FILE=$2

    if [ ! -f "$TEMPLATE_FILE" ]; then
        log_error "Template file not found: $TEMPLATE_FILE"
        return 1
    fi

    # Copy template to output (skip if same file)
    if [ "$TEMPLATE_FILE" != "$OUTPUT_FILE" ]; then
        cp "$TEMPLATE_FILE" "$OUTPUT_FILE"
    fi

    # Simple variable substitutions (single-line values)
    sed -i.bak \
        -e "s|{{ISSUE_NUMBER}}|${ISSUE_NUMBER}|g" \
        -e "s|{{ISSUE_TITLE}}|${ISSUE_TITLE}|g" \
        -e "s|{{ISSUE_URL}}|${ISSUE_URL}|g" \
        -e "s|{{BRANCH_NAME}}|${BRANCH_NAME}|g" \
        -e "s|{{BASE_BRANCH}}|${BASE_BRANCH}|g" \
        -e "s|{{REPO}}|${REPO}|g" \
        -e "s|{{REPO_OWNER}}|${REPO_OWNER}|g" \
        -e "s|{{PROJECT_NUMBER}}|${PROJECT_NUMBER}|g" \
        -e "s|{{READY_COLUMN}}|${READY_COLUMN}|g" \
        -e "s|{{IN_PROGRESS_COLUMN}}|${IN_PROGRESS_COLUMN}|g" \
        -e "s|{{REVIEW_COLUMN}}|${REVIEW_COLUMN}|g" \
        -e "s|{{COMPLETION_PROMISE}}|${COMPLETION_PROMISE}|g" \
        -e "s|{{GITHUB_USERNAME}}|${GITHUB_USERNAME}|g" \
        -e "s|{{ISSUE_PREFIX}}|${ISSUE_PREFIX}|g" \
        -e "s|{{CHAD_LABEL}}|${CHAD_LABEL}|g" \
        -e "s|{{CHAD_TAGLINE}}|${CHAD_TAGLINE}|g" \
        -e "s|{{TEST_COMMAND}}|${TEST_COMMAND}|g" \
        -e "s|{{BUILD_COMMAND}}|${BUILD_COMMAND}|g" \
        "$OUTPUT_FILE"
    rm -f "${OUTPUT_FILE}.bak"

    # Handle CHAD_FOOTER (multiline ASCII art)
    local CHAD_FOOTER
    CHAD_FOOTER=$(get_chad_footer "issue")
    if [ -n "$CHAD_FOOTER" ]; then
        local FOOTER_FILE=$(mktemp)
        echo "$CHAD_FOOTER" > "$FOOTER_FILE"
        if command -v perl &> /dev/null; then
            perl -i -pe 'BEGIN{open F,"'"$FOOTER_FILE"'";$r=join"",<F>;chomp $r}s/\{\{CHAD_FOOTER\}\}/$r/g' "$OUTPUT_FILE"
        else
            # Fallback: remove placeholder if perl not available
            sed -i.bak 's/{{CHAD_FOOTER}}//g' "$OUTPUT_FILE"
            rm -f "${OUTPUT_FILE}.bak"
        fi
        rm -f "$FOOTER_FILE"
    else
        # No footer - just remove the placeholder
        sed -i.bak 's/{{CHAD_FOOTER}}//g' "$OUTPUT_FILE"
        rm -f "${OUTPUT_FILE}.bak"
    fi

    # Handle multi-line ISSUE_BODY using a temp file approach
    if [ -n "$ISSUE_BODY" ]; then
        local BODY_FILE=$(mktemp)
        echo "$ISSUE_BODY" > "$BODY_FILE"
        # Use perl for safe multiline replacement
        if command -v perl &> /dev/null; then
            perl -i -pe 'BEGIN{open F,"'"$BODY_FILE"'";$r=join"",<F>;chomp $r}s/\{\{ISSUE_BODY\}\}/$r/g' "$OUTPUT_FILE"
        else
            # Fallback: just remove the placeholder if perl not available
            sed -i.bak 's/{{ISSUE_BODY}}/[Issue body - see GitHub]/g' "$OUTPUT_FILE"
            rm -f "${OUTPUT_FILE}.bak"
        fi
        rm -f "$BODY_FILE"
    fi

    # Handle EXISTING_ISSUES similarly
    if [ -n "$EXISTING_ISSUES" ]; then
        local ISSUES_FILE=$(mktemp)
        echo "$EXISTING_ISSUES" > "$ISSUES_FILE"
        if command -v perl &> /dev/null; then
            perl -i -pe 'BEGIN{open F,"'"$ISSUES_FILE"'";$r=join"",<F>;chomp $r}s/\{\{EXISTING_ISSUES\}\}/$r/g' "$OUTPUT_FILE"
        else
            sed -i.bak 's/{{EXISTING_ISSUES}}/[See GitHub for existing issues]/g' "$OUTPUT_FILE"
            rm -f "${OUTPUT_FILE}.bak"
        fi
        rm -f "$ISSUES_FILE"
    fi
}

#------------------------------------------------------------------------------
# Logging Functions
#------------------------------------------------------------------------------

# Trap Ctrl+C for graceful exit
trap ctrl_c INT

function ctrl_c() {
    echo -e "\n${YELLOW}-----------------------------------------------------------${NC}"
    echo -e "${YELLOW}  ChadGI is shutting down gracefully...${NC}"
    echo -e "${YELLOW}-----------------------------------------------------------${NC}"
    save_progress "stopped" "$ISSUE_NUMBER" "$ISSUE_TITLE" "$BRANCH_NAME"

    # Clean up task locks
    cleanup_task_locks

    # Display and save session statistics
    print_session_summary
    save_session_stats

    # Send session ended notification
    local SESSION_END_EPOCH=$(date +%s)
    local SESSION_DURATION=$((SESSION_END_EPOCH - SESSION_START_EPOCH))
    local FAILED_COUNT=0
    for TASK in $FAILED_TASKS; do
        FAILED_COUNT=$((FAILED_COUNT + 1))
    done
    notify_session_ended "$ISSUES_COMPLETED" "$FAILED_COUNT" "$SESSION_DURATION" "${TOTAL_COST:-0}"

    exit 0
}

function log_header() {
    # Headers are always shown (INFO level) and logged
    echo -e "\n${PURPLE}-----------------------------------------------------------${NC}"
    echo -e "${PURPLE}  $1${NC}"
    echo -e "${PURPLE}-----------------------------------------------------------${NC}"
    write_to_log_file $LOG_LEVEL_INFO "------- $1 -------"
}

function log_step() {
    # Steps are DEBUG level (detailed process info)
    _log $LOG_LEVEL_DEBUG "$CYAN" ">" "$1"
}

function log_success() {
    # Success is INFO level
    _log $LOG_LEVEL_INFO "$GREEN" "+" "$1"
}

function log_info() {
    # Info is INFO level
    _log $LOG_LEVEL_INFO "$BLUE" "i" "$1"
}

function log_warn() {
    # Warnings are WARN level
    _log $LOG_LEVEL_WARN "$YELLOW" "!" "$1"
}

function log_error() {
    # Errors are ERROR level
    _log $LOG_LEVEL_ERROR "$RED" "x" "$1"
}

function log_dry_run() {
    # Dry-run messages are INFO level
    _log $LOG_LEVEL_INFO "$YELLOW" "[DRY-RUN]" "$1"
}

function log_debug() {
    # Debug messages are DEBUG level
    _log $LOG_LEVEL_DEBUG "$DIM" "D" "$1"
}

#------------------------------------------------------------------------------
# Rich Streaming Output
#------------------------------------------------------------------------------

# Truncate string to max length
truncate_str() {
    local STR=$1
    local MAX=${2:-$TRUNCATE_LENGTH}
    if [ ${#STR} -gt $MAX ]; then
        echo "${STR:0:$((MAX-3))}..."
    else
        echo "$STR"
    fi
}

# Format tool output for display
format_tool_output() {
    local TOOL_NAME=$1
    local TOOL_INPUT=$2
    local TOOL_RESULT=$3

    case "$TOOL_NAME" in
        "Bash")
            local CMD=$(echo "$TOOL_INPUT" | jq -r '.command // empty' 2>/dev/null)
            local DESC=$(echo "$TOOL_INPUT" | jq -r '.description // empty' 2>/dev/null)
            if [ -n "$DESC" ]; then
                echo -e "${CYAN}* Bash${NC}(${DIM}$(truncate_str "$DESC")${NC})"
            elif [ -n "$CMD" ]; then
                echo -e "${CYAN}* Bash${NC}(${DIM}$(truncate_str "$CMD")${NC})"
            else
                echo -e "${CYAN}* Bash${NC}"
            fi
            # Show output preview if available
            if [ -n "$TOOL_RESULT" ]; then
                local OUTPUT=$(echo "$TOOL_RESULT" | head -c 200 | tr '\n' ' ' | sed 's/  */ /g')
                [ -n "$OUTPUT" ] && echo -e "  ${DIM}-> $(truncate_str "$OUTPUT" 70)${NC}"
            fi
            ;;
        "Read")
            local FILE=$(echo "$TOOL_INPUT" | jq -r '.file_path // empty' 2>/dev/null)
            local LIMIT=$(echo "$TOOL_INPUT" | jq -r '.limit // empty' 2>/dev/null)
            local FILENAME=$(basename "$FILE" 2>/dev/null)
            if [ -n "$LIMIT" ]; then
                echo -e "${CYAN}* Read${NC}(${DIM}$FILENAME${NC}) ${DIM}[$LIMIT lines]${NC}"
            else
                echo -e "${CYAN}* Read${NC}(${DIM}$FILENAME${NC})"
            fi
            ;;
        "Edit"|"MultiEdit")
            local FILE=$(echo "$TOOL_INPUT" | jq -r '.file_path // empty' 2>/dev/null)
            local FILENAME=$(basename "$FILE" 2>/dev/null)
            echo -e "${YELLOW}* Edit${NC}(${DIM}$FILENAME${NC})"
            ;;
        "Write")
            local FILE=$(echo "$TOOL_INPUT" | jq -r '.file_path // empty' 2>/dev/null)
            local FILENAME=$(basename "$FILE" 2>/dev/null)
            local CONTENT=$(echo "$TOOL_INPUT" | jq -r '.content // empty' 2>/dev/null)
            local LINES=$(echo "$CONTENT" | wc -l)
            echo -e "${YELLOW}* Write${NC}(${DIM}$FILENAME${NC}) ${DIM}[$LINES lines]${NC}"
            ;;
        "Glob")
            local PATTERN=$(echo "$TOOL_INPUT" | jq -r '.pattern // empty' 2>/dev/null)
            echo -e "${CYAN}* Glob${NC}(${DIM}$PATTERN${NC})"
            ;;
        "Grep")
            local PATTERN=$(echo "$TOOL_INPUT" | jq -r '.pattern // empty' 2>/dev/null)
            echo -e "${CYAN}* Grep${NC}(${DIM}$(truncate_str "$PATTERN" 40)${NC})"
            ;;
        "Task")
            local DESC=$(echo "$TOOL_INPUT" | jq -r '.description // empty' 2>/dev/null)
            local TYPE=$(echo "$TOOL_INPUT" | jq -r '.subagent_type // empty' 2>/dev/null)
            echo -e "${PURPLE}* Task${NC}(${DIM}$TYPE: $(truncate_str "$DESC" 40)${NC})"
            ;;
        "TodoWrite")
            local TODOS=$(echo "$TOOL_INPUT" | jq -r '.todos | length' 2>/dev/null)
            echo -e "${BLUE}* Todo${NC}(${DIM}$TODOS items${NC})"
            ;;
        "WebFetch"|"WebSearch")
            local URL=$(echo "$TOOL_INPUT" | jq -r '.url // .query // empty' 2>/dev/null)
            echo -e "${CYAN}* $TOOL_NAME${NC}(${DIM}$(truncate_str "$URL" 50)${NC})"
            ;;
        *)
            echo -e "${DIM}* $TOOL_NAME${NC}"
            ;;
    esac
}

# Run Claude and stream rich output
run_claude_streaming() {
    local PROMPT_FILE=$1
    local LAST_TOOL=""
    local LAST_INPUT=""
    local TASK_COST=0

    claude --dangerously-skip-permissions --print --verbose --output-format stream-json "$(cat "$PROMPT_FILE")" 2>&1 | \
        while IFS= read -r line; do
            # Skip empty lines
            [ -z "$line" ] && continue

            local TYPE=$(echo "$line" | jq -r '.type // empty' 2>/dev/null)

            case "$TYPE" in
                "assistant")
                    # Show Claude's text output
                    local TEXT=$(echo "$line" | jq -r '.message.content[]? | select(.type == "text") | .text // empty' 2>/dev/null)
                    if [ -n "$TEXT" ]; then
                        echo -e "$TEXT"
                    fi

                    # Capture tool use for display
                    local TOOL=$(echo "$line" | jq -r '.message.content[]? | select(.type == "tool_use") | .name // empty' 2>/dev/null)
                    local INPUT=$(echo "$line" | jq -r '.message.content[]? | select(.type == "tool_use") | .input // empty' 2>/dev/null)

                    if [ -n "$TOOL" ] && [ "$SHOW_TOOL_DETAILS" = "true" ]; then
                        LAST_TOOL="$TOOL"
                        LAST_INPUT="$INPUT"
                        format_tool_output "$TOOL" "$INPUT" ""
                    elif [ -n "$TOOL" ]; then
                        echo -e "${DIM}-> $TOOL${NC}"
                    fi
                    ;;
                "content_block_start")
                    # Tool use starting
                    local TOOL=$(echo "$line" | jq -r '.content_block.name // empty' 2>/dev/null)
                    if [ -n "$TOOL" ]; then
                        LAST_TOOL="$TOOL"
                    fi
                    ;;
                "content_block_delta")
                    # Tool input streaming - capture for later
                    local INPUT_DELTA=$(echo "$line" | jq -r '.delta.partial_json // empty' 2>/dev/null)
                    if [ -n "$INPUT_DELTA" ]; then
                        LAST_INPUT="${LAST_INPUT}${INPUT_DELTA}"
                    fi
                    ;;
                "tool_result"|"user")
                    # Tool result - could show preview if useful
                    if [ -n "$LAST_TOOL" ] && [ "$SHOW_TOOL_DETAILS" = "true" ]; then
                        local RESULT=$(echo "$line" | jq -r '.message.content[]? | select(.type == "tool_result") | .content // empty' 2>/dev/null)
                        # Show brief result for certain tools
                        if [ "$LAST_TOOL" = "Bash" ] && [ -n "$RESULT" ]; then
                            local PREVIEW=$(echo "$RESULT" | head -c 100 | tr '\n' ' ')
                            [ -n "$PREVIEW" ] && echo -e "  ${DIM}-> $(truncate_str "$PREVIEW" 70)${NC}"
                        fi
                    fi
                    LAST_TOOL=""
                    LAST_INPUT=""
                    ;;
                "result")
                    # Final result with cost
                    if [ "$SHOW_COST" = "true" ]; then
                        local COST=$(echo "$line" | jq -r '.total_cost_usd // 0' 2>/dev/null)
                        TASK_COST=$COST
                        echo -e "\n${DIM}Cost: \$${COST}${NC}"
                        # Update total cost
                        TOTAL_COST=$(echo "$TOTAL_COST + $COST" | bc 2>/dev/null || echo "$COST")
                    fi
                    ;;
            esac
        done

    return ${PIPESTATUS[0]}
}

# Run Claude and capture output to file (for completion promise detection)
# Uses a simpler approach for bash 3.x compatibility
# Supports optional timeout monitoring
run_claude_with_output() {
    local PROMPT_FILE=$1
    local OUTPUT_FILE=$2
    local RAW_OUTPUT=$(mktemp)
    local CLAUDE_PID_FILE=$(mktemp)
    local EXIT_CODE=0

    # Run Claude in background so we can monitor timeout
    (
        claude --dangerously-skip-permissions --print --verbose --output-format stream-json "$(cat "$PROMPT_FILE")" 2>&1 | tee "$RAW_OUTPUT" | \
            while IFS= read -r line; do
                [ -z "$line" ] && continue
                local TYPE=$(echo "$line" | jq -r '.type // empty' 2>/dev/null)
                if [ "$TYPE" = "assistant" ]; then
                    local TEXT=$(echo "$line" | jq -r '.message.content[]? | select(.type == "text") | .text // empty' 2>/dev/null)
                    [ -n "$TEXT" ] && echo -e "$TEXT"
                    local TOOL=$(echo "$line" | jq -r '.message.content[]? | select(.type == "tool_use") | .name // empty' 2>/dev/null)
                    local INPUT=$(echo "$line" | jq -r '.message.content[]? | select(.type == "tool_use") | .input // empty' 2>/dev/null)
                    if [ -n "$TOOL" ] && [ "$SHOW_TOOL_DETAILS" = "true" ]; then
                        format_tool_output "$TOOL" "$INPUT" ""
                    elif [ -n "$TOOL" ]; then
                        echo -e "${DIM}-> $TOOL${NC}"
                    fi
                elif [ "$TYPE" = "result" ]; then
                    if [ "$SHOW_COST" = "true" ]; then
                        local COST=$(echo "$line" | jq -r '.total_cost_usd // 0' 2>/dev/null)
                        echo -e "\n${DIM}Cost: \$${COST}${NC}"
                        TOTAL_COST=$(echo "$TOTAL_COST + $COST" | bc 2>/dev/null || echo "$COST")
                        TASK_COST=$(echo "$TASK_COST + $COST" | bc 2>/dev/null || echo "$COST")
                    fi
                fi
            done
    ) &
    local CLAUDE_WRAPPER_PID=$!
    echo "$CLAUDE_WRAPPER_PID" > "$CLAUDE_PID_FILE"

    # Wait for Claude with timeout monitoring
    if is_timeout_enabled; then
        local TIMEOUT_SECS=$(get_timeout_seconds)
        local TIMEOUT_75=$((TIMEOUT_SECS * 75 / 100))
        local TIMEOUT_90=$((TIMEOUT_SECS * 90 / 100))
        local WAIT_START=$(date +%s)

        while kill -0 "$CLAUDE_WRAPPER_PID" 2>/dev/null; do
            sleep 5  # Check every 5 seconds

            local ELAPSED=$(($(date +%s) - TASK_TIMEOUT_START))

            # Check for 75% warning
            if [ $ELAPSED -ge $TIMEOUT_75 ] && [ "$TIMEOUT_WARNING_75_SHOWN" = "false" ]; then
                TIMEOUT_WARNING_75_SHOWN=true
                echo -e "\n${YELLOW}${BOLD}WARNING: Task has used 75% of timeout (${TASK_TIMEOUT} minutes)${NC}"
                echo -e "${YELLOW}  Elapsed: $((ELAPSED / 60)) minutes, Remaining: $(((TIMEOUT_SECS - ELAPSED) / 60)) minutes${NC}"
            fi

            # Check for 90% warning
            if [ $ELAPSED -ge $TIMEOUT_90 ] && [ "$TIMEOUT_WARNING_90_SHOWN" = "false" ]; then
                TIMEOUT_WARNING_90_SHOWN=true
                echo -e "\n${RED}${BOLD}WARNING: Task has used 90% of timeout (${TASK_TIMEOUT} minutes)${NC}"
                echo -e "${RED}  Elapsed: $((ELAPSED / 60)) minutes, Remaining: $(((TIMEOUT_SECS - ELAPSED) / 60)) minutes${NC}"
                echo -e "${RED}  Task will be interrupted soon!${NC}"
            fi

            # Check for timeout
            if [ $ELAPSED -ge $TIMEOUT_SECS ]; then
                TASK_TIMEOUT_TRIGGERED=true
                log_error "Task timeout reached (${TASK_TIMEOUT} minutes)"

                # Try to save partial work before interrupting
                save_partial_work

                # Gracefully interrupt the Claude process
                graceful_interrupt_claude "$CLAUDE_WRAPPER_PID"
                EXIT_CODE=124  # Standard timeout exit code
                break
            fi
        done

        # If not interrupted by timeout, wait for normal completion
        if [ "$TASK_TIMEOUT_TRIGGERED" = "false" ]; then
            wait "$CLAUDE_WRAPPER_PID" 2>/dev/null
            EXIT_CODE=$?
        fi
    else
        # No timeout, just wait normally
        wait "$CLAUDE_WRAPPER_PID"
        EXIT_CODE=$?
    fi

    # Extract text output for completion promise detection
    cat "$RAW_OUTPUT" | while IFS= read -r line; do
        local TYPE=$(echo "$line" | jq -r '.type // empty' 2>/dev/null)
        if [ "$TYPE" = "assistant" ]; then
            echo "$line" | jq -r '.message.content[]? | select(.type == "text") | .text // empty' 2>/dev/null
        fi
    done > "$OUTPUT_FILE"

    rm -f "$RAW_OUTPUT" "$CLAUDE_PID_FILE"
    return $EXIT_CODE
}

# Check if completion promise is in output
check_completion_promise() {
    local OUTPUT_FILE=$1
    if grep -q "<promise>${COMPLETION_PROMISE}</promise>" "$OUTPUT_FILE" 2>/dev/null; then
        return 0
    fi
    return 1
}

# Check if ready-for-PR promise is in output
check_ready_promise() {
    local OUTPUT_FILE=$1
    if grep -q "<promise>${READY_PROMISE}</promise>" "$OUTPUT_FILE" 2>/dev/null; then
        return 0
    fi
    return 1
}

# Run configured tests and capture output
run_tests_with_output() {
    local RESULT_FILE=$1
    local ALL_PASSED=true
    local REPO_ROOT="$(pwd)"

    > "$RESULT_FILE"

    # Handle case where no verification commands are configured
    if [ -z "$TEST_COMMAND" ] && [ -z "$BUILD_COMMAND" ]; then
        log_warn "No test/build commands configured - skipping verification"
        echo "=== VERIFICATION SKIPPED ===" >> "$RESULT_FILE"
        echo "No test_command or build_command configured in chadgi-config.yaml" >> "$RESULT_FILE"
        echo "STATUS: SKIPPED (no commands configured)" >> "$RESULT_FILE"
        return 0
    fi

    if [ -n "$TEST_COMMAND" ]; then
        log_step "Running tests: $TEST_COMMAND"
        echo "=== TEST RESULTS ===" >> "$RESULT_FILE"
        if (eval "$TEST_COMMAND") >> "$RESULT_FILE" 2>&1; then
            log_success "Tests passed"
            echo "STATUS: PASSED" >> "$RESULT_FILE"
        else
            log_error "Tests failed"
            echo "STATUS: FAILED" >> "$RESULT_FILE"
            # Show last few lines of error output for visibility
            echo -e "${DIM}Last 10 lines of output:${NC}"
            tail -10 "$RESULT_FILE" | sed 's/^/  /'
            ALL_PASSED=false
        fi
    fi

    if [ -n "$BUILD_COMMAND" ]; then
        log_step "Running build: $BUILD_COMMAND"
        echo "" >> "$RESULT_FILE"
        echo "=== BUILD RESULTS ===" >> "$RESULT_FILE"
        if (eval "$BUILD_COMMAND") >> "$RESULT_FILE" 2>&1; then
            log_success "Build passed"
            echo "STATUS: PASSED" >> "$RESULT_FILE"
        else
            log_error "Build failed"
            echo "STATUS: FAILED" >> "$RESULT_FILE"
            # Show last few lines of error output for visibility
            echo -e "${DIM}Last 10 lines of output:${NC}"
            tail -10 "$RESULT_FILE" | sed 's/^/  /'
            ALL_PASSED=false
        fi
    fi

    if [ "$ALL_PASSED" = "true" ]; then
        return 0
    else
        return 1
    fi
}

#------------------------------------------------------------------------------
# GigaChad Mode - Auto-merge and sync
#------------------------------------------------------------------------------

# Merge the PR and pull latest to local
# Returns 0 on success, 1 on failure
gigachad_merge_and_sync() {
    local PR_NUMBER=$1

    log_header "GIGACHAD MODE ACTIVATED"
    echo -e "${PURPLE}${BOLD}     Chad doesn't wait for reviews. Chad ships.${NC}"
    echo ""

    # Get PR title to prefix it for easy identification in git history
    local PR_TITLE=$(gh pr view "$PR_NUMBER" --repo "$REPO" --json title -q '.title' 2>/dev/null)
    local PREFIXED_TITLE="$GIGACHAD_COMMIT_PREFIX $PR_TITLE"

    # Merge the PR using squash (cleaner history) with prefixed commit message
    log_step "Merging PR #$PR_NUMBER into $BASE_BRANCH..."
    log_info "Commit prefix: $GIGACHAD_COMMIT_PREFIX"
    if gh pr merge "$PR_NUMBER" --repo "$REPO" --squash --delete-branch --subject "$PREFIXED_TITLE" 2>/dev/null; then
        log_success "PR #$PR_NUMBER merged successfully!"
    else
        # Try regular merge if squash fails (note: regular merge doesn't support --subject)
        log_warn "Squash merge failed, trying regular merge..."
        if gh pr merge "$PR_NUMBER" --repo "$REPO" --merge --delete-branch 2>/dev/null; then
            log_success "PR #$PR_NUMBER merged successfully!"
            log_warn "Note: Regular merge used - commit prefix not applied"
        else
            log_error "Failed to merge PR #$PR_NUMBER"
            return 1
        fi
    fi

    # Pull the latest from the target branch
    log_step "Pulling latest $BASE_BRANCH to local..."
    git checkout "$BASE_BRANCH" 2>/dev/null || git checkout "origin/$BASE_BRANCH" 2>/dev/null
    if git pull origin "$BASE_BRANCH" 2>/dev/null; then
        log_success "Local $BASE_BRANCH is now up to date!"
    else
        log_warn "Could not pull latest - may need manual sync"
    fi

    # Get the merge commit SHA and send notification
    local MERGE_COMMIT_SHA=$(git rev-parse HEAD 2>/dev/null | cut -c1-7)
    notify_gigachad_merge "$PR_NUMBER" "$MERGE_COMMIT_SHA"

    return 0
}

# Run task in dry-run mode - explore without making changes
# Shows what would happen and allows Claude to explore the codebase
run_task_dry_run() {
    local PROMPT_FILE=$1

    log_header "DRY-RUN MODE - SIMULATING WORKFLOW"
    log_dry_run "In normal mode, ChadGI would:"
    echo -e "  1. Run Claude with full permissions to implement the task"
    echo -e "  2. Execute test command: ${TEST_COMMAND:-'(none configured)'}"
    echo -e "  3. Execute build command: ${BUILD_COMMAND:-'(none configured)'}"
    echo -e "  4. Create a PR targeting $BASE_BRANCH"
    if [ "$GIGACHAD_MODE" = "true" ]; then
        echo -e "  5. ${PURPLE}[GIGACHAD]${NC} Auto-merge the PR and move to Done"
    else
        echo -e "  5. Move issue to '$REVIEW_COLUMN' column"
    fi
    echo ""

    # Show what PR would be created
    log_dry_run "PR that would be created:"
    echo -e "  Title: ${ISSUE_PREFIX} <implementation title>"
    echo -e "  Base: $BASE_BRANCH"
    echo -e "  Head: $BRANCH_NAME"
    echo -e "  Body: Summary of changes + 'Closes #$ISSUE_NUMBER'"
    echo ""

    # Show GigaChad warnings if enabled
    if [ "$GIGACHAD_MODE" = "true" ]; then
        echo -e "${YELLOW}${BOLD}WARNING: GigaChad mode is ENABLED${NC}"
        echo -e "${YELLOW}  - PRs would be auto-merged without human review${NC}"
        echo -e "${YELLOW}  - Issues would be moved directly to '$DONE_COLUMN'${NC}"
        echo -e "${YELLOW}  - Consider disabling for initial testing${NC}"
        echo ""
    fi

    # Run Claude in exploration mode (no --dangerously-skip-permissions)
    log_header "EXPLORING CODEBASE (Read-Only Mode)"
    log_info "Running Claude without write permissions for safe exploration..."
    echo ""

    # Create a modified prompt for dry-run exploration
    local DRY_RUN_PROMPT=$(mktemp)
    cat > "$DRY_RUN_PROMPT" << DRY_RUN_EOF
[DRY-RUN MODE] You are in dry-run/exploration mode. Your task is to:

1. READ and understand the issue requirements
2. EXPLORE the codebase to understand what changes would be needed
3. DESCRIBE what you would do to implement this (but do NOT make any changes)

Issue Details:
- Number: #$ISSUE_NUMBER
- Title: $ISSUE_TITLE
- URL: $ISSUE_URL

Issue Description:
$ISSUE_BODY

Please explore the codebase and explain:
1. What files would need to be modified?
2. What is your implementation approach?
3. What tests would you add or modify?
4. Any potential challenges or considerations?

Remember: This is READ-ONLY exploration. Do not create, edit, or delete any files.
Do not run any commands that would modify the repository.
DRY_RUN_EOF

    # Run Claude with --print only (no dangerous permissions)
    claude --print "$(cat "$DRY_RUN_PROMPT")" 2>&1 || true

    rm -f "$DRY_RUN_PROMPT"

    echo ""
    log_header "DRY-RUN COMPLETE"
    log_success "Exploration finished - no changes were made"
    log_info "To run for real, use: chadgi start (without --dry-run)"

    return 0
}

# Run task with iteration loop using --continue for session continuity
# Two-phase approach:
#   Phase 1: Implementation - Claude implements, tests locally, commits (outputs READY_FOR_PR)
#   Phase 2: PR Creation - After tests pass, Claude creates PR (outputs COMPLETE)
# This ensures tests pass BEFORE a PR is created
run_task_with_iterations() {
    local PROMPT_FILE=$1
    local ITERATION=1
    local IMPL_COMPLETE=false
    local TASK_COMPLETE=false
    local OUTPUT_FILE=$(mktemp)
    local TEST_RESULTS=$(mktemp)
    local SESSION_ACTIVE=false

    log_info "Max iterations: $MAX_ITERATIONS (using session continuity)"
    log_info "Two-phase flow: Implementation -> Test Verification -> PR Creation"
    if is_timeout_enabled; then
        log_info "Task timeout: ${TASK_TIMEOUT} minutes"
    fi

    # Start task timeout tracking
    start_task_timeout

    # Track phase 1 start time for metrics
    TASK_PHASE1_START=$(date +%s)

    #---------------------------------------------------------------------------
    # PHASE 1: Implementation Loop
    # Claude implements the feature, runs tests locally, commits
    # Loop continues until tests pass AND READY_FOR_PR promise is found
    #---------------------------------------------------------------------------
    while [ $ITERATION -le $MAX_ITERATIONS ] && [ "$IMPL_COMPLETE" = "false" ]; do
        log_header "PHASE 1: IMPLEMENTATION (Iteration $ITERATION / $MAX_ITERATIONS)"

        # Track iterations for metrics
        TASK_ITERATIONS=$ITERATION

        # Clear output file for this iteration
        > "$OUTPUT_FILE"

        if [ "$SESSION_ACTIVE" = "false" ]; then
            # FIRST ITERATION: Start fresh with full prompt
            log_step "Starting new session..."
            run_claude_with_output "$PROMPT_FILE" "$OUTPUT_FILE"
            SESSION_ACTIVE=true
        else
            # SUBSEQUENT ITERATIONS: Continue same session with test feedback
            log_step "Continuing session with test feedback..."

            # Build continuation prompt with test results
            local REMAINING=$((MAX_ITERATIONS - ITERATION))
            local CONTINUE_PROMPT="## Iteration Status: $ITERATION of $MAX_ITERATIONS ($REMAINING remaining)

The previous iteration completed. Here are the test/build results:

$(cat "$TEST_RESULTS")

"
            if grep -q "FAILED" "$TEST_RESULTS" 2>/dev/null; then
                CONTINUE_PROMPT="${CONTINUE_PROMPT}## VERIFICATION FAILED

"
                # Add urgency message if running low on iterations
                if [ $REMAINING -le 1 ]; then
                    CONTINUE_PROMPT="${CONTINUE_PROMPT}**FINAL ITERATION** - This is your last chance. Focus on the most critical fix only.

"
                elif [ $REMAINING -le 2 ]; then
                    CONTINUE_PROMPT="${CONTINUE_PROMPT}**Running low on iterations** - Prioritize fixing the blocking issue directly.

"
                fi
                CONTINUE_PROMPT="${CONTINUE_PROMPT}Follow these steps IN ORDER to fix efficiently:
1. **Identify**: Find the EXACT error message or failing test name in the output above
2. **Locate**: Read the specific file(s) mentioned in the error
3. **Fix**: Make the minimal change to fix the issue
4. **Verify**: Run the test/build command yourself to confirm the fix

Do NOT re-run all tests blindly - focus on the specific failure first.

"
            else
                CONTINUE_PROMPT="${CONTINUE_PROMPT}## TESTS PASSED - Complete the Pre-PR Checklist

Tests and build passed. Before signaling ready, you MUST output the Pre-PR Checklist from the original instructions:

1. **Tests Added** - List the test files you created/modified
2. **Requirements Verification** - Map each issue requirement to where you implemented it
3. **Test Results** - Confirm tests pass (they do)
4. **Self-Review** - Run \`git diff HEAD~1\`, note any issues found and fixed

After completing the checklist, output: <promise>${READY_PROMISE}</promise>

If you're still implementing features, continue working. Don't signal until ALL requirements are done.

"
            fi

            CONTINUE_PROMPT="${CONTINUE_PROMPT}Do NOT create a PR yet - that comes after verification passes."

            # Continue the same session
            claude --continue --dangerously-skip-permissions --print --verbose --output-format stream-json "$CONTINUE_PROMPT" 2>&1 | tee -a "$OUTPUT_FILE.raw" | \
                while IFS= read -r line; do
                    [ -z "$line" ] && continue
                    local TYPE=$(echo "$line" | jq -r '.type // empty' 2>/dev/null)
                    if [ "$TYPE" = "assistant" ]; then
                        local TEXT=$(echo "$line" | jq -r '.message.content[]? | select(.type == "text") | .text // empty' 2>/dev/null)
                        [ -n "$TEXT" ] && echo -e "$TEXT"
                        [ -n "$TEXT" ] && echo "$TEXT" >> "$OUTPUT_FILE"
                        local TOOL=$(echo "$line" | jq -r '.message.content[]? | select(.type == "tool_use") | .name // empty' 2>/dev/null)
                        if [ -n "$TOOL" ] && [ "$SHOW_TOOL_DETAILS" = "true" ]; then
                            local INPUT=$(echo "$line" | jq -r '.message.content[]? | select(.type == "tool_use") | .input // empty' 2>/dev/null)
                            format_tool_output "$TOOL" "$INPUT" ""
                        elif [ -n "$TOOL" ]; then
                            echo -e "${DIM}-> $TOOL${NC}"
                        fi
                    elif [ "$TYPE" = "result" ]; then
                        if [ "$SHOW_COST" = "true" ]; then
                            local COST=$(echo "$line" | jq -r '.total_cost_usd // 0' 2>/dev/null)
                            echo -e "\n${DIM}Cost: \$${COST}${NC}"
                            TOTAL_COST=$(echo "$TOTAL_COST + $COST" | bc 2>/dev/null || echo "$COST")
                            TASK_COST=$(echo "$TASK_COST + $COST" | bc 2>/dev/null || echo "$COST")
                        fi
                    fi
                done
        fi

        # Check for ready-for-PR promise in output
        if check_ready_promise "$OUTPUT_FILE"; then
            log_success "Ready-for-PR promise found!"

            # Run tests to verify implementation
            log_step "Verifying implementation with tests/build..."
            local VERIFY_START=$(date +%s)
            if run_tests_with_output "$TEST_RESULTS"; then
                log_success "All verification checks passed!"
                IMPL_COMPLETE=true
            else
                # Classify the build/test failure for better feedback
                classify_error 1 "$TEST_RESULTS" "verification"
                if [ -n "$LAST_ERROR_TYPE" ]; then
                    log_warn "Verification failed (${LAST_ERROR_TYPE}) - continuing iteration loop"
                else
                    log_warn "Verification failed - continuing iteration loop"
                fi
                # Track retry for metrics
                TASK_RETRY_COUNT=$((TASK_RETRY_COUNT + 1))
            fi
            # Accumulate verification time for metrics
            TASK_VERIFICATION_TIME=$((TASK_VERIFICATION_TIME + $(date +%s) - VERIFY_START))
        else
            log_info "No ready-for-PR promise yet"

            # Run tests to provide feedback for next iteration
            local VERIFY_START=$(date +%s)
            if ! run_tests_with_output "$TEST_RESULTS"; then
                # Classify any failure for informational purposes
                classify_error 1 "$TEST_RESULTS" "verification"
            fi
            # Accumulate verification time for metrics
            TASK_VERIFICATION_TIME=$((TASK_VERIFICATION_TIME + $(date +%s) - VERIFY_START))
        fi

        if [ "$IMPL_COMPLETE" = "false" ]; then
            # Check budget limits before continuing to next iteration
            local BUDGET_RESULT
            check_budgets_and_act "${TASK_COST:-0}" "${TOTAL_COST:-0}" "$ISSUE_NUMBER"
            BUDGET_RESULT=$?

            if [ $BUDGET_RESULT -eq 2 ]; then
                # Session budget exceeded - stop immediately
                log_error "Stopping task due to session budget limit"
                TASK_BUDGET_EXCEEDED=true
                SESSION_BUDGET_EXCEEDED=true
                break
            elif [ $BUDGET_RESULT -eq 1 ]; then
                # Task budget exceeded - skip this task
                log_error "Stopping task due to task budget limit"
                TASK_BUDGET_EXCEEDED=true
                break
            fi

            ITERATION=$((ITERATION + 1))
            if [ $ITERATION -le $MAX_ITERATIONS ]; then
                # Calculate retry delay based on backoff strategy
                local DELAY=$(calculate_retry_delay $ITERATION)
                log_retry_delay $DELAY $ITERATION
                # Track error recovery time for metrics
                TASK_ERROR_RECOVERY_TIME=$((TASK_ERROR_RECOVERY_TIME + DELAY))
                sleep $DELAY
            fi
        fi
    done

    # Check if Phase 1 succeeded
    if [ "$IMPL_COMPLETE" = "false" ]; then
        # Stop timeout monitor and clean up
        stop_task_timeout
        rm -f "$OUTPUT_FILE" "$OUTPUT_FILE.raw" "$TEST_RESULTS"

        # Track phase 1 failure for metrics
        TASK_FAILURE_PHASE="phase1"

        if [ "$TASK_BUDGET_EXCEEDED" = "true" ]; then
            if [ "$SESSION_BUDGET_EXCEEDED" = "true" ]; then
                log_error "Task stopped due to session budget exceeded"
                return 125  # Custom exit code for session budget exceeded
            else
                log_error "Task stopped due to task budget exceeded"
                return 126  # Custom exit code for task budget exceeded
            fi
        elif [ "$TASK_TIMEOUT_TRIGGERED" = "true" ]; then
            log_error "Task timed out after ${TASK_TIMEOUT} minutes"
            return 124  # Standard timeout exit code
        else
            log_error "Max iterations ($MAX_ITERATIONS) reached without passing verification"
            return 1
        fi
    fi

    # Track phase 1 completion for metrics
    TASK_PHASE1_END=$(date +%s)

    #---------------------------------------------------------------------------
    # LIFECYCLE HOOK: post_implementation
    # Runs after Claude finishes implementation (READY_FOR_PR found, tests pass)
    #---------------------------------------------------------------------------
    run_hook "post_implementation"

    #---------------------------------------------------------------------------
    # INTERACTIVE: Phase 1 Approval Checkpoint
    # Requires human approval before proceeding to PR creation
    #---------------------------------------------------------------------------
    if [ "$INTERACTIVE_ENABLED" = "true" ]; then
        log_header "AWAITING APPROVAL: POST-IMPLEMENTATION REVIEW"
        local APPROVAL_RESULT
        wait_for_approval "phase1" "$ISSUE_NUMBER" "$ISSUE_TITLE" "$BRANCH_NAME"
        APPROVAL_RESULT=$?

        if [ $APPROVAL_RESULT -eq 2 ]; then
            # Skip task
            log_warn "Task skipped by human reviewer"
            stop_task_timeout
            rm -f "$OUTPUT_FILE" "$OUTPUT_FILE.raw" "$TEST_RESULTS"
            return 127  # Custom exit code for skipped task
        elif [ $APPROVAL_RESULT -eq 1 ]; then
            # Rejected with feedback - loop back to Phase 1
            log_warn "Changes rejected. Iterating with feedback..."
            IMPL_COMPLETE=false
            ITERATION=$((ITERATION + 1))

            if [ $ITERATION -le $MAX_ITERATIONS ]; then
                # Continue to next iteration with feedback
                local REJECT_FEEDBACK="${APPROVAL_FEEDBACK:-Please review and improve the implementation.}"

                local CONTINUE_PROMPT="## HUMAN REVIEW FEEDBACK

Your implementation was reviewed and the reviewer has requested changes:

**Feedback:** $REJECT_FEEDBACK

Please address this feedback and make the necessary improvements. After making changes:
1. Run the tests to verify your changes work
2. Commit your changes
3. Output: <promise>${READY_PROMISE}</promise>

Do NOT create a PR yet - that comes after the review is approved."

                # Clear output file
                > "$OUTPUT_FILE"

                # Continue the session with feedback
                claude --continue --dangerously-skip-permissions --print --verbose --output-format stream-json "$CONTINUE_PROMPT" 2>&1 | tee -a "$OUTPUT_FILE.raw" | \
                    while IFS= read -r line; do
                        [ -z "$line" ] && continue
                        local TYPE=$(echo "$line" | jq -r '.type // empty' 2>/dev/null)
                        if [ "$TYPE" = "assistant" ]; then
                            local TEXT=$(echo "$line" | jq -r '.message.content[]? | select(.type == "text") | .text // empty' 2>/dev/null)
                            [ -n "$TEXT" ] && echo -e "$TEXT"
                            [ -n "$TEXT" ] && echo "$TEXT" >> "$OUTPUT_FILE"
                        fi
                    done

                # Re-run verification and loop
                if run_tests_with_output "$TEST_RESULTS"; then
                    IMPL_COMPLETE=true
                fi
            fi

            # If still not complete or max iterations reached, handle accordingly
            if [ "$IMPL_COMPLETE" = "false" ]; then
                log_error "Unable to satisfy review feedback within iteration limit"
                stop_task_timeout
                rm -f "$OUTPUT_FILE" "$OUTPUT_FILE.raw" "$TEST_RESULTS"
                return 1
            fi
        fi
        # If approved (APPROVAL_RESULT=0), continue to Phase 2
    fi

    #---------------------------------------------------------------------------
    # PHASE 2: PR Creation
    # Tests have passed - now ask Claude to create the PR
    #---------------------------------------------------------------------------
    log_header "PHASE 2: CREATING PULL REQUEST"
    log_step "Tests passed! Asking Claude to create the PR..."

    # Track phase 2 start time for metrics
    TASK_PHASE2_START=$(date +%s)

    > "$OUTPUT_FILE"

    #---------------------------------------------------------------------------
    # LIFECYCLE HOOK: pre_pr
    # Runs before PR creation. Can abort if can_abort is true.
    #---------------------------------------------------------------------------
    if ! run_hook "pre_pr"; then
        log_error "Pre-PR hook aborted PR creation"
        stop_task_timeout
        rm -f "$OUTPUT_FILE" "$OUTPUT_FILE.raw" "$TEST_RESULTS"
        return 128  # Custom exit code for hook abort
    fi

    #---------------------------------------------------------------------------
    # INTERACTIVE: Phase 2 Approval Checkpoint
    # Requires human approval before creating the PR
    #---------------------------------------------------------------------------
    if [ "$INTERACTIVE_ENABLED" = "true" ]; then
        log_header "AWAITING APPROVAL: PRE-PR CREATION REVIEW"
        local APPROVAL_RESULT
        wait_for_approval "phase2" "$ISSUE_NUMBER" "$ISSUE_TITLE" "$BRANCH_NAME"
        APPROVAL_RESULT=$?

        if [ $APPROVAL_RESULT -eq 2 ]; then
            # Skip task
            log_warn "PR creation skipped by human reviewer"
            stop_task_timeout
            rm -f "$OUTPUT_FILE" "$OUTPUT_FILE.raw" "$TEST_RESULTS"
            return 127  # Custom exit code for skipped task
        elif [ $APPROVAL_RESULT -eq 1 ]; then
            # Rejected with feedback - this shouldn't normally happen at phase2
            # but handle it by going back to fix issues
            log_warn "PR creation rejected. Reviewer feedback: ${APPROVAL_FEEDBACK:-No feedback provided}"
            log_info "Please address the feedback and run 'chadgi approve' when ready to proceed."

            # For phase2 rejection, we'll just wait for approval again rather than iterating
            # because the implementation is already complete
            wait_for_approval "phase2" "$ISSUE_NUMBER" "$ISSUE_TITLE" "$BRANCH_NAME"
            APPROVAL_RESULT=$?

            if [ $APPROVAL_RESULT -ne 0 ]; then
                log_error "PR creation not approved. Stopping task."
                stop_task_timeout
                rm -f "$OUTPUT_FILE" "$OUTPUT_FILE.raw" "$TEST_RESULTS"
                return 127
            fi
        fi
        # If approved (APPROVAL_RESULT=0), continue to create PR
        log_success "PR creation approved!"
    fi

    # Generate PR footer using branding config
    local PR_FOOTER=""
    if [ "$INCLUDE_FOOTER" = "true" ]; then
        PR_FOOTER=$(get_chad_footer "pr")
        # Escape for nested heredoc
        PR_FOOTER=$(echo "$PR_FOOTER" | sed 's/`/\\`/g')
    fi

    local PR_PROMPT="Excellent! All tests and build verification have passed.

${CHAD_TAGLINE}

Now please:
1. Push the branch to origin
2. Create a Pull Request targeting **${BASE_BRANCH}** using this EXACT format:

\`\`\`bash
gh pr create --base ${BASE_BRANCH} --title \"${ISSUE_PREFIX} <your clear title summarizing the change>\" --body \"\$(cat <<'EOF'
## Summary
<bullet points of what changed>

## Test Plan
<how to verify this works>

Closes #${ISSUE_NUMBER}
${PR_FOOTER}
EOF
)\"
\`\`\`

After creating the PR, output: <promise>${COMPLETION_PROMISE}</promise>"

    claude --continue --dangerously-skip-permissions --print --verbose --output-format stream-json "$PR_PROMPT" 2>&1 | tee -a "$OUTPUT_FILE.raw" | \
        while IFS= read -r line; do
            [ -z "$line" ] && continue
            local TYPE=$(echo "$line" | jq -r '.type // empty' 2>/dev/null)
            if [ "$TYPE" = "assistant" ]; then
                local TEXT=$(echo "$line" | jq -r '.message.content[]? | select(.type == "text") | .text // empty' 2>/dev/null)
                [ -n "$TEXT" ] && echo -e "$TEXT"
                [ -n "$TEXT" ] && echo "$TEXT" >> "$OUTPUT_FILE"
                local TOOL=$(echo "$line" | jq -r '.message.content[]? | select(.type == "tool_use") | .name // empty' 2>/dev/null)
                if [ -n "$TOOL" ] && [ "$SHOW_TOOL_DETAILS" = "true" ]; then
                    local INPUT=$(echo "$line" | jq -r '.message.content[]? | select(.type == "tool_use") | .input // empty' 2>/dev/null)
                    format_tool_output "$TOOL" "$INPUT" ""
                elif [ -n "$TOOL" ]; then
                    echo -e "${DIM}-> $TOOL${NC}"
                fi
            elif [ "$TYPE" = "result" ]; then
                if [ "$SHOW_COST" = "true" ]; then
                    local COST=$(echo "$line" | jq -r '.total_cost_usd // 0' 2>/dev/null)
                    echo -e "\n${DIM}Cost: \$${COST}${NC}"
                    TOTAL_COST=$(echo "$TOTAL_COST + $COST" | bc 2>/dev/null || echo "$COST")
                    TASK_COST=$(echo "$TASK_COST + $COST" | bc 2>/dev/null || echo "$COST")
                fi
            fi
        done

    # Check for completion promise
    if check_completion_promise "$OUTPUT_FILE"; then
        log_success "PR created successfully!"
        TASK_COMPLETE=true
    else
        log_warn "No completion promise after PR creation - check manually"
        # Still mark as complete since tests passed
        TASK_COMPLETE=true
    fi

    # Track phase 2 completion for metrics
    TASK_PHASE2_END=$(date +%s)

    # Extract PR info from output for notifications
    COMPLETED_PR_URL=$(cat "$OUTPUT_FILE" "$OUTPUT_FILE.raw" 2>/dev/null | grep -oE "https://github.com/[^/]+/[^/]+/pull/[0-9]+" | head -1 || echo "")

    #---------------------------------------------------------------------------
    # LIFECYCLE HOOK: post_pr
    # Runs after PR is created
    #---------------------------------------------------------------------------
    if [ "$TASK_COMPLETE" = "true" ]; then
        run_hook "post_pr"
    fi

    # If GigaChad mode is enabled, auto-merge the PR
    if [ "$GIGACHAD_MODE" = "true" ] && [ "$TASK_COMPLETE" = "true" ]; then
        # Extract PR number from the output (look for PR URL pattern)
        local PR_NUM=$(cat "$OUTPUT_FILE" "$OUTPUT_FILE.raw" 2>/dev/null | grep -oE "pull/[0-9]+" | head -1 | sed 's/pull\///')

        if [ -z "$PR_NUM" ]; then
            # Try to get PR number from gh pr list
            PR_NUM=$(gh pr list --repo "$REPO" --head "$BRANCH_NAME" --json number -q '.[0].number' 2>/dev/null)
        fi

        if [ -n "$PR_NUM" ]; then
            GIGACHAD_MERGED_PR="$PR_NUM"
            gigachad_merge_and_sync "$PR_NUM"
            GIGACHAD_MERGED=true

            #-------------------------------------------------------------------
            # LIFECYCLE HOOK: post_merge
            # Runs after GigaChad mode auto-merges the PR
            #-------------------------------------------------------------------
            run_hook "post_merge"
        else
            log_warn "Could not find PR number for auto-merge"
            GIGACHAD_MERGED=false
        fi
    else
        GIGACHAD_MERGED=false
    fi

    # Stop timeout monitor
    stop_task_timeout

    rm -f "$OUTPUT_FILE" "$OUTPUT_FILE.raw" "$TEST_RESULTS"

    if [ "$TASK_COMPLETE" = "true" ]; then
        return 0
    else
        return 1
    fi
}

#------------------------------------------------------------------------------
# GitHub Project Board Integration
#------------------------------------------------------------------------------

# Cache for project board data (to avoid repeated API calls)
PROJECT_ID=""
STATUS_FIELD_ID=""
READY_OPTION_ID=""
IN_PROGRESS_OPTION_ID=""
REVIEW_OPTION_ID=""
DONE_OPTION_ID=""
GITHUB_USERNAME=""

# GigaChad mode state tracking
GIGACHAD_MERGED=false
GIGACHAD_MERGED_PR=""

# Get the current GitHub username
get_github_username() {
    if [ -z "$GITHUB_USERNAME" ]; then
        GITHUB_USERNAME=$(gh api user -q '.login' 2>/dev/null || echo "")
        if [ -z "$GITHUB_USERNAME" ]; then
            log_warn "Could not determine GitHub username - issues will not be auto-assigned"
        fi
    fi
    echo "$GITHUB_USERNAME"
}

# Initialize project board cache
init_project_board() {
    log_step "Initializing project board connection..."

    # Get project ID
    PROJECT_ID=$(gh project list --owner "$REPO_OWNER" --format json 2>/dev/null | \
        jq -r --arg num "$PROJECT_NUMBER" '.projects[] | select(.number == ($num | tonumber)) | .id' 2>/dev/null)

    if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "null" ]; then
        log_error "Could not find project #$PROJECT_NUMBER"
        log_info "Make sure you have access: gh auth refresh -s project"
        exit 1
    fi

    # Get Status field info
    local FIELDS=$(gh project field-list "$PROJECT_NUMBER" --owner "$REPO_OWNER" --format json 2>/dev/null)
    STATUS_FIELD_ID=$(echo "$FIELDS" | jq -r '.fields[] | select(.name == "Status") | .id' 2>/dev/null)

    if [ -z "$STATUS_FIELD_ID" ] || [ "$STATUS_FIELD_ID" = "null" ]; then
        log_error "Could not find Status field in project"
        exit 1
    fi

    # Cache status option IDs (using simple variables instead of associative array for bash 3 compat)
    READY_OPTION_ID=$(echo "$FIELDS" | jq -r --arg col "$READY_COLUMN" \
        '.fields[] | select(.name == "Status") | .options[] | select(.name == $col) | .id' 2>/dev/null | head -1)
    IN_PROGRESS_OPTION_ID=$(echo "$FIELDS" | jq -r --arg col "$IN_PROGRESS_COLUMN" \
        '.fields[] | select(.name == "Status") | .options[] | select(.name == $col) | .id' 2>/dev/null | head -1)
    REVIEW_OPTION_ID=$(echo "$FIELDS" | jq -r --arg col "$REVIEW_COLUMN" \
        '.fields[] | select(.name == "Status") | .options[] | select(.name == $col) | .id' 2>/dev/null | head -1)
    DONE_OPTION_ID=$(echo "$FIELDS" | jq -r --arg col "$DONE_COLUMN" \
        '.fields[] | select(.name == "Status") | .options[] | select(.name == $col) | .id' 2>/dev/null | head -1)

    # Get GitHub username for auto-assignment
    get_github_username > /dev/null
    if [ -n "$GITHUB_USERNAME" ]; then
        log_success "Connected to project #$PROJECT_NUMBER (as @$GITHUB_USERNAME)"
    else
        log_success "Connected to project #$PROJECT_NUMBER"
    fi
}

# Get issues in a specific column
get_issues_in_column() {
    local COLUMN=$1

    # Get all project items
    local ITEMS=$(gh project item-list "$PROJECT_NUMBER" --owner "$REPO_OWNER" --format json --limit 100 2>/dev/null)

    # Filter by status column and return issue info
    echo "$ITEMS" | jq -r --arg col "$COLUMN" '
        .items[] |
        select(.status == $col) |
        select(.content.type == "Issue") |
        {number: .content.number, title: .content.title, url: .content.url, item_id: .id}
    ' 2>/dev/null
}

# Get labels for an issue (returns space-separated list)
get_issue_labels() {
    local ISSUE_NUM=$1
    gh issue view "$ISSUE_NUM" --repo "$REPO" --json labels -q '.labels[].name' 2>/dev/null | tr '\n' ' ' || echo ""
}

# Determine priority level for an issue based on its labels
# Returns: 0=critical, 1=high, 2=normal (default), 3=low
# Also sets CURRENT_PRIORITY_NAME to the human-readable priority name
get_issue_priority() {
    local ISSUE_NUM=$1
    local LABELS=$(get_issue_labels "$ISSUE_NUM")

    # Check for critical priority labels
    for label in $PRIORITY_LABELS_CRITICAL; do
        if echo " $LABELS " | grep -qi " $label "; then
            CURRENT_PRIORITY_NAME="critical"
            echo 0
            return
        fi
    done

    # Check for high priority labels
    for label in $PRIORITY_LABELS_HIGH; do
        if echo " $LABELS " | grep -qi " $label "; then
            CURRENT_PRIORITY_NAME="high"
            echo 1
            return
        fi
    done

    # Check for low priority labels (check before normal to ensure explicit low takes precedence)
    for label in $PRIORITY_LABELS_LOW; do
        if echo " $LABELS " | grep -qi " $label "; then
            CURRENT_PRIORITY_NAME="low"
            echo 3
            return
        fi
    done

    # Check for normal priority labels (explicit normal)
    for label in $PRIORITY_LABELS_NORMAL; do
        if echo " $LABELS " | grep -qi " $label "; then
            CURRENT_PRIORITY_NAME="normal"
            echo 2
            return
        fi
    done

    # Default to normal priority
    CURRENT_PRIORITY_NAME="normal"
    echo 2
}

# Get priority name for display
get_priority_name() {
    local PRIORITY_NUM=$1
    case "$PRIORITY_NUM" in
        0) echo "critical" ;;
        1) echo "high" ;;
        3) echo "low" ;;
        *) echo "normal" ;;
    esac
}

# Determine task category for an issue based on its labels
# Returns: category name (bug, feature, refactor, docs, test, chore, or empty)
# Also sets CURRENT_TASK_CATEGORY to the detected category
get_issue_category() {
    local ISSUE_NUM=$1
    local LABELS=$(get_issue_labels "$ISSUE_NUM")

    # If category detection is disabled, return empty
    if [ "$CATEGORY_ENABLED" != "true" ]; then
        CURRENT_TASK_CATEGORY=""
        echo ""
        return
    fi

    # Check for bug labels
    for label in $CATEGORY_LABELS_BUG; do
        if echo " $LABELS " | grep -qi " $label "; then
            CURRENT_TASK_CATEGORY="bug"
            echo "bug"
            return
        fi
    done

    # Check for feature labels
    for label in $CATEGORY_LABELS_FEATURE; do
        if echo " $LABELS " | grep -qi " $label "; then
            CURRENT_TASK_CATEGORY="feature"
            echo "feature"
            return
        fi
    done

    # Check for refactor labels
    for label in $CATEGORY_LABELS_REFACTOR; do
        if echo " $LABELS " | grep -qi " $label "; then
            CURRENT_TASK_CATEGORY="refactor"
            echo "refactor"
            return
        fi
    done

    # Check for docs labels
    for label in $CATEGORY_LABELS_DOCS; do
        if echo " $LABELS " | grep -qi " $label "; then
            CURRENT_TASK_CATEGORY="docs"
            echo "docs"
            return
        fi
    done

    # Check for test labels
    for label in $CATEGORY_LABELS_TEST; do
        if echo " $LABELS " | grep -qi " $label "; then
            CURRENT_TASK_CATEGORY="test"
            echo "test"
            return
        fi
    done

    # Check for chore labels
    for label in $CATEGORY_LABELS_CHORE; do
        if echo " $LABELS " | grep -qi " $label "; then
            CURRENT_TASK_CATEGORY="chore"
            echo "chore"
            return
        fi
    done

    # No matching category found
    CURRENT_TASK_CATEGORY=""
    echo ""
}

#------------------------------------------------------------------------------
# Task Dependency Functions
#------------------------------------------------------------------------------

# Global cache for dependency resolution
declare -A DEPENDENCY_CACHE=()
DEPENDENCY_CACHE_TIME=0

# Extract issue numbers that this issue depends on from the issue body
# Looks for patterns like "depends on #123", "blocked by #456", "requires #789"
# Returns space-separated list of issue numbers
parse_issue_dependencies() {
    local ISSUE_BODY="$1"

    if [ -z "$ISSUE_BODY" ] || [ "$ISSUE_BODY" = "null" ]; then
        echo ""
        return
    fi

    # Build regex pattern from DEPENDENCY_PATTERNS
    # Patterns: "depends on", "blocked by", "requires" -> matches "depends on #123", etc.
    local PATTERN_PARTS=""
    for pattern in $DEPENDENCY_PATTERNS; do
        if [ -n "$PATTERN_PARTS" ]; then
            PATTERN_PARTS="$PATTERN_PARTS|"
        fi
        PATTERN_PARTS="${PATTERN_PARTS}${pattern}"
    done

    # Extract issue numbers following dependency patterns
    # Handles formats like:
    #   - "depends on #123"
    #   - "blocked by #123, #456"
    #   - "depends on #123 and #456"
    #   - "requires #789"
    local DEPS=""
    DEPS=$(echo "$ISSUE_BODY" | grep -oiE "(${PATTERN_PARTS})[ :]*(#[0-9]+(,[ ]*#[0-9]+|[ ]+and[ ]+#[0-9]+)*)" | \
        grep -oE '#[0-9]+' | tr -d '#' | sort -u | tr '\n' ' ')

    echo "$DEPS"
}

# Check if an issue is closed or in the Done column
# Returns: 0 (true) if completed, 1 (false) if not
is_issue_completed() {
    local ISSUE_NUM=$1

    # Check cache first
    local CACHE_KEY="completed_$ISSUE_NUM"
    local NOW=$(date +%s)
    if [ -n "${DEPENDENCY_CACHE[$CACHE_KEY]:-}" ]; then
        local CACHED_TIME="${DEPENDENCY_CACHE[${CACHE_KEY}_time]:-0}"
        if [ $((NOW - CACHED_TIME)) -lt "$DEPENDENCY_CACHE_TIMEOUT" ]; then
            [ "${DEPENDENCY_CACHE[$CACHE_KEY]}" = "true" ] && return 0 || return 1
        fi
    fi

    # Check if issue is closed
    local STATE=$(gh issue view "$ISSUE_NUM" --repo "$REPO" --json state -q '.state' 2>/dev/null)

    if [ "$STATE" = "CLOSED" ]; then
        DEPENDENCY_CACHE[$CACHE_KEY]="true"
        DEPENDENCY_CACHE[${CACHE_KEY}_time]="$NOW"
        return 0
    fi

    # Check if issue is in Done column on the project board
    local ITEMS=$(gh project item-list "$PROJECT_NUMBER" --owner "$REPO_OWNER" --format json --limit 200 2>/dev/null)
    local IN_DONE=$(echo "$ITEMS" | jq -r --argjson num "$ISSUE_NUM" --arg done "$DONE_COLUMN" '
        .items[] |
        select(.content.type == "Issue") |
        select(.content.number == $num) |
        select(.status == $done) |
        .content.number
    ' 2>/dev/null)

    if [ -n "$IN_DONE" ]; then
        DEPENDENCY_CACHE[$CACHE_KEY]="true"
        DEPENDENCY_CACHE[${CACHE_KEY}_time]="$NOW"
        return 0
    fi

    DEPENDENCY_CACHE[$CACHE_KEY]="false"
    DEPENDENCY_CACHE[${CACHE_KEY}_time]="$NOW"
    return 1
}

# Get linked blocking issues from GitHub (issues that block this one)
# Uses GitHub's issue linking feature
get_linked_blocking_issues() {
    local ISSUE_NUM=$1

    if [ "$DEPENDENCIES_CHECK_LINKED" != "true" ]; then
        echo ""
        return
    fi

    # Use GitHub API to get timeline events and find linked issues
    # Look for cross-references that mention blocking relationships
    local TIMELINE=$(gh api "repos/$REPO/issues/$ISSUE_NUM/timeline" --paginate 2>/dev/null || echo "[]")

    # Extract issue numbers from cross-references
    # Note: GitHub doesn't have a direct "blocked by" relationship via API,
    # but we can find linked issues through cross-references
    local LINKED=$(echo "$TIMELINE" | jq -r '
        .[] |
        select(.event == "cross-referenced") |
        .source.issue.number // empty
    ' 2>/dev/null | sort -u | tr '\n' ' ')

    echo "$LINKED"
}

# Check if all dependencies for an issue are completed
# Sets BLOCKING_ISSUES to list of unresolved dependencies
# Returns: 0 (true) if all deps completed, 1 (false) if blocked
check_issue_dependencies() {
    local ISSUE_NUM=$1
    local ISSUE_BODY="$2"

    BLOCKING_ISSUES=""
    BLOCKING_ISSUES_TITLES=""

    # If dependencies are disabled or ignored, always return success
    if [ "$DEPENDENCIES_ENABLED" != "true" ] || [ "$IGNORE_DEPS" = "true" ]; then
        return 0
    fi

    # Parse dependencies from issue body
    local BODY_DEPS=$(parse_issue_dependencies "$ISSUE_BODY")

    # Get linked blocking issues
    local LINKED_DEPS=$(get_linked_blocking_issues "$ISSUE_NUM")

    # Combine all dependencies
    local ALL_DEPS=$(echo "$BODY_DEPS $LINKED_DEPS" | tr ' ' '\n' | sort -u | grep -v '^$' | tr '\n' ' ')

    if [ -z "$ALL_DEPS" ]; then
        log_debug "Issue #$ISSUE_NUM has no dependencies"
        return 0
    fi

    log_debug "Issue #$ISSUE_NUM depends on: $ALL_DEPS"

    # Check each dependency
    for DEP in $ALL_DEPS; do
        if ! is_issue_completed "$DEP"; then
            if [ -n "$BLOCKING_ISSUES" ]; then
                BLOCKING_ISSUES="$BLOCKING_ISSUES $DEP"
            else
                BLOCKING_ISSUES="$DEP"
            fi
            # Get title for better logging
            local TITLE=$(gh issue view "$DEP" --repo "$REPO" --json title -q '.title' 2>/dev/null || echo "Unknown")
            if [ -n "$BLOCKING_ISSUES_TITLES" ]; then
                BLOCKING_ISSUES_TITLES="$BLOCKING_ISSUES_TITLES, #$DEP ($TITLE)"
            else
                BLOCKING_ISSUES_TITLES="#$DEP ($TITLE)"
            fi
        fi
    done

    if [ -n "$BLOCKING_ISSUES" ]; then
        return 1
    fi

    return 0
}

# Get dependency status summary for an issue
# Returns a human-readable string about dependency status
get_dependency_status() {
    local ISSUE_NUM=$1
    local ISSUE_BODY="$2"

    if [ "$DEPENDENCIES_ENABLED" != "true" ]; then
        echo "dependencies disabled"
        return
    fi

    if [ "$IGNORE_DEPS" = "true" ]; then
        echo "dependencies ignored (--ignore-deps)"
        return
    fi

    # Parse dependencies from issue body
    local BODY_DEPS=$(parse_issue_dependencies "$ISSUE_BODY")
    local LINKED_DEPS=$(get_linked_blocking_issues "$ISSUE_NUM")
    local ALL_DEPS=$(echo "$BODY_DEPS $LINKED_DEPS" | tr ' ' '\n' | sort -u | grep -v '^$' | tr '\n' ' ')

    if [ -z "$ALL_DEPS" ]; then
        echo "no dependencies"
        return
    fi

    local TOTAL=0
    local COMPLETED=0
    for DEP in $ALL_DEPS; do
        TOTAL=$((TOTAL + 1))
        if is_issue_completed "$DEP"; then
            COMPLETED=$((COMPLETED + 1))
        fi
    done

    if [ "$COMPLETED" -eq "$TOTAL" ]; then
        echo "all $TOTAL dependencies resolved"
    else
        local PENDING=$((TOTAL - COMPLETED))
        echo "$PENDING of $TOTAL dependencies pending"
    fi
}

# Global variables to track skipped tasks for status reporting
SKIPPED_TASKS=""
SKIPPED_REASONS=""

# Move an item to a different column
move_to_column() {
    local ITEM_ID=$1
    local TARGET_COLUMN=$2
    local OPTION_ID=""

    # Map column name to option ID (bash 3 compatible)
    if [ "$TARGET_COLUMN" = "$READY_COLUMN" ]; then
        OPTION_ID="$READY_OPTION_ID"
    elif [ "$TARGET_COLUMN" = "$IN_PROGRESS_COLUMN" ]; then
        OPTION_ID="$IN_PROGRESS_OPTION_ID"
    elif [ "$TARGET_COLUMN" = "$REVIEW_COLUMN" ]; then
        OPTION_ID="$REVIEW_OPTION_ID"
    elif [ "$TARGET_COLUMN" = "$DONE_COLUMN" ]; then
        OPTION_ID="$DONE_OPTION_ID"
    fi

    if [ -z "$OPTION_ID" ] || [ "$OPTION_ID" = "null" ]; then
        log_error "Column '$TARGET_COLUMN' not found in project"
        return 1
    fi

    # In dry-run mode, just log what would happen
    if [ "$DRY_RUN" = "true" ]; then
        log_dry_run "Would move item $ITEM_ID to column '$TARGET_COLUMN'"
        return 0
    fi

    gh project item-edit --project-id "$PROJECT_ID" --id "$ITEM_ID" \
        --field-id "$STATUS_FIELD_ID" --single-select-option-id "$OPTION_ID" 2>/dev/null

    return $?
}

# Get next task from project board "Ready" column
# Respects task dependencies - only returns tasks whose dependencies are completed
get_project_task() {
    local READY_ITEMS=$(get_issues_in_column "$READY_COLUMN")

    # Count items in ready column first
    ISSUE_COUNT=$(echo "$READY_ITEMS" | jq -s 'length' 2>/dev/null)

    # Reset skipped tasks tracking
    SKIPPED_TASKS=""
    SKIPPED_REASONS=""

    if [ -z "$READY_ITEMS" ] || [ "$ISSUE_COUNT" -eq 0 ]; then
        ISSUE_COUNT=0
        ISSUE_PRIORITY=""
        return 1
    fi

    # Build a list of issue numbers with their priorities
    local ITEM_NUMBERS=$(echo "$READY_ITEMS" | jq -r '.number' 2>/dev/null)

    # If priority is enabled, sort by priority first
    local SORTED_NUMBERS=""
    if [ "$PRIORITY_ENABLED" = "true" ]; then
        local PRIORITY_LIST=""
        for num in $ITEM_NUMBERS; do
            local priority=$(get_issue_priority "$num")
            PRIORITY_LIST="$PRIORITY_LIST$priority:$num "
        done

        # Sort by priority (numeric sort on first field)
        SORTED_NUMBERS=$(echo "$PRIORITY_LIST" | tr ' ' '\n' | grep -v '^$' | sort -t: -k1 -n | cut -d: -f2)
    else
        SORTED_NUMBERS="$ITEM_NUMBERS"
    fi

    # Iterate through items in order (by priority) and find first one with resolved dependencies
    for num in $SORTED_NUMBERS; do
        # Get issue body for dependency checking
        local BODY=$(gh issue view "$num" --repo "$REPO" --json body -q '.body' 2>/dev/null || echo "No description")

        # Check dependencies
        if check_issue_dependencies "$num" "$BODY"; then
            # Dependencies resolved - this is our task
            ISSUE_NUMBER="$num"

            if [ "$PRIORITY_ENABLED" = "true" ]; then
                ISSUE_PRIORITY=$(get_issue_priority "$ISSUE_NUMBER")
            else
                ISSUE_PRIORITY=""
                CURRENT_PRIORITY_NAME=""
            fi

            # Get full item details for the selected issue
            local SELECTED_ITEM=$(echo "$READY_ITEMS" | jq -s --argjson num "$ISSUE_NUMBER" '.[] | select(.number == $num)' 2>/dev/null)

            if [ -z "$SELECTED_ITEM" ] || [ "$SELECTED_ITEM" = "null" ]; then
                continue
            fi

            ISSUE_TITLE=$(echo "$SELECTED_ITEM" | jq -r '.title' 2>/dev/null)
            ISSUE_URL=$(echo "$SELECTED_ITEM" | jq -r '.url' 2>/dev/null)
            ITEM_ID=$(echo "$SELECTED_ITEM" | jq -r '.item_id' 2>/dev/null)
            ISSUE_BODY="$BODY"

            # Get issue category for metrics tracking
            get_issue_category "$ISSUE_NUMBER" > /dev/null

            return 0
        else
            # Dependencies not resolved - track as skipped
            log_debug "Skipping issue #$num - blocked by: $BLOCKING_ISSUES"
            if [ -n "$SKIPPED_TASKS" ]; then
                SKIPPED_TASKS="$SKIPPED_TASKS $num"
                SKIPPED_REASONS="${SKIPPED_REASONS}|#$num blocked by: $BLOCKING_ISSUES_TITLES"
            else
                SKIPPED_TASKS="$num"
                SKIPPED_REASONS="#$num blocked by: $BLOCKING_ISSUES_TITLES"
            fi
        fi
    done

    # All tasks have unresolved dependencies
    if [ -n "$SKIPPED_TASKS" ]; then
        log_warn "All $ISSUE_COUNT task(s) in Ready column have unresolved dependencies"
        # Log each skipped task
        echo "$SKIPPED_REASONS" | tr '|' '\n' | while read -r reason; do
            [ -n "$reason" ] && log_info "  $reason"
        done
    fi

    ISSUE_COUNT=0
    ISSUE_PRIORITY=""
    return 1
}

# Add issue to project board
add_to_project() {
    local ISSUE_URL=$1
    gh project item-add "$PROJECT_NUMBER" --owner "$REPO_OWNER" --url "$ISSUE_URL" 2>/dev/null
}

#------------------------------------------------------------------------------
# Task Generation
#------------------------------------------------------------------------------

# Generate new tasks using Claude Code
function generate_new_tasks() {
    log_header "GENERATING NEW TASKS"

    # Checkout main branch to analyze current state (not a feature branch)
    log_step "Checking out $BASE_BRANCH for codebase analysis..."
    git checkout "$BASE_BRANCH" 2>/dev/null || git checkout "origin/$BASE_BRANCH" 2>/dev/null || \
        log_warn "Could not checkout $BASE_BRANCH"

    log_step "Asking Claude to analyze codebase and suggest improvements..."

    # Get ALL existing issues from project board (all columns) to avoid duplicates
    log_step "Fetching existing tasks from project board..."
    local PROJECT_ITEMS=$(gh project item-list "$PROJECT_NUMBER" --owner "$REPO_OWNER" --format json --limit 200 2>/dev/null)
    EXISTING_ISSUES=$(echo "$PROJECT_ITEMS" | jq -r '.items[] | select(.content.type == "Issue") | .content.title' 2>/dev/null || echo "")

    # Also get closed issues to avoid re-suggesting completed work
    local CLOSED_ISSUES=$(gh issue list --repo "$REPO" --state closed --limit 50 --json title -q '.[].title' 2>/dev/null || echo "")
    EXISTING_ISSUES="${EXISTING_ISSUES}
${CLOSED_ISSUES}"

    # Process the generate template (use cached content to avoid branch switching issues)
    GEN_PROMPT_FILE=$(mktemp)

    if [ -n "$CACHED_GENERATE_TEMPLATE" ]; then
        # Use cached template content (from original branch, not main)
        echo "$CACHED_GENERATE_TEMPLATE" > "$GEN_PROMPT_FILE"
        process_template "$GEN_PROMPT_FILE" "$GEN_PROMPT_FILE"
    elif [ -f "$GENERATE_TEMPLATE" ]; then
        process_template "$GENERATE_TEMPLATE" "$GEN_PROMPT_FILE"
    else
        # Fallback inline prompt - Chad does what Chad wants
        local FALLBACK_FOOTER=""
        if [ "$INCLUDE_FOOTER" = "true" ]; then
            FALLBACK_FOOTER=$(get_chad_footer "issue")
        fi

        local LABEL_FLAG=""
        if [ -n "$CHAD_LABEL" ]; then
            LABEL_FLAG="--label \"$CHAD_LABEL\" \\\\"
        fi

        cat > "$GEN_PROMPT_FILE" << GEN_PROMPT_EOF
You are analyzing the $REPO repository to suggest 2-3 new improvement tasks.

$CHAD_TAGLINE

EXISTING TASKS (avoid duplicates - these are already in the project board):
$EXISTING_ISSUES

Your task:
1. Explore the codebase to understand its structure and purpose
2. Identify 2-3 valuable improvements, features, or fixes
3. For EACH task, create a GitHub issue, add it to the project board, and move it to Ready

For each issue:
\`\`\`bash
# Create the issue (title MUST start with $ISSUE_PREFIX, include label and assignee)
ISSUE_URL=\$(gh issue create --repo $REPO \\
  --title "$ISSUE_PREFIX <title>" \\
  $LABEL_FLAG
  --assignee "$GITHUB_USERNAME" \\
  --body "<body>
$FALLBACK_FOOTER
" | grep -o 'https://[^ ]*')

# Add to project board and move to Ready column
gh project item-add $PROJECT_NUMBER --owner $REPO_OWNER --url \$ISSUE_URL
\`\`\`

After adding each issue to the project, move it to the "$READY_COLUMN" column in the project board.

Focus on code quality, features, performance, developer experience, docs, or tests.
Create exactly 2-3 issues, no more, no less.
GEN_PROMPT_EOF
    fi

    run_claude_streaming "$GEN_PROMPT_FILE"
    GEN_EXIT=$?
    rm -f "$GEN_PROMPT_FILE"

    if [ $GEN_EXIT -ne 0 ]; then
        log_error "Failed to generate new tasks"
        return 1
    fi

    log_success "New tasks generated and added to project board"
    echo -e "${PURPLE}${CHAD_TAGLINE}${NC}"
}

#------------------------------------------------------------------------------
# Main Script
#------------------------------------------------------------------------------

# Banner
echo -e "${PURPLE}${BOLD}"
cat << 'EOF'

   ______ __              __ ______ ____
  / ____// /_   ____ _ __/ // ____//  _/
 / /    / __ \ / __ `// __  // / __ / /
/ /___ / / / // /_/ // /_/ // /_/ // /
\____//_/ /_/ \__,_/ \__,_/ \____//___/

EOF
echo -e "${NC}"

# Initialize session
SESSION_START=$(date -u +%Y-%m-%dT%H:%M:%SZ)
SESSION_START_EPOCH=$(date +%s)
ISSUES_COMPLETED=0
ISSUES_ATTEMPTED=0
TOTAL_COST=0
GIGACHAD_MERGES=0

# Arrays for tracking task details (bash 3.x compatible using strings)
SUCCESSFUL_TASKS=""    # Space-separated list of "issue_number:duration_secs"
FAILED_TASKS=""        # Space-separated list of "issue_number:reason"
TASK_COSTS=""          # Space-separated list of "issue_number:cost"

# Current task tracking
CURRENT_TASK_START_EPOCH=0

# Load configuration
load_config

# Display tagline after config load
echo -e "${PURPLE}      ${CHAD_TAGLINE}${NC}\n"

# Cache template contents NOW before any branch switching
# This ensures we use the template from our current branch, not main
CACHED_PROMPT_TEMPLATE=""
CACHED_GENERATE_TEMPLATE=""
if [ -f "$PROMPT_TEMPLATE" ]; then
    CACHED_PROMPT_TEMPLATE=$(cat "$PROMPT_TEMPLATE")
fi
if [ -f "$GENERATE_TEMPLATE" ]; then
    CACHED_GENERATE_TEMPLATE=$(cat "$GENERATE_TEMPLATE")
fi

# Show configuration
log_info "Task Source: Project Board"
log_info "Repository: $REPO"
log_info "Project: #$PROJECT_NUMBER"
if [ "$GIGACHAD_MODE" = "true" ]; then
    log_info "Columns: $READY_COLUMN -> $IN_PROGRESS_COLUMN -> $DONE_COLUMN (GigaChad)"
    echo -e "${PURPLE}${BOLD}     GIGACHAD MODE ENABLED - PRs will be auto-merged!${NC}"
else
    log_info "Columns: $READY_COLUMN -> $IN_PROGRESS_COLUMN -> $REVIEW_COLUMN"
fi
if [ "$DRY_RUN" = "true" ]; then
    echo -e "${YELLOW}${BOLD}     DRY-RUN MODE - No changes will be made${NC}"
    log_info "Mode: DRY-RUN (read-only)"
fi
log_info "Poll Interval: ${POLL_INTERVAL}s"
log_info "On Empty Queue: $ON_EMPTY_QUEUE"
log_info "Iteration: max $MAX_ITERATIONS attempts per task"
if is_timeout_enabled; then
    log_info "Task Timeout: ${TASK_TIMEOUT} minutes"
else
    log_info "Task Timeout: disabled"
fi
[ -n "$TEST_COMMAND" ] && log_info "Test Command: $TEST_COMMAND"
[ -n "$BUILD_COMMAND" ] && log_info "Build Command: $BUILD_COMMAND"
# Show dependency checking status
if [ "$IGNORE_DEPS" = "true" ]; then
    log_info "Dependencies: disabled (--ignore-deps)"
elif [ "$DEPENDENCIES_ENABLED" = "true" ]; then
    log_info "Dependencies: enabled (checking before task selection)"
else
    log_info "Dependencies: disabled (config)"
fi
log_info "Log Level: $(get_log_level_name $CURRENT_LOG_LEVEL)"
log_info "Log File: $LOG_FILE"
# Show budget limits if configured
if is_budget_enabled; then
    if is_task_budget_enabled; then
        log_info "Budget (per-task): \$${BUDGET_PER_TASK_LIMIT} (action: ${BUDGET_ON_TASK_EXCEEDED})"
    fi
    if is_session_budget_enabled; then
        log_info "Budget (per-session): \$${BUDGET_PER_SESSION_LIMIT} (action: ${BUDGET_ON_SESSION_EXCEEDED})"
    fi
    log_info "Budget warning at: ${BUDGET_WARNING_THRESHOLD}%"
else
    log_info "Budget limits: disabled"
fi

echo -e "${YELLOW}Press Ctrl+C at any time to stop${NC}\n"

# Initialize log file for the session
init_log_file

# Initialize project board connection
init_project_board

# Initialize progress tracking
init_progress

# Main loop
CONSECUTIVE_EMPTY=0

while true; do
    # Check for pause signal at the start of each loop iteration
    check_pause_lock

    log_header "SEARCHING FOR TASKS (Loop #$((ISSUES_COMPLETED + 1)))"

    # Find tasks in Ready column
    log_step "Checking '$READY_COLUMN' column..."

    if ! get_project_task; then
        CONSECUTIVE_EMPTY=$((CONSECUTIVE_EMPTY + 1))
        log_warn "No tasks found in '$READY_COLUMN' column"

        if [ "$CONSECUTIVE_EMPTY" -ge "$CONSECUTIVE_EMPTY_THRESHOLD" ]; then
            case "$ON_EMPTY_QUEUE" in
                "generate")
                    log_info "Queue empty for $CONSECUTIVE_EMPTY checks - generating new tasks..."
                    generate_new_tasks
                    CONSECUTIVE_EMPTY=0
                    sleep 3
                    continue
                    ;;
                "exit")
                    log_info "Queue empty - exiting as configured"
                    # Display and save session statistics before exit
                    print_session_summary
                    save_session_stats
                    # Send session ended notification
                    EXIT_SESSION_END_EPOCH=$(date +%s)
                    EXIT_SESSION_DURATION=$((EXIT_SESSION_END_EPOCH - SESSION_START_EPOCH))
                    EXIT_FAILED_COUNT=0
                    for TASK in $FAILED_TASKS; do
                        EXIT_FAILED_COUNT=$((EXIT_FAILED_COUNT + 1))
                    done
                    notify_session_ended "$ISSUES_COMPLETED" "$EXIT_FAILED_COUNT" "$EXIT_SESSION_DURATION" "${TOTAL_COST:-0}"
                    exit 0
                    ;;
                "wait"|*)
                    log_info "Queue empty - waiting..."
                    ;;
            esac
        fi

        log_info "Waiting ${POLL_INTERVAL} seconds before checking again..."
        sleep "$POLL_INTERVAL"
        continue
    fi

    CONSECUTIVE_EMPTY=0

    # Display task info with priority if enabled
    if [ "$PRIORITY_ENABLED" = "true" ] && [ -n "$CURRENT_PRIORITY_NAME" ]; then
        log_success "Found issue #$ISSUE_NUMBER (priority: $CURRENT_PRIORITY_NAME)"
    else
        log_success "Found issue #$ISSUE_NUMBER"
    fi
    echo -e "${BLUE}   Title: ${NC}$ISSUE_TITLE"
    echo -e "${BLUE}   URL:   ${NC}$ISSUE_URL"
    if [ "$PRIORITY_ENABLED" = "true" ] && [ -n "$CURRENT_PRIORITY_NAME" ]; then
        echo -e "${BLUE}   Priority: ${NC}$CURRENT_PRIORITY_NAME"
    fi
    # Show dependency status if enabled
    if [ "$DEPENDENCIES_ENABLED" = "true" ] && [ "$IGNORE_DEPS" != "true" ]; then
        DEP_STATUS=$(get_dependency_status "$ISSUE_NUMBER" "$ISSUE_BODY")
        echo -e "${BLUE}   Dependencies: ${NC}$DEP_STATUS"
    fi
    log_info "Queue depth: $ISSUE_COUNT issue(s)"
    # Show skipped tasks if any
    if [ -n "$SKIPPED_TASKS" ]; then
        SKIPPED_COUNT=$(echo "$SKIPPED_TASKS" | wc -w | tr -d ' ')
        log_info "Skipped $SKIPPED_COUNT task(s) with unresolved dependencies"
    fi

    #---------------------------------------------------------------------------
    # TASK LOCK: Attempt to acquire lock before claiming task
    #---------------------------------------------------------------------------
    log_step "Acquiring task lock for issue #$ISSUE_NUMBER..."

    if ! acquire_task_lock "$ISSUE_NUMBER"; then
        # Failed to acquire lock - issue is being processed by another session
        LOCK_FILE=$(get_task_lock_path "$ISSUE_NUMBER")
        LOCK_SESSION=""
        LOCK_HOST=""
        if command -v jq &>/dev/null && [ -f "$LOCK_FILE" ]; then
            LOCK_SESSION=$(jq -r '.session_id // "unknown"' "$LOCK_FILE" 2>/dev/null)
            LOCK_HOST=$(jq -r '.hostname // "unknown"' "$LOCK_FILE" 2>/dev/null)
        fi
        log_warn "Issue #$ISSUE_NUMBER is locked by another session"
        log_info "  Session: $LOCK_SESSION"
        log_info "  Host: $LOCK_HOST"
        log_info "Skipping to next task..."
        log_info "Use --force-claim to override stale locks"
        sleep 2
        continue
    fi

    log_success "Task lock acquired"

    # Start heartbeat to keep lock alive
    start_task_lock_heartbeat "$ISSUE_NUMBER"

    log_header "MOVING ISSUE #$ISSUE_NUMBER TO $IN_PROGRESS_COLUMN"

    # Move to In Progress column
    move_to_column "$ITEM_ID" "$IN_PROGRESS_COLUMN" && \
        log_success "Moved to '$IN_PROGRESS_COLUMN'" || \
        log_warn "Could not move issue (continuing anyway)"

    # Send task started notification (include priority if enabled)
    notify_task_started "$ISSUE_NUMBER" "$ISSUE_TITLE" "$ISSUE_URL" "$CURRENT_PRIORITY_NAME"

    # Auto-assign issue to current user
    if [ -n "$GITHUB_USERNAME" ]; then
        if [ "$DRY_RUN" = "true" ]; then
            log_dry_run "Would assign issue #$ISSUE_NUMBER to @$GITHUB_USERNAME"
        else
            log_step "Assigning issue to @$GITHUB_USERNAME..."
            gh issue edit "$ISSUE_NUMBER" --repo "$REPO" --add-assignee "$GITHUB_USERNAME" 2>/dev/null && \
                log_success "Assigned to @$GITHUB_USERNAME" || \
                log_warn "Could not assign issue (continuing anyway)"
        fi
    fi

    log_header "CREATING BRANCH FOR ISSUE #$ISSUE_NUMBER"

    # Create a clean branch name from issue title with unique suffix
    # The timestamp suffix ensures we get a fresh branch if re-attempting an issue
    BRANCH_SLUG=$(echo "$ISSUE_TITLE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//' | cut -c1-30)
    ATTEMPT_SUFFIX=$(date +%m%d%H%M)
    BRANCH_NAME="${BRANCH_PREFIX}${ISSUE_NUMBER}-${BRANCH_SLUG}-${ATTEMPT_SUFFIX}"

    if [ "$DRY_RUN" = "true" ]; then
        log_dry_run "Would create branch: $BRANCH_NAME from origin/$BASE_BRANCH"
    else
        log_step "Fetching latest from origin..."
        git fetch origin "$BASE_BRANCH" 2>/dev/null || log_warn "Could not fetch origin"

        log_step "Creating branch: $BRANCH_NAME"
        git checkout -B "$BRANCH_NAME" "origin/$BASE_BRANCH" 2>/dev/null && \
            log_success "Branch created and checked out" || {
            log_error "Could not create branch"
            log_info "Continuing on current branch..."
        }
    fi

    # Log header with priority if enabled
    if [ "$PRIORITY_ENABLED" = "true" ] && [ -n "$CURRENT_PRIORITY_NAME" ]; then
        log_header "STARTING CLAUDE CODE ON ISSUE #$ISSUE_NUMBER (priority: $CURRENT_PRIORITY_NAME)"
    else
        log_header "STARTING CLAUDE CODE ON ISSUE #$ISSUE_NUMBER"
    fi

    echo -e "${DIM}Branch: $BRANCH_NAME${NC}\n"

    # Track task start time and increment attempt counter
    CURRENT_TASK_START_EPOCH=$(date +%s)
    ISSUES_ATTEMPTED=$((ISSUES_ATTEMPTED + 1))

    # Reset task metrics for this new task
    reset_task_metrics

    # Save progress
    save_progress "in_progress" "$ISSUE_NUMBER" "$ISSUE_TITLE" "$BRANCH_NAME"

    #---------------------------------------------------------------------------
    # LIFECYCLE HOOK: pre_task
    # Runs before task starts. Can abort if can_abort is true.
    #---------------------------------------------------------------------------
    if ! run_hook "pre_task"; then
        log_error "Pre-task hook aborted the task"
        # Move issue back to Ready column
        if [ "$DRY_RUN" != "true" ]; then
            move_to_column "$ITEM_ID" "$READY_COLUMN" 2>/dev/null
        fi
        save_progress "idle" "" "" ""
        continue  # Skip to next task
    fi

    #---------------------------------------------------------------------------
    # INTERACTIVE: Pre-Task Approval Checkpoint (optional)
    # Allows human review of task details before Claude starts working
    #---------------------------------------------------------------------------
    if [ "$INTERACTIVE_ENABLED" = "true" ] && [ "$INTERACTIVE_APPROVE_PRE_TASK" = "true" ]; then
        log_header "AWAITING APPROVAL: PRE-TASK REVIEW"
        echo -e "${CYAN}Issue URL:${NC}  ${ISSUE_URL}"
        echo ""
        echo -e "${CYAN}Issue Description:${NC}"
        echo "$ISSUE_BODY" | head -30
        if [ $(echo "$ISSUE_BODY" | wc -l) -gt 30 ]; then
            echo -e "${DIM}... (truncated, see full issue at URL above)${NC}"
        fi
        echo ""

        wait_for_approval "pre_task" "$ISSUE_NUMBER" "$ISSUE_TITLE" "$BRANCH_NAME"
        APPROVAL_RESULT=$?

        if [ $APPROVAL_RESULT -eq 2 ]; then
            # Skip task - move back to Ready
            log_warn "Task skipped by human reviewer"
            # Move issue back to Ready column
            if [ "$DRY_RUN" != "true" ]; then
                move_to_column "$ISSUE_NUMBER" "$READY_COLUMN"
            fi
            save_progress "idle" "" "" ""
            continue  # Continue to next task in queue
        elif [ $APPROVAL_RESULT -eq 1 ]; then
            # Rejected - skip this task
            log_warn "Task rejected by human reviewer: ${APPROVAL_FEEDBACK:-No feedback provided}"
            # Move issue back to Ready column
            if [ "$DRY_RUN" != "true" ]; then
                move_to_column "$ISSUE_NUMBER" "$READY_COLUMN"
            fi
            save_progress "idle" "" "" ""
            continue  # Continue to next task in queue
        fi
        log_success "Task approved! Starting implementation..."
    fi

    # Process the prompt template (use cached content to avoid branch switching issues)
    PROMPT_FILE=$(mktemp)

    if [ -n "$CACHED_PROMPT_TEMPLATE" ]; then
        # Use cached template content (from original branch, not main)
        echo "$CACHED_PROMPT_TEMPLATE" > "$PROMPT_FILE"
        process_template "$PROMPT_FILE" "$PROMPT_FILE"
    elif [ -f "$PROMPT_TEMPLATE" ]; then
        process_template "$PROMPT_TEMPLATE" "$PROMPT_FILE"
    else
        # Fallback inline prompt
        cat > "$PROMPT_FILE" << PROMPT_EOF
You are working on GitHub issue #$ISSUE_NUMBER from the $REPO repository.

## Issue Details
**Title:** $ISSUE_TITLE
**URL:** $ISSUE_URL

**Description:**
$ISSUE_BODY

## Your Task
You are already on a fresh branch: **$BRANCH_NAME** (created from $BASE_BRANCH)

1. Read and understand the issue requirements thoroughly
2. Explore the codebase to understand the context
3. Implement the requested changes following existing code patterns
4. Test your implementation (run existing tests, add new tests if needed)
5. Commit your changes with clear, descriptive commit messages
6. Push the branch and create a Pull Request targeting **$BASE_BRANCH**:
   - Use: gh pr create --base $BASE_BRANCH ...
   - Has a clear title summarizing the change
   - References 'Closes #$ISSUE_NUMBER' in the description
   - Includes a summary of changes and test plan

## Important
- Follow existing code style and patterns in the repository
- Run any relevant tests before creating the PR
- If you encounter blockers, make reasonable decisions and document them

After creating the PR, report the PR URL.
PROMPT_EOF
    fi

    # Run Claude Code - either dry-run exploration or full iteration loop
    if [ "$DRY_RUN" = "true" ]; then
        run_task_dry_run "$PROMPT_FILE"
        TASK_EXIT=$?
        rm -f "$PROMPT_FILE"

        # In dry-run mode, exit after processing one task
        log_header "DRY-RUN SESSION COMPLETE"
        log_info "Processed 1 task in dry-run mode"
        log_info "No changes were made to GitHub or git"
        echo ""
        echo -e "${GREEN}Dry-run successful!${NC} To run for real:"
        echo -e "  chadgi start"
        echo ""
        exit 0
    fi

    run_task_with_iterations "$PROMPT_FILE"
    TASK_EXIT=$?
    rm -f "$PROMPT_FILE"

    if [ $TASK_EXIT -ne 0 ]; then
        log_error "Task did not complete successfully"
        save_progress "error" "$ISSUE_NUMBER" "$ISSUE_TITLE" "$BRANCH_NAME"

        # Use enhanced error classification
        ERROR_OUTPUT_FILE=$(mktemp)
        # Try to capture any recent output for classification
        if [ -f "$TEST_RESULTS" ]; then
            cp "$TEST_RESULTS" "$ERROR_OUTPUT_FILE" 2>/dev/null || true
        fi

        # Classify the error based on exit code and context
        if [ $TASK_EXIT -eq 124 ]; then
            # Timeout is a special case
            LAST_ERROR_TYPE="timeout_failure"
            LAST_ERROR_DETAILS="Task exceeded time limit of ${TASK_TIMEOUT} minutes"
        else
            # Try to classify based on output patterns
            classify_error $TASK_EXIT "$ERROR_OUTPUT_FILE" "verification"
            if [ -z "$LAST_ERROR_TYPE" ]; then
                # Default classification if pattern matching didn't work
                LAST_ERROR_TYPE="execution_error"
                LAST_ERROR_DETAILS="Task failed after $MAX_ITERATIONS iterations with exit code $TASK_EXIT"
            fi
        fi

        FAILURE_REASON="$LAST_ERROR_TYPE"
        FAILURE_DETAILS="$LAST_ERROR_DETAILS"

        # Collect diagnostic artifacts if enabled
        collect_diagnostics "$ISSUE_NUMBER" "$LAST_ERROR_TYPE" "$LAST_ERROR_DETAILS" "$ERROR_OUTPUT_FILE"

        # Display enhanced error report
        display_error_report "$LAST_ERROR_TYPE" "$LAST_ERROR_DETAILS" "$DIAGNOSTICS_DIR"

        rm -f "$ERROR_OUTPUT_FILE"

        # Record failed task
        FAILED_TASKS="${FAILED_TASKS} ${ISSUE_NUMBER}:${FAILURE_REASON}"

        # Calculate task duration for metrics
        TASK_END_EPOCH=$(date +%s)
        TASK_DURATION=$((TASK_END_EPOCH - CURRENT_TASK_START_EPOCH))

        # Save detailed task metrics
        save_task_metrics "$ISSUE_NUMBER" "failed" "$TASK_DURATION" "$FAILURE_REASON" "$TASK_FAILURE_PHASE"

        # Send task failed notification
        notify_task_failed "$ISSUE_NUMBER" "$ISSUE_TITLE" "$FAILURE_REASON" "$FAILURE_DETAILS"

        #-----------------------------------------------------------------------
        # LIFECYCLE HOOK: on_failure
        # Runs when a task fails after all retries
        #-----------------------------------------------------------------------
        run_hook "on_failure"

        # Check if session budget was exceeded - need to stop the entire session
        if [ "$SESSION_BUDGET_EXCEEDED" = "true" ]; then
            log_error "Session budget exceeded - stopping ChadGI"

            # Display and save session statistics before exit
            print_session_summary
            save_session_stats

            # Send session ended notification
            EXIT_SESSION_END_EPOCH=$(date +%s)
            EXIT_SESSION_DURATION=$((EXIT_SESSION_END_EPOCH - SESSION_START_EPOCH))
            EXIT_FAILED_COUNT=0
            for TASK in $FAILED_TASKS; do
                EXIT_FAILED_COUNT=$((EXIT_FAILED_COUNT + 1))
            done
            notify_session_ended "$ISSUES_COMPLETED" "$EXIT_FAILED_COUNT" "$EXIT_SESSION_DURATION" "${TOTAL_COST:-0}"

            exit 125  # Custom exit code for session budget exceeded
        fi

        # Handle failed task based on config (same behavior for timeout and max_iterations)
        case "$ON_MAX_ITERATIONS" in
            "rollback")
                log_step "Rolling back changes..."
                git reset --hard "origin/$BASE_BRANCH" 2>/dev/null
                git checkout "$BASE_BRANCH" 2>/dev/null
                log_info "Branch reset, moving to next issue"
                ;;
            "retry-later")
                log_step "Moving issue back to $READY_COLUMN for retry..."
                move_to_column "$ITEM_ID" "$READY_COLUMN" 2>/dev/null
                ;;
            "skip"|*)
                log_info "Skipping to next issue..."
                ;;
        esac

        # Release task lock and stop heartbeat on failure
        stop_task_lock_heartbeat
        release_task_lock "$ISSUE_NUMBER"

        sleep 5
        continue
    fi

    # Calculate task duration
    TASK_END_EPOCH=$(date +%s)
    TASK_DURATION=$((TASK_END_EPOCH - CURRENT_TASK_START_EPOCH))

    # Record successful task with duration
    SUCCESSFUL_TASKS="${SUCCESSFUL_TASKS} ${ISSUE_NUMBER}:${TASK_DURATION}"

    # Save detailed task metrics
    save_task_metrics "$ISSUE_NUMBER" "completed" "$TASK_DURATION"

    # Send task completed notification
    notify_task_completed "$ISSUE_NUMBER" "$ISSUE_TITLE" "$COMPLETED_PR_URL"

    # In GigaChad mode: move to Done; otherwise: move to In Review
    if [ "$GIGACHAD_MERGED" = "true" ]; then
        log_header "MOVING ISSUE #$ISSUE_NUMBER TO $DONE_COLUMN (GIGACHAD)"
        move_to_column "$ITEM_ID" "$DONE_COLUMN" && \
            log_success "Moved to '$DONE_COLUMN' - PR #$GIGACHAD_MERGED_PR was auto-merged!" || \
            log_warn "Could not move issue to Done"
        # Track GigaChad merge
        GIGACHAD_MERGES=$((GIGACHAD_MERGES + 1))
    else
        log_header "MOVING ISSUE #$ISSUE_NUMBER TO $REVIEW_COLUMN"
        move_to_column "$ITEM_ID" "$REVIEW_COLUMN" && \
            log_success "Moved to '$REVIEW_COLUMN'" || \
            log_warn "Could not move issue"
    fi

    ISSUES_COMPLETED=$((ISSUES_COMPLETED + 1))

    # Reset GigaChad state for next task
    GIGACHAD_MERGED=false
    GIGACHAD_MERGED_PR=""

    # Release task lock and stop heartbeat
    stop_task_lock_heartbeat
    release_task_lock "$ISSUE_NUMBER"

    # Save progress
    save_progress "idle" "" "" ""

    log_header "ISSUE #$ISSUE_NUMBER COMPLETED"
    echo -e "${GREEN}Total issues completed this session: $ISSUES_COMPLETED${NC}"
    if [ "$GIGACHAD_MODE" = "true" ]; then
        echo -e "${PURPLE}${BOLD}GigaChad doesn't wait. GigaChad ships.${NC}"
    else
        echo -e "${PURPLE}${CHAD_TAGLINE}${NC}"
    fi
    [ -n "$TOTAL_COST" ] && [ "$TOTAL_COST" != "0" ] && echo -e "${DIM}Total session cost: \$${TOTAL_COST}${NC}"

    # Check session budget after completing task
    # This catches cases where a task completes successfully but pushes us over budget
    if check_session_budget_exceeded "${TOTAL_COST:-0}"; then
        if handle_session_budget_exceeded "${TOTAL_COST:-0}"; then
            log_error "Session budget exceeded after task completion - stopping ChadGI"

            # Display and save session statistics before exit
            print_session_summary
            save_session_stats

            # Send session ended notification
            EXIT_SESSION_END_EPOCH=$(date +%s)
            EXIT_SESSION_DURATION=$((EXIT_SESSION_END_EPOCH - SESSION_START_EPOCH))
            EXIT_FAILED_COUNT=0
            for TASK in $FAILED_TASKS; do
                EXIT_FAILED_COUNT=$((EXIT_FAILED_COUNT + 1))
            done
            notify_session_ended "$ISSUES_COMPLETED" "$EXIT_FAILED_COUNT" "$EXIT_SESSION_DURATION" "${TOTAL_COST:-0}"

            exit 125  # Custom exit code for session budget exceeded
        fi
    fi

    # Check for pause signal after task completion (before sleeping)
    if [ -f "$PAUSE_LOCK_FILE" ]; then
        log_info "Pause signal detected after task completion."
        check_pause_lock
    else
        log_info "Moving to next issue in ${POLL_INTERVAL} seconds..."
        sleep "$POLL_INTERVAL"
    fi
done

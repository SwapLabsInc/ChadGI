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

# Load configuration from YAML file
load_config() {
    if [ ! -f "$CONFIG_FILE" ]; then
        log_warn "Config file not found: $CONFIG_FILE"
        log_info "Using default configuration"
        set_defaults
        return
    fi

    log_step "Loading configuration from $CONFIG_FILE"

    # Task source
    TASK_SOURCE=$(parse_yaml_value "task_source" "$CONFIG_FILE")
    TASK_SOURCE="${TASK_SOURCE:-github-issues}"

    # Template files - relative to CHADGI_DIR
    PROMPT_TEMPLATE=$(parse_yaml_value "prompt_template" "$CONFIG_FILE")
    PROMPT_TEMPLATE="${PROMPT_TEMPLATE:-./chadgi-task.md}"
    GENERATE_TEMPLATE=$(parse_yaml_value "generate_template" "$CONFIG_FILE")
    GENERATE_TEMPLATE="${GENERATE_TEMPLATE:-./chadgi-generate-task.md}"
    PROGRESS_FILE=$(parse_yaml_value "progress_file" "$CONFIG_FILE")
    PROGRESS_FILE="${PROGRESS_FILE:-./chadgi-progress.json}"

    # GitHub settings
    REPO=$(parse_yaml_nested "github" "repo" "$CONFIG_FILE")
    REPO="${REPO:-owner/repo}"
    REPO_OWNER="${REPO%%/*}"
    PROJECT_NUMBER=$(parse_yaml_nested "github" "project_number" "$CONFIG_FILE")
    PROJECT_NUMBER="${PROJECT_NUMBER:-1}"

    # Project board column names
    READY_COLUMN=$(parse_yaml_nested "github" "ready_column" "$CONFIG_FILE")
    READY_COLUMN="${READY_COLUMN:-Ready}"
    IN_PROGRESS_COLUMN=$(parse_yaml_nested "github" "in_progress_column" "$CONFIG_FILE")
    IN_PROGRESS_COLUMN="${IN_PROGRESS_COLUMN:-In Progress}"
    REVIEW_COLUMN=$(parse_yaml_nested "github" "review_column" "$CONFIG_FILE")
    REVIEW_COLUMN="${REVIEW_COLUMN:-In Review}"

    # Branch settings
    BASE_BRANCH=$(parse_yaml_nested "branch" "base" "$CONFIG_FILE")
    BASE_BRANCH="${BASE_BRANCH:-main}"
    BRANCH_PREFIX=$(parse_yaml_nested "branch" "prefix" "$CONFIG_FILE")
    BRANCH_PREFIX="${BRANCH_PREFIX:-feature/issue-}"

    # Polling settings
    POLL_INTERVAL=$(parse_yaml_value "poll_interval" "$CONFIG_FILE")
    POLL_INTERVAL="${POLL_INTERVAL:-10}"
    CONSECUTIVE_EMPTY_THRESHOLD=$(parse_yaml_value "consecutive_empty_threshold" "$CONFIG_FILE")
    CONSECUTIVE_EMPTY_THRESHOLD="${CONSECUTIVE_EMPTY_THRESHOLD:-2}"

    # On empty queue behavior
    ON_EMPTY_QUEUE=$(parse_yaml_value "on_empty_queue" "$CONFIG_FILE")
    ON_EMPTY_QUEUE="${ON_EMPTY_QUEUE:-generate}"

    # Output settings
    SHOW_TOOL_DETAILS=$(parse_yaml_nested "output" "show_tool_details" "$CONFIG_FILE")
    SHOW_TOOL_DETAILS="${SHOW_TOOL_DETAILS:-true}"
    SHOW_COST=$(parse_yaml_nested "output" "show_cost" "$CONFIG_FILE")
    SHOW_COST="${SHOW_COST:-true}"
    TRUNCATE_LENGTH=$(parse_yaml_nested "output" "truncate_length" "$CONFIG_FILE")
    TRUNCATE_LENGTH="${TRUNCATE_LENGTH:-60}"

    # Iteration settings (the core ChadGI pattern)
    MAX_ITERATIONS=$(parse_yaml_nested "iteration" "max_iterations" "$CONFIG_FILE")
    MAX_ITERATIONS="${MAX_ITERATIONS:-5}"
    COMPLETION_PROMISE=$(parse_yaml_nested "iteration" "completion_promise" "$CONFIG_FILE")
    COMPLETION_PROMISE="${COMPLETION_PROMISE:-COMPLETE}"
    READY_PROMISE=$(parse_yaml_nested "iteration" "ready_promise" "$CONFIG_FILE")
    READY_PROMISE="${READY_PROMISE:-READY_FOR_PR}"
    TEST_COMMAND=$(parse_yaml_nested "iteration" "test_command" "$CONFIG_FILE")
    TEST_COMMAND="${TEST_COMMAND:-}"
    BUILD_COMMAND=$(parse_yaml_nested "iteration" "build_command" "$CONFIG_FILE")
    BUILD_COMMAND="${BUILD_COMMAND:-}"
    ON_MAX_ITERATIONS=$(parse_yaml_nested "iteration" "on_max_iterations" "$CONFIG_FILE")
    ON_MAX_ITERATIONS="${ON_MAX_ITERATIONS:-skip}"

    # Resolve relative paths to CHADGI_DIR
    [[ "$PROMPT_TEMPLATE" != /* ]] && PROMPT_TEMPLATE="$CHADGI_DIR/$PROMPT_TEMPLATE"
    [[ "$GENERATE_TEMPLATE" != /* ]] && GENERATE_TEMPLATE="$CHADGI_DIR/$GENERATE_TEMPLATE"
    [[ "$PROGRESS_FILE" != /* ]] && PROGRESS_FILE="$CHADGI_DIR/$PROGRESS_FILE"

    log_success "Configuration loaded"
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
    BASE_BRANCH="${BASE_BRANCH:-main}"
    BRANCH_PREFIX="${BRANCH_PREFIX:-feature/issue-}"
    POLL_INTERVAL="${POLL_INTERVAL:-10}"
    CONSECUTIVE_EMPTY_THRESHOLD="${CONSECUTIVE_EMPTY_THRESHOLD:-2}"
    ON_EMPTY_QUEUE="${ON_EMPTY_QUEUE:-generate}"
    SHOW_TOOL_DETAILS="true"
    SHOW_COST="true"
    TRUNCATE_LENGTH="60"
    MAX_ITERATIONS="${MAX_ITERATIONS:-5}"
    COMPLETION_PROMISE="${COMPLETION_PROMISE:-COMPLETE}"
    READY_PROMISE="${READY_PROMISE:-READY_FOR_PR}"
    TEST_COMMAND="${TEST_COMMAND:-}"
    BUILD_COMMAND="${BUILD_COMMAND:-}"
    ON_MAX_ITERATIONS="${ON_MAX_ITERATIONS:-skip}"
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
        "$OUTPUT_FILE"
    rm -f "${OUTPUT_FILE}.bak"

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
    exit 0
}

function log_header() {
    echo -e "\n${PURPLE}-----------------------------------------------------------${NC}"
    echo -e "${PURPLE}  $1${NC}"
    echo -e "${PURPLE}-----------------------------------------------------------${NC}"
}

function log_step() {
    echo -e "${CYAN}> $1${NC}"
}

function log_success() {
    echo -e "${GREEN}+ $1${NC}"
}

function log_info() {
    echo -e "${BLUE}i $1${NC}"
}

function log_warn() {
    echo -e "${YELLOW}! $1${NC}"
}

function log_error() {
    echo -e "${RED}x $1${NC}"
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
run_claude_with_output() {
    local PROMPT_FILE=$1
    local OUTPUT_FILE=$2
    local RAW_OUTPUT=$(mktemp)

    # Run Claude and save raw output
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
                fi
            fi
        done

    local EXIT_CODE=${PIPESTATUS[0]}

    # Extract text output for completion promise detection
    cat "$RAW_OUTPUT" | while IFS= read -r line; do
        local TYPE=$(echo "$line" | jq -r '.type // empty' 2>/dev/null)
        if [ "$TYPE" = "assistant" ]; then
            echo "$line" | jq -r '.message.content[]? | select(.type == "text") | .text // empty' 2>/dev/null
        fi
    done > "$OUTPUT_FILE"

    rm -f "$RAW_OUTPUT"
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

    #---------------------------------------------------------------------------
    # PHASE 1: Implementation Loop
    # Claude implements the feature, runs tests locally, commits
    # Loop continues until tests pass AND READY_FOR_PR promise is found
    #---------------------------------------------------------------------------
    while [ $ITERATION -le $MAX_ITERATIONS ] && [ "$IMPL_COMPLETE" = "false" ]; do
        log_header "PHASE 1: IMPLEMENTATION (Iteration $ITERATION / $MAX_ITERATIONS)"

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
                        fi
                    fi
                done
        fi

        # Check for ready-for-PR promise in output
        if check_ready_promise "$OUTPUT_FILE"; then
            log_success "Ready-for-PR promise found!"

            # Run tests to verify implementation
            log_step "Verifying implementation with tests/build..."
            if run_tests_with_output "$TEST_RESULTS"; then
                log_success "All verification checks passed!"
                IMPL_COMPLETE=true
            else
                log_warn "Verification failed - continuing iteration loop"
            fi
        else
            log_info "No ready-for-PR promise yet"

            # Run tests to provide feedback for next iteration
            run_tests_with_output "$TEST_RESULTS" || true
        fi

        if [ "$IMPL_COMPLETE" = "false" ]; then
            ITERATION=$((ITERATION + 1))
            if [ $ITERATION -le $MAX_ITERATIONS ]; then
                log_info "Continuing to next iteration..."
                sleep 2
            fi
        fi
    done

    # Check if Phase 1 succeeded
    if [ "$IMPL_COMPLETE" = "false" ]; then
        rm -f "$OUTPUT_FILE" "$OUTPUT_FILE.raw" "$TEST_RESULTS"
        log_error "Max iterations ($MAX_ITERATIONS) reached without passing verification"
        return 1
    fi

    #---------------------------------------------------------------------------
    # PHASE 2: PR Creation
    # Tests have passed - now ask Claude to create the PR
    #---------------------------------------------------------------------------
    log_header "PHASE 2: CREATING PULL REQUEST"
    log_step "Tests passed! Asking Claude to create the PR..."

    > "$OUTPUT_FILE"

    local PR_PROMPT="Excellent! All tests and build verification have passed.

Now please:
1. Push the branch to origin
2. Create a Pull Request targeting **${BASE_BRANCH}** with:
   - Use: gh pr create --base ${BASE_BRANCH} ...
   - A clear title summarizing the change
   - Reference 'Closes #${ISSUE_NUMBER}' in the description
   - A summary of what changed and a test plan

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

    log_success "Connected to project #$PROJECT_NUMBER"
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
    fi

    if [ -z "$OPTION_ID" ] || [ "$OPTION_ID" = "null" ]; then
        log_error "Column '$TARGET_COLUMN' not found in project"
        return 1
    fi

    gh project item-edit --project-id "$PROJECT_ID" --id "$ITEM_ID" \
        --field-id "$STATUS_FIELD_ID" --single-select-option-id "$OPTION_ID" 2>/dev/null

    return $?
}

# Get next task from project board "Ready" column
get_project_task() {
    local READY_ITEMS=$(get_issues_in_column "$READY_COLUMN")

    # Get first item
    local FIRST_ITEM=$(echo "$READY_ITEMS" | jq -s '.[0] // empty' 2>/dev/null)

    if [ -z "$FIRST_ITEM" ] || [ "$FIRST_ITEM" = "null" ]; then
        ISSUE_COUNT=0
        return 1
    fi

    ISSUE_NUMBER=$(echo "$FIRST_ITEM" | jq -r '.number' 2>/dev/null)
    ISSUE_TITLE=$(echo "$FIRST_ITEM" | jq -r '.title' 2>/dev/null)
    ISSUE_URL=$(echo "$FIRST_ITEM" | jq -r '.url' 2>/dev/null)
    ITEM_ID=$(echo "$FIRST_ITEM" | jq -r '.item_id' 2>/dev/null)

    # Get issue body
    ISSUE_BODY=$(gh issue view "$ISSUE_NUMBER" --repo "$REPO" --json body -q '.body' 2>/dev/null || echo "No description")

    # Count items in ready column
    ISSUE_COUNT=$(echo "$READY_ITEMS" | jq -s 'length' 2>/dev/null)

    return 0
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
        # Fallback inline prompt
        cat > "$GEN_PROMPT_FILE" << GEN_PROMPT_EOF
You are analyzing the $REPO repository to suggest 2-3 new improvement tasks.

EXISTING TASKS (avoid duplicates - these are already in the project board):
$EXISTING_ISSUES

Your task:
1. Explore the codebase to understand its structure and purpose
2. Identify 2-3 valuable improvements, features, or fixes
3. For EACH task, create a GitHub issue, add it to the project board, and move it to Ready

For each issue:
\`\`\`bash
# Create the issue and capture the URL
gh issue create --repo $REPO --title "<title>" --body "<body>"

# Add to project board and move to Ready column
gh project item-add $PROJECT_NUMBER --owner $REPO_OWNER --url <issue_url>
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
echo -e "${PURPLE}      Autonomous Task Worker${NC}\n"

# Initialize session
SESSION_START=$(date -u +%Y-%m-%dT%H:%M:%SZ)
ISSUES_COMPLETED=0
TOTAL_COST=0

# Load configuration
load_config

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
log_info "Columns: $READY_COLUMN -> $IN_PROGRESS_COLUMN -> $REVIEW_COLUMN"
log_info "Poll Interval: ${POLL_INTERVAL}s"
log_info "On Empty Queue: $ON_EMPTY_QUEUE"
log_info "Iteration: max $MAX_ITERATIONS attempts per task"
[ -n "$TEST_COMMAND" ] && log_info "Test Command: $TEST_COMMAND"
[ -n "$BUILD_COMMAND" ] && log_info "Build Command: $BUILD_COMMAND"

echo -e "${YELLOW}Press Ctrl+C at any time to stop${NC}\n"

# Initialize project board connection
init_project_board

# Initialize progress tracking
init_progress

# Main loop
CONSECUTIVE_EMPTY=0

while true; do
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

    log_success "Found issue #$ISSUE_NUMBER"
    echo -e "${BLUE}   Title: ${NC}$ISSUE_TITLE"
    echo -e "${BLUE}   URL:   ${NC}$ISSUE_URL"
    log_info "Queue depth: $ISSUE_COUNT issue(s)"

    log_header "MOVING ISSUE #$ISSUE_NUMBER TO $IN_PROGRESS_COLUMN"

    # Move to In Progress column
    move_to_column "$ITEM_ID" "$IN_PROGRESS_COLUMN" && \
        log_success "Moved to '$IN_PROGRESS_COLUMN'" || \
        log_warn "Could not move issue (continuing anyway)"

    log_header "CREATING BRANCH FOR ISSUE #$ISSUE_NUMBER"

    # Create a clean branch name from issue title with unique suffix
    # The timestamp suffix ensures we get a fresh branch if re-attempting an issue
    BRANCH_SLUG=$(echo "$ISSUE_TITLE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//' | cut -c1-30)
    ATTEMPT_SUFFIX=$(date +%m%d%H%M)
    BRANCH_NAME="${BRANCH_PREFIX}${ISSUE_NUMBER}-${BRANCH_SLUG}-${ATTEMPT_SUFFIX}"

    log_step "Fetching latest from origin..."
    git fetch origin "$BASE_BRANCH" 2>/dev/null || log_warn "Could not fetch origin"

    log_step "Creating branch: $BRANCH_NAME"
    git checkout -B "$BRANCH_NAME" "origin/$BASE_BRANCH" 2>/dev/null && \
        log_success "Branch created and checked out" || {
        log_error "Could not create branch"
        log_info "Continuing on current branch..."
    }

    log_header "STARTING CLAUDE CODE ON ISSUE #$ISSUE_NUMBER"

    echo -e "${DIM}Branch: $BRANCH_NAME${NC}\n"

    # Save progress
    save_progress "in_progress" "$ISSUE_NUMBER" "$ISSUE_TITLE" "$BRANCH_NAME"

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

    # Run Claude Code with iteration loop
    run_task_with_iterations "$PROMPT_FILE"
    TASK_EXIT=$?
    rm -f "$PROMPT_FILE"

    if [ $TASK_EXIT -ne 0 ]; then
        log_error "Task did not complete successfully"
        save_progress "error" "$ISSUE_NUMBER" "$ISSUE_TITLE" "$BRANCH_NAME"

        # Handle max iterations based on config
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

        sleep 5
        continue
    fi

    log_header "MOVING ISSUE #$ISSUE_NUMBER TO $REVIEW_COLUMN"

    # Move to Review column
    move_to_column "$ITEM_ID" "$REVIEW_COLUMN" && \
        log_success "Moved to '$REVIEW_COLUMN'" || \
        log_warn "Could not move issue"

    ISSUES_COMPLETED=$((ISSUES_COMPLETED + 1))

    # Save progress
    save_progress "idle" "" "" ""

    log_header "ISSUE #$ISSUE_NUMBER COMPLETED"
    echo -e "${GREEN}Total issues completed this session: $ISSUES_COMPLETED${NC}"
    [ -n "$TOTAL_COST" ] && [ "$TOTAL_COST" != "0" ] && echo -e "${DIM}Total session cost: \$${TOTAL_COST}${NC}"

    log_info "Moving to next issue in ${POLL_INTERVAL} seconds..."
    sleep "$POLL_INTERVAL"
done

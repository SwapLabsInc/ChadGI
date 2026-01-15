#!/bin/bash
#
# ChadGI Self-Improvement Loop
#
# Iteratively improves the chadgi package using Claude Code.
# This is a development tool, not for end users.
#
# Key features:
# - Circuit breaker: stops on repeated failures or no progress
# - Dual-condition exit: requires both completion signal AND exit flag
# - Session continuity: uses --continue for subsequent iterations
# - Simple, outcome-oriented prompt
# - Specific self-critique questions
#
# Usage: ./chadgi-self-improve.sh [max_iterations]
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MAX_ITERATIONS=${1:-5}
ITERATION=1

# Circuit breaker state
NO_PROGRESS_COUNT=0
NO_PROGRESS_THRESHOLD=3
LAST_COMMIT_HASH=""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m'

log_header() { echo -e "\n${PURPLE}${BOLD}=== $1 ===${NC}"; }
log_step() { echo -e "${CYAN}> $1${NC}"; }
log_success() { echo -e "${GREEN}+ $1${NC}"; }
log_info() { echo -e "${BLUE}i $1${NC}"; }
log_warn() { echo -e "${YELLOW}! $1${NC}"; }
log_error() { echo -e "${RED}x $1${NC}"; }

# Trap Ctrl+C
trap 'echo -e "\n${YELLOW}Stopping...${NC}"; show_summary; exit 0' INT

show_summary() {
    echo ""
    log_header "SESSION SUMMARY"
    log_info "Iterations run: $((ITERATION - 1))"
    log_info "Commits made this session:"
    git log --oneline "${START_COMMIT}..HEAD" 2>/dev/null || echo "  (none)"
}

echo -e "${PURPLE}${BOLD}"
cat << 'EOF'
   ______ __              __ ______ ____
  / ____// /_   ____ _ __/ // ____//  _/
 / /    / __ \ / __ `// __  // / __ / /
/ /___ / / / // /_/ // /_/ // /_/ // /
\____//_/ /_/ \__,_/ \__,_/ \____//___/

        Self-Improvement Loop v1.0
EOF
echo -e "${NC}"
echo -e "${DIM}Iterative self-improvement with circuit breaker${NC}\n"

# Change to package root
cd "$PACKAGE_ROOT"

# Capture starting point
START_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
START_TIME=$(date +%s)

log_info "Package root: $PACKAGE_ROOT"
log_info "Max iterations: $MAX_ITERATIONS"
log_info "Circuit breaker: stops after $NO_PROGRESS_THRESHOLD iterations without commits"
log_info "Starting commit: ${START_COMMIT:0:7}"
echo ""

#------------------------------------------------------------------------------
# The prompt - kept simple and outcome-oriented per best practices
#------------------------------------------------------------------------------
read -r -d '' BASE_PROMPT << 'PROMPT_EOF' || true
Improve the ChadGI package's productivity, reliability, or output quality. Make ONE focused change.

## Package Structure
You are improving the chadgi npm package at packages/chadgi/:
- src/           TypeScript CLI source (cli.ts, init.ts, start.ts, setup-project.ts, validate.ts)
- scripts/       Bash scripts (chadgi.sh is the main automation loop)
- templates/     Default templates copied by `chadgi init`
- README.md      Package documentation

## What to improve (pick one)
- Reduce iterations needed to complete tasks
- Improve prompt clarity in templates/chadgi-task.md or templates/chadgi-generate-task.md
- Better error handling or recovery in scripts/chadgi.sh
- Clearer logging or progress visibility
- Stronger test/build verification
- CLI usability improvements in src/
- Documentation improvements in README.md

## Rules
- Read the package files first to understand current state
- Only MODIFY files in packages/chadgi/
- If changing TypeScript, ensure it compiles: `npm run build`
- If changing bash, validate syntax: `bash -n scripts/chadgi.sh`
- Commit your change with a descriptive message

## Self-critique (answer before committing)
1. Does this change measurably improve productivity, reliability, or quality?
2. Is this the minimum change needed?
3. Could this break existing functionality?

## Output format
When done, output BOTH of these (required for exit):
```
<status>IMPROVED|DONE|BLOCKED</status>
<exit>true</exit>
```

IMPROVED = made a change and committed
DONE = no more valuable improvements right now
BLOCKED = encountered an issue, documented in output
PROMPT_EOF

#------------------------------------------------------------------------------
# Main loop with circuit breaker
#------------------------------------------------------------------------------
while [ $ITERATION -le $MAX_ITERATIONS ]; do
    log_header "ITERATION $ITERATION / $MAX_ITERATIONS"

    CURRENT_COMMIT=$(git rev-parse HEAD 2>/dev/null)

    # Build prompt with iteration context
    if [ $ITERATION -eq 1 ]; then
        FULL_PROMPT="$BASE_PROMPT"
    else
        # Subsequent iterations: add context about what changed
        RECENT=$(git log --oneline -3 2>/dev/null | head -3)
        FULL_PROMPT="$BASE_PROMPT

## Context (iteration $ITERATION)
Recent commits:
$RECENT

Previous iteration $([ \"$LAST_COMMIT_HASH\" = \"$CURRENT_COMMIT\" ] && echo 'made no changes' || echo 'committed changes').
Continue improving or output DONE if nothing valuable remains."
    fi

    # Run Claude
    OUTPUT_FILE=$(mktemp)
    log_step "Running Claude..."

    if [ $ITERATION -eq 1 ]; then
        # First iteration: fresh session
        claude --dangerously-skip-permissions --print "$FULL_PROMPT" 2>&1 | tee "$OUTPUT_FILE"
        CLAUDE_EXIT=${PIPESTATUS[0]}
    else
        # Subsequent: continue session for context
        claude --dangerously-skip-permissions --print --continue "$FULL_PROMPT" 2>&1 | tee "$OUTPUT_FILE"
        CLAUDE_EXIT=${PIPESTATUS[0]}
    fi

    # Check for dual-condition exit (both status AND exit flag)
    HAS_STATUS=$(grep -c "<status>" "$OUTPUT_FILE" 2>/dev/null || echo "0")
    HAS_EXIT=$(grep -c "<exit>true</exit>" "$OUTPUT_FILE" 2>/dev/null || echo "0")

    if [ "$HAS_STATUS" -gt 0 ] && [ "$HAS_EXIT" -gt 0 ]; then
        if grep -q "<status>DONE</status>" "$OUTPUT_FILE"; then
            log_success "Claude signaled DONE - no more improvements needed"
            rm -f "$OUTPUT_FILE"
            break
        elif grep -q "<status>BLOCKED</status>" "$OUTPUT_FILE"; then
            log_warn "Claude signaled BLOCKED - stopping"
            rm -f "$OUTPUT_FILE"
            break
        elif grep -q "<status>IMPROVED</status>" "$OUTPUT_FILE"; then
            log_success "Improvement committed!"
        fi
    else
        log_info "No complete exit signal (need both <status> and <exit>true</exit>)"
    fi

    rm -f "$OUTPUT_FILE"

    # Circuit breaker: check if progress was made
    NEW_COMMIT=$(git rev-parse HEAD 2>/dev/null)
    if [ "$NEW_COMMIT" = "$CURRENT_COMMIT" ]; then
        NO_PROGRESS_COUNT=$((NO_PROGRESS_COUNT + 1))
        log_warn "No commit this iteration ($NO_PROGRESS_COUNT/$NO_PROGRESS_THRESHOLD)"

        if [ $NO_PROGRESS_COUNT -ge $NO_PROGRESS_THRESHOLD ]; then
            log_error "Circuit breaker triggered: $NO_PROGRESS_THRESHOLD iterations without progress"
            break
        fi
    else
        NO_PROGRESS_COUNT=0
        log_success "Progress detected: ${NEW_COMMIT:0:7}"
    fi

    LAST_COMMIT_HASH="$NEW_COMMIT"
    ITERATION=$((ITERATION + 1))

    if [ $ITERATION -le $MAX_ITERATIONS ]; then
        log_info "Next iteration in 2s..."
        sleep 2
    fi
done

#------------------------------------------------------------------------------
# Summary
#------------------------------------------------------------------------------
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

show_summary
log_info "Duration: ${DURATION}s"

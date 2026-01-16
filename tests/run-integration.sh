#!/bin/bash
#
# Run all integration tests
# Usage: ./tests/run-integration.sh [--quiet]
#
# --quiet: Only show failures and final summary (for CI/agent use)
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Parse args
QUIET=0
for arg in "$@"; do
    case $arg in
        --quiet|-q)
            QUIET=1
            shift
            ;;
    esac
done

export QUIET

# List of all integration test files
TESTS=(
    "test-shared-utils.sh"
    "test-secret-masking.sh"
    "test-gigachad-mode.sh"
    "test-dry-run-mode.sh"
    "test-session-stats.sh"
    "test-retry-delay.sh"
    "test-webhook-notifications.sh"
    "test-task-timeout.sh"
    "test-pause-resume.sh"
    "test-error-diagnostics.sh"
    "test-insights.sh"
    "test-template-variables.sh"
    "test-doctor.sh"
    "test-config-inheritance.sh"
    "test-cleanup.sh"
    "test-category.sh"
    "test-priority.sh"
    "test-dependencies.sh"
    "test-estimate.sh"
    "test-queue.sh"
    "test-watch.sh"
    "test-history.sh"
    "test-setup.sh"
    "test-config-export-import.sh"
    "test-completion.sh"
    "test-replay.sh"
    "test-diff.sh"
    "test-workspace.sh"
    "test-interactive-approval.sh"
    "test-benchmark.sh"
    "test-snapshot.sh"
    "test-version.sh"
)

TOTAL_PASSED=0
TOTAL_FAILED=0
FAILED_SUITES=""

if [ "$QUIET" = "1" ]; then
    echo "Running integration tests (quiet mode)..."
    echo ""
fi

for test in "${TESTS[@]}"; do
    test_path="$SCRIPT_DIR/$test"

    if [ ! -f "$test_path" ]; then
        echo "Warning: $test not found, skipping"
        continue
    fi

    # Capture output
    if output=$(bash "$test_path" 2>&1); then
        if [ "$QUIET" = "1" ]; then
            echo -e "\033[0;32mPASS\033[0m $test"
        else
            echo "$output"
        fi
    else
        TOTAL_FAILED=$((TOTAL_FAILED + 1))
        FAILED_SUITES="${FAILED_SUITES}\n  - $test"
        if [ "$QUIET" = "1" ]; then
            echo -e "\033[0;31mFAIL\033[0m $test"
            # Show failure details
            echo "$output" | grep -E "^FAIL|^\[0;31mFAIL" || true
        else
            echo "$output"
        fi
    fi
done

echo ""
echo "=========================================="
echo "  Integration Test Summary"
echo "=========================================="

if [ $TOTAL_FAILED -eq 0 ]; then
    echo -e "\033[0;32mAll test suites passed!\033[0m"
    exit 0
else
    echo -e "\033[0;31m$TOTAL_FAILED test suite(s) failed:\033[0m"
    echo -e "$FAILED_SUITES"
    exit 1
fi

#!/bin/bash
#
# Run Jest unit tests with minimal output for CI/agent use
# Only shows pass/fail summary
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

# Run Jest and capture output
output=$(node --experimental-vm-modules node_modules/jest/bin/jest.js --silent 2>&1)
exit_code=$?

# Extract test summary from output
if [ $exit_code -eq 0 ]; then
    # Extract pass count
    summary=$(echo "$output" | grep -E "Tests:.*passed" | tail -1)
    if [ -n "$summary" ]; then
        echo -e "\033[0;32mPASS\033[0m unit tests: $summary"
    else
        echo -e "\033[0;32mPASS\033[0m unit tests"
    fi
else
    echo -e "\033[0;31mFAIL\033[0m unit tests"
    # Show only the failure details, not the diagnostic spam
    echo "$output" | grep -E "FAIL|Error:|Expected|Received|at " | head -30
fi

exit $exit_code

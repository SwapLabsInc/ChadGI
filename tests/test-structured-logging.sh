#!/bin/bash
#
# Tests for Structured Logging functionality
#
# Run with: bash tests/test-structured-logging.sh
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
echo "  Structured Logging Tests"
echo "=========================================="
echo ""

#------------------------------------------------------------------------------
# Test 1: Log level constants are defined
#------------------------------------------------------------------------------
echo "Test 1: Log level constants are defined"

CONSTANTS_FOUND=true
for CONST in "LOG_LEVEL_ERROR" "LOG_LEVEL_WARN" "LOG_LEVEL_INFO" "LOG_LEVEL_DEBUG"; do
    if ! grep -q "^$CONST=" "$PROJECT_ROOT/scripts/chadgi.sh"; then
        echo "  Missing: $CONST"
        CONSTANTS_FOUND=false
    fi
done

if [ "$CONSTANTS_FOUND" = true ]; then
    pass "Log level constants found"
else
    fail "Some log level constants missing"
fi

#------------------------------------------------------------------------------
# Test 2: parse_log_level function exists and handles all levels
#------------------------------------------------------------------------------
echo "Test 2: parse_log_level function exists"

if grep -q "^parse_log_level()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "parse_log_level function exists"
else
    fail "parse_log_level function should exist"
fi

#------------------------------------------------------------------------------
# Test 3: parse_log_level handles all log levels
#------------------------------------------------------------------------------
echo "Test 3: parse_log_level handles all log levels"

LEVELS_HANDLED=true
for LEVEL in "DEBUG" "INFO" "WARN" "WARNING" "ERROR"; do
    if ! grep -A20 "^parse_log_level()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -qi "\"$LEVEL\""; then
        echo "  Missing handler for: $LEVEL"
        LEVELS_HANDLED=false
    fi
done

if [ "$LEVELS_HANDLED" = true ]; then
    pass "All log levels handled"
else
    fail "Some log levels not handled"
fi

#------------------------------------------------------------------------------
# Test 4: get_log_timestamp function exists
#------------------------------------------------------------------------------
echo "Test 4: get_log_timestamp function exists"

if grep -q "^get_log_timestamp()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "get_log_timestamp function exists"
else
    fail "get_log_timestamp function should exist"
fi

#------------------------------------------------------------------------------
# Test 5: strip_colors function exists
#------------------------------------------------------------------------------
echo "Test 5: strip_colors function exists"

if grep -q "^strip_colors()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "strip_colors function exists"
else
    fail "strip_colors function should exist"
fi

#------------------------------------------------------------------------------
# Test 6: rotate_logs function exists
#------------------------------------------------------------------------------
echo "Test 6: rotate_logs function exists"

if grep -q "^rotate_logs()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "rotate_logs function exists"
else
    fail "rotate_logs function should exist"
fi

#------------------------------------------------------------------------------
# Test 7: rotate_logs uses LOG_FILE_MAX_SIZE_MB
#------------------------------------------------------------------------------
echo "Test 7: rotate_logs uses LOG_FILE_MAX_SIZE_MB"

if grep -A30 "^rotate_logs()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q "LOG_FILE_MAX_SIZE_MB"; then
    pass "rotate_logs uses LOG_FILE_MAX_SIZE_MB"
else
    fail "rotate_logs should use LOG_FILE_MAX_SIZE_MB"
fi

#------------------------------------------------------------------------------
# Test 8: rotate_logs uses LOG_FILE_MAX_COUNT
#------------------------------------------------------------------------------
echo "Test 8: rotate_logs uses LOG_FILE_MAX_COUNT"

if grep -A30 "^rotate_logs()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q "LOG_FILE_MAX_COUNT"; then
    pass "rotate_logs uses LOG_FILE_MAX_COUNT"
else
    fail "rotate_logs should use LOG_FILE_MAX_COUNT"
fi

#------------------------------------------------------------------------------
# Test 9: write_to_log_file function exists
#------------------------------------------------------------------------------
echo "Test 9: write_to_log_file function exists"

if grep -q "^write_to_log_file()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "write_to_log_file function exists"
else
    fail "write_to_log_file function should exist"
fi

#------------------------------------------------------------------------------
# Test 10: write_to_log_file includes timestamp
#------------------------------------------------------------------------------
echo "Test 10: write_to_log_file includes timestamp"

if grep -A30 "^write_to_log_file()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q "get_log_timestamp"; then
    pass "write_to_log_file includes timestamp"
else
    fail "write_to_log_file should include timestamp"
fi

#------------------------------------------------------------------------------
# Test 11: _log core function exists
#------------------------------------------------------------------------------
echo "Test 11: _log core function exists"

if grep -q "^_log()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "_log core function exists"
else
    fail "_log core function should exist"
fi

#------------------------------------------------------------------------------
# Test 12: log_debug function exists
#------------------------------------------------------------------------------
echo "Test 12: log_debug function exists"

if grep -q "^function log_debug()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "log_debug function exists"
else
    fail "log_debug function should exist"
fi

#------------------------------------------------------------------------------
# Test 13: Config template has log_level setting
#------------------------------------------------------------------------------
echo "Test 13: Config template has log_level setting"

if grep -q "log_level:" "$PROJECT_ROOT/templates/chadgi-config.yaml"; then
    pass "Config template has log_level setting"
else
    fail "Config template should have log_level setting"
fi

#------------------------------------------------------------------------------
# Test 14: Config template has log_file setting
#------------------------------------------------------------------------------
echo "Test 14: Config template has log_file setting"

if grep -q "log_file:" "$PROJECT_ROOT/templates/chadgi-config.yaml"; then
    pass "Config template has log_file setting"
else
    fail "Config template should have log_file setting"
fi

#------------------------------------------------------------------------------
# Test 15: Config template has max_log_size_mb setting
#------------------------------------------------------------------------------
echo "Test 15: Config template has max_log_size_mb setting"

if grep -q "max_log_size_mb:" "$PROJECT_ROOT/templates/chadgi-config.yaml"; then
    pass "Config template has max_log_size_mb setting"
else
    fail "Config template should have max_log_size_mb setting"
fi

#------------------------------------------------------------------------------
# Test 16: Config template has max_log_files setting
#------------------------------------------------------------------------------
echo "Test 16: Config template has max_log_files setting"

if grep -q "max_log_files:" "$PROJECT_ROOT/templates/chadgi-config.yaml"; then
    pass "Config template has max_log_files setting"
else
    fail "Config template should have max_log_files setting"
fi

#------------------------------------------------------------------------------
# Test 17: CLI has --debug flag
#------------------------------------------------------------------------------
echo "Test 17: CLI has --debug flag"

if grep -q "\-\-debug" "$PROJECT_ROOT/src/cli.ts"; then
    pass "CLI has --debug flag"
else
    fail "CLI should have --debug flag"
fi

#------------------------------------------------------------------------------
# Test 18: start.ts has debug option in StartOptions
#------------------------------------------------------------------------------
echo "Test 18: start.ts has debug option in StartOptions"

if grep -q "debug?:" "$PROJECT_ROOT/src/start.ts"; then
    pass "start.ts has debug option in StartOptions"
else
    fail "start.ts should have debug option in StartOptions"
fi

#------------------------------------------------------------------------------
# Test 19: start.ts passes DEBUG_MODE environment variable
#------------------------------------------------------------------------------
echo "Test 19: start.ts passes DEBUG_MODE environment variable"

if grep -q "DEBUG_MODE:" "$PROJECT_ROOT/src/start.ts"; then
    pass "DEBUG_MODE environment variable passed in start.ts"
else
    fail "DEBUG_MODE environment variable should be passed in start.ts"
fi

#------------------------------------------------------------------------------
# Test 20: chadgi.sh reads DEBUG_MODE environment variable
#------------------------------------------------------------------------------
echo "Test 20: chadgi.sh reads DEBUG_MODE environment variable"

if grep -q 'DEBUG_MODE="\${DEBUG_MODE:-false}"' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "DEBUG_MODE variable initialization found in chadgi.sh"
else
    fail "DEBUG_MODE variable should be initialized in chadgi.sh"
fi

#------------------------------------------------------------------------------
# Test 21: log_info uses _log function
#------------------------------------------------------------------------------
echo "Test 21: log_info uses _log function"

if grep -A3 "^function log_info()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q "_log"; then
    pass "log_info uses _log function"
else
    fail "log_info should use _log function"
fi

#------------------------------------------------------------------------------
# Test 22: log_warn uses _log function
#------------------------------------------------------------------------------
echo "Test 22: log_warn uses _log function"

if grep -A3 "^function log_warn()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q "_log"; then
    pass "log_warn uses _log function"
else
    fail "log_warn should use _log function"
fi

#------------------------------------------------------------------------------
# Test 23: log_error uses _log function
#------------------------------------------------------------------------------
echo "Test 23: log_error uses _log function"

if grep -A3 "^function log_error()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q "_log"; then
    pass "log_error uses _log function"
else
    fail "log_error should use _log function"
fi

#------------------------------------------------------------------------------
# Test 24: load_config reads log_level from config
#------------------------------------------------------------------------------
echo "Test 24: load_config reads log_level from config"

if grep -q 'parse_yaml_nested "output" "log_level"' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "load_config reads log_level from config"
else
    fail "load_config should read log_level from config"
fi

#------------------------------------------------------------------------------
# Test 25: load_config reads log_file from config
#------------------------------------------------------------------------------
echo "Test 25: load_config reads log_file from config"

if grep -q 'parse_yaml_nested "output" "log_file"' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "load_config reads log_file from config"
else
    fail "load_config should read log_file from config"
fi

#------------------------------------------------------------------------------
# Test 26: init_log_file function exists
#------------------------------------------------------------------------------
echo "Test 26: init_log_file function exists"

if grep -q "^init_log_file()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "init_log_file function exists"
else
    fail "init_log_file function should exist"
fi

#------------------------------------------------------------------------------
# Test 27: Log level displayed on startup
#------------------------------------------------------------------------------
echo "Test 27: Log level displayed on startup"

if grep -q 'log_info "Log Level:' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Log level displayed on startup"
else
    fail "Log level should be displayed on startup"
fi

#------------------------------------------------------------------------------
# Test 28: Log file path displayed on startup
#------------------------------------------------------------------------------
echo "Test 28: Log file path displayed on startup"

if grep -q 'log_info "Log File:' "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "Log file path displayed on startup"
else
    fail "Log file path should be displayed on startup"
fi

#------------------------------------------------------------------------------
# Test 29: Build compiles without errors
#------------------------------------------------------------------------------
echo "Test 29: Build compiles without errors"

cd "$PROJECT_ROOT"
if npm run build > /dev/null 2>&1; then
    pass "Build compiles successfully"
else
    fail "Build should compile without errors"
fi

#------------------------------------------------------------------------------
# Test 30: Start command help shows --debug option
#------------------------------------------------------------------------------
echo "Test 30: Start command help shows --debug option"

cd "$PROJECT_ROOT"
if node dist/cli.js start --help 2>&1 | grep -q "\-\-debug"; then
    pass "Start command help shows --debug option"
else
    fail "Start command help should show --debug option"
fi

#------------------------------------------------------------------------------
# Test 31: get_log_level_name function exists
#------------------------------------------------------------------------------
echo "Test 31: get_log_level_name function exists"

if grep -q "^get_log_level_name()" "$PROJECT_ROOT/scripts/chadgi.sh"; then
    pass "get_log_level_name function exists"
else
    fail "get_log_level_name function should exist"
fi

#------------------------------------------------------------------------------
# Test 32: Log step uses DEBUG level
#------------------------------------------------------------------------------
echo "Test 32: Log step uses DEBUG level"

if grep -A3 "^function log_step()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q "LOG_LEVEL_DEBUG"; then
    pass "log_step uses DEBUG level"
else
    fail "log_step should use DEBUG level"
fi

#------------------------------------------------------------------------------
# Test 33: Log success uses INFO level
#------------------------------------------------------------------------------
echo "Test 33: Log success uses INFO level"

if grep -A3 "^function log_success()" "$PROJECT_ROOT/scripts/chadgi.sh" | grep -q "LOG_LEVEL_INFO"; then
    pass "log_success uses INFO level"
else
    fail "log_success should use INFO level"
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

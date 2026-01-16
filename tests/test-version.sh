#!/bin/bash
#
# Tests for Version Command functionality
#
# Run with: bash tests/test-version.sh
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
echo "  Version Command Tests"
echo "=========================================="
echo ""

#------------------------------------------------------------------------------
# Test 1: version.ts file exists
#------------------------------------------------------------------------------
echo "Test 1: version.ts file exists"

if [ -f "$PROJECT_ROOT/src/version.ts" ]; then
    pass "version.ts file exists"
else
    fail "version.ts should exist"
fi

#------------------------------------------------------------------------------
# Test 2: CLI has version command
#------------------------------------------------------------------------------
echo "Test 2: CLI has version command"

if grep -q "command('version')" "$PROJECT_ROOT/src/cli.ts"; then
    pass "version command exists in CLI"
else
    fail "version command should exist in CLI"
fi

#------------------------------------------------------------------------------
# Test 3: CLI imports version module
#------------------------------------------------------------------------------
echo "Test 3: CLI imports version module"

if grep -q "import { version }" "$PROJECT_ROOT/src/cli.ts"; then
    pass "version module imported in CLI"
else
    fail "version module should be imported in CLI"
fi

#------------------------------------------------------------------------------
# Test 4: Version command has --json option
#------------------------------------------------------------------------------
echo "Test 4: Version command has --json option"

if grep -A5 "command('version')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-json"; then
    pass "--json option exists for version command"
else
    fail "version command should have --json option"
fi

#------------------------------------------------------------------------------
# Test 5: Version command has --check option
#------------------------------------------------------------------------------
echo "Test 5: Version command has --check option"

if grep -A5 "command('version')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-check"; then
    pass "--check option exists for version command"
else
    fail "version command should have --check option"
fi

#------------------------------------------------------------------------------
# Test 6: version.ts reads ChadGI version from package.json
#------------------------------------------------------------------------------
echo "Test 6: version.ts reads ChadGI version from package.json"

if grep -q "package.json\|getChadGIVersion" "$PROJECT_ROOT/src/version.ts"; then
    pass "version.ts reads version from package.json"
else
    fail "version.ts should read version from package.json"
fi

#------------------------------------------------------------------------------
# Test 7: version.ts gets Node.js version
#------------------------------------------------------------------------------
echo "Test 7: version.ts gets Node.js version"

if grep -q "process.version\|getNodeVersion\|node" "$PROJECT_ROOT/src/version.ts"; then
    pass "version.ts gets Node.js version"
else
    fail "version.ts should get Node.js version"
fi

#------------------------------------------------------------------------------
# Test 8: version.ts gets Claude CLI version
#------------------------------------------------------------------------------
echo "Test 8: version.ts gets Claude CLI version"

if grep -q "getClaudeVersion\|claude.*version\|claude_cli" "$PROJECT_ROOT/src/version.ts"; then
    pass "version.ts gets Claude CLI version"
else
    fail "version.ts should get Claude CLI version"
fi

#------------------------------------------------------------------------------
# Test 9: version.ts gets GitHub CLI version
#------------------------------------------------------------------------------
echo "Test 9: version.ts gets GitHub CLI version"

if grep -q "getGhVersion\|gh.*version\|github_cli" "$PROJECT_ROOT/src/version.ts"; then
    pass "version.ts gets GitHub CLI version"
else
    fail "version.ts should get GitHub CLI version"
fi

#------------------------------------------------------------------------------
# Test 10: version.ts gets jq version
#------------------------------------------------------------------------------
echo "Test 10: version.ts gets jq version"

if grep -q "getJqVersion\|jq.*version" "$PROJECT_ROOT/src/version.ts"; then
    pass "version.ts gets jq version"
else
    fail "version.ts should get jq version"
fi

#------------------------------------------------------------------------------
# Test 11: version.ts checks npm registry for updates
#------------------------------------------------------------------------------
echo "Test 11: version.ts checks npm registry for updates"

if grep -q "registry.npmjs.org\|checkForUpdate" "$PROJECT_ROOT/src/version.ts"; then
    pass "version.ts checks npm registry for updates"
else
    fail "version.ts should check npm registry for updates"
fi

#------------------------------------------------------------------------------
# Test 12: version.ts caches update check results
#------------------------------------------------------------------------------
echo "Test 12: version.ts caches update check results"

if grep -q "update-check.json\|UpdateCheckCache\|writeCache\|readCache" "$PROJECT_ROOT/src/version.ts"; then
    pass "version.ts caches update check results"
else
    fail "version.ts should cache update check results"
fi

#------------------------------------------------------------------------------
# Test 13: version.ts has semver comparison function
#------------------------------------------------------------------------------
echo "Test 13: version.ts has semver comparison function"

if grep -q "compareVersions" "$PROJECT_ROOT/src/version.ts"; then
    pass "version.ts has semver comparison function"
else
    fail "version.ts should have semver comparison function"
fi

#------------------------------------------------------------------------------
# Test 14: version.ts exports version function
#------------------------------------------------------------------------------
echo "Test 14: version.ts exports version function"

if grep -q "export async function version" "$PROJECT_ROOT/src/version.ts"; then
    pass "version.ts exports version function"
else
    fail "version.ts should export version function"
fi

#------------------------------------------------------------------------------
# Test 15: version.ts uses colored output
#------------------------------------------------------------------------------
echo "Test 15: version.ts uses colored output"

if grep -q "colors\s*=\|from './utils/colors.js'" "$PROJECT_ROOT/src/version.ts"; then
    pass "version.ts uses colored output"
else
    fail "version.ts should use colored output"
fi

#------------------------------------------------------------------------------
# Test 16: version.ts handles JSON output
#------------------------------------------------------------------------------
echo "Test 16: version.ts handles JSON output"

if grep -q "options.json\|JSON.stringify" "$PROJECT_ROOT/src/version.ts"; then
    pass "version.ts handles JSON output"
else
    fail "version.ts should handle JSON output"
fi

#------------------------------------------------------------------------------
# Test 17: version.ts imports from types/index.ts
#------------------------------------------------------------------------------
echo "Test 17: version.ts imports from types/index.ts"

if grep -q "from './types/index.js'" "$PROJECT_ROOT/src/version.ts"; then
    pass "version.ts imports from types/index.ts"
else
    fail "version.ts should import from types/index.ts"
fi

#------------------------------------------------------------------------------
# Test 18: types/index.ts has VersionInfo interface
#------------------------------------------------------------------------------
echo "Test 18: types/index.ts has VersionInfo interface"

if grep -q "interface VersionInfo\|export interface VersionInfo" "$PROJECT_ROOT/src/types/index.ts"; then
    pass "types/index.ts has VersionInfo interface"
else
    fail "types/index.ts should have VersionInfo interface"
fi

#------------------------------------------------------------------------------
# Test 19: types/index.ts has UpdateCheckCache interface
#------------------------------------------------------------------------------
echo "Test 19: types/index.ts has UpdateCheckCache interface"

if grep -q "interface UpdateCheckCache\|export interface UpdateCheckCache" "$PROJECT_ROOT/src/types/index.ts"; then
    pass "types/index.ts has UpdateCheckCache interface"
else
    fail "types/index.ts should have UpdateCheckCache interface"
fi

#------------------------------------------------------------------------------
# Test 20: version.ts stores cache in .chadgi directory
#------------------------------------------------------------------------------
echo "Test 20: version.ts stores cache in .chadgi directory"

if grep -q ".chadgi.*update-check\|getCachePath" "$PROJECT_ROOT/src/version.ts"; then
    pass "version.ts stores cache in .chadgi directory"
else
    fail "version.ts should store cache in .chadgi directory"
fi

#------------------------------------------------------------------------------
# Test 21: version.ts cache expires after 24 hours
#------------------------------------------------------------------------------
echo "Test 21: version.ts cache expires after 24 hours"

if grep -q "24\|hoursSinceCheck\|less than.*hours" "$PROJECT_ROOT/src/version.ts"; then
    pass "version.ts cache expires after 24 hours"
else
    fail "version.ts cache should expire after 24 hours"
fi

#------------------------------------------------------------------------------
# Test 22: version.ts shows update instructions
#------------------------------------------------------------------------------
echo "Test 22: version.ts shows update instructions"

if grep -q "npm install -g chadgi\|@latest" "$PROJECT_ROOT/src/version.ts"; then
    pass "version.ts shows update instructions"
else
    fail "version.ts should show update instructions"
fi

#------------------------------------------------------------------------------
# Test 23: version.ts handles VersionOptions interface
#------------------------------------------------------------------------------
echo "Test 23: version.ts handles VersionOptions interface"

if grep -q "VersionOptions\|interface.*Options" "$PROJECT_ROOT/src/version.ts"; then
    pass "version.ts handles VersionOptions"
else
    fail "version.ts should handle VersionOptions interface"
fi

#------------------------------------------------------------------------------
# Test 24: version.ts has DependencyInfo interface
#------------------------------------------------------------------------------
echo "Test 24: version.ts has DependencyInfo interface"

if grep -q "interface DependencyInfo\|DependencyInfo" "$PROJECT_ROOT/src/version.ts"; then
    pass "version.ts has DependencyInfo interface"
else
    fail "version.ts should have DependencyInfo interface"
fi

#------------------------------------------------------------------------------
# Test 25: version.ts uses execSync for command execution
#------------------------------------------------------------------------------
echo "Test 25: version.ts uses execSync for command execution"

if grep -q "execSync\|import.*child_process" "$PROJECT_ROOT/src/version.ts"; then
    pass "version.ts uses execSync for command execution"
else
    fail "version.ts should use execSync for command execution"
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

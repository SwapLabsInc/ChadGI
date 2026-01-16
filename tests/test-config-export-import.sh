#!/bin/bash
#
# Tests for Config Export/Import Command functionality
#
# Run with: bash tests/test-config-export-import.sh
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
echo "  Config Export/Import Command Tests"
echo "=========================================="
echo ""

#------------------------------------------------------------------------------
# Test 1: config-export-import.ts file exists
#------------------------------------------------------------------------------
echo "Test 1: config-export-import.ts file exists"

if [ -f "$PROJECT_ROOT/src/config-export-import.ts" ]; then
    pass "config-export-import.ts file exists"
else
    fail "config-export-import.ts should exist"
fi

#------------------------------------------------------------------------------
# Test 2: CLI has config command
#------------------------------------------------------------------------------
echo "Test 2: CLI has config command"

if grep -q "command('config')" "$PROJECT_ROOT/src/cli.ts"; then
    pass "config command exists in CLI"
else
    fail "config command should exist in CLI"
fi

#------------------------------------------------------------------------------
# Test 3: CLI imports configExport function
#------------------------------------------------------------------------------
echo "Test 3: CLI imports configExport function"

if grep -q "import { configExport, configImport }" "$PROJECT_ROOT/src/cli.ts"; then
    pass "configExport and configImport imported in CLI"
else
    fail "configExport and configImport should be imported in CLI"
fi

#------------------------------------------------------------------------------
# Test 4: Config export command exists
#------------------------------------------------------------------------------
echo "Test 4: Config export command exists"

if grep -q "command('export')" "$PROJECT_ROOT/src/cli.ts"; then
    pass "export subcommand exists"
else
    fail "export subcommand should exist"
fi

#------------------------------------------------------------------------------
# Test 5: Config import command exists
#------------------------------------------------------------------------------
echo "Test 5: Config import command exists"

if grep -q "command('import" "$PROJECT_ROOT/src/cli.ts"; then
    pass "import subcommand exists"
else
    fail "import subcommand should exist"
fi

#------------------------------------------------------------------------------
# Test 6: Export command has --exclude-secrets option
#------------------------------------------------------------------------------
echo "Test 6: Export command has --exclude-secrets option"

if grep -A10 "command('export')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-exclude-secrets"; then
    pass "--exclude-secrets option exists for export"
else
    fail "export command should have --exclude-secrets option"
fi

#------------------------------------------------------------------------------
# Test 7: Export command has --output option
#------------------------------------------------------------------------------
echo "Test 7: Export command has --output option"

if grep -A10 "command('export')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-output"; then
    pass "--output option exists for export"
else
    fail "export command should have --output option"
fi

#------------------------------------------------------------------------------
# Test 8: Export command has --format option
#------------------------------------------------------------------------------
echo "Test 8: Export command has --format option"

if grep -A10 "command('export')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-format"; then
    pass "--format option exists for export"
else
    fail "export command should have --format option"
fi

#------------------------------------------------------------------------------
# Test 9: Import command has --merge option
#------------------------------------------------------------------------------
echo "Test 9: Import command has --merge option"

if grep -A10 "command('import" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-merge"; then
    pass "--merge option exists for import"
else
    fail "import command should have --merge option"
fi

#------------------------------------------------------------------------------
# Test 10: Import command has --dry-run option
#------------------------------------------------------------------------------
echo "Test 10: Import command has --dry-run option"

if grep -A10 "command('import" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-dry-run"; then
    pass "--dry-run option exists for import"
else
    fail "import command should have --dry-run option"
fi

#------------------------------------------------------------------------------
# Test 11: config-export-import.ts exports configExport function
#------------------------------------------------------------------------------
echo "Test 11: config-export-import.ts exports configExport function"

if grep -q "export async function configExport" "$PROJECT_ROOT/src/config-export-import.ts"; then
    pass "configExport function is exported"
else
    fail "configExport function should be exported"
fi

#------------------------------------------------------------------------------
# Test 12: config-export-import.ts exports configImport function
#------------------------------------------------------------------------------
echo "Test 12: config-export-import.ts exports configImport function"

if grep -q "export async function configImport" "$PROJECT_ROOT/src/config-export-import.ts"; then
    pass "configImport function is exported"
else
    fail "configImport function should be exported"
fi

#------------------------------------------------------------------------------
# Test 13: Export includes _meta section with version
#------------------------------------------------------------------------------
echo "Test 13: Export includes _meta section with version"

if grep -q "_meta:" "$PROJECT_ROOT/src/config-export-import.ts" && grep -q "chadgi_version" "$PROJECT_ROOT/src/config-export-import.ts"; then
    pass "Export includes _meta section with version"
else
    fail "Export should include _meta section with version"
fi

#------------------------------------------------------------------------------
# Test 14: Export includes templates
#------------------------------------------------------------------------------
echo "Test 14: Export includes templates"

if grep -q "templates:" "$PROJECT_ROOT/src/config-export-import.ts" && grep -q "chadgi-task.md\|chadgi-generate-task.md" "$PROJECT_ROOT/src/config-export-import.ts"; then
    pass "Export includes templates"
else
    fail "Export should include templates"
fi

#------------------------------------------------------------------------------
# Test 15: Secret detection for webhook_url
#------------------------------------------------------------------------------
echo "Test 15: Secret detection for webhook_url"

if grep -q "webhook_url" "$PROJECT_ROOT/src/config-export-import.ts" | head -1 && grep -q "SECRET_KEYS\|isSecretKey" "$PROJECT_ROOT/src/config-export-import.ts"; then
    pass "Secret detection for webhook_url implemented"
else
    fail "Secret detection should include webhook_url"
fi

#------------------------------------------------------------------------------
# Test 16: Secret detection for api_key
#------------------------------------------------------------------------------
echo "Test 16: Secret detection for api_key"

if grep -q "api_key" "$PROJECT_ROOT/src/config-export-import.ts"; then
    pass "Secret detection for api_key implemented"
else
    fail "Secret detection should include api_key"
fi

#------------------------------------------------------------------------------
# Test 17: Version comparison function exists
#------------------------------------------------------------------------------
echo "Test 17: Version comparison function exists"

if grep -q "compareVersions\|getMajorVersion" "$PROJECT_ROOT/src/config-export-import.ts"; then
    pass "Version comparison function exists"
else
    fail "Version comparison function should exist"
fi

#------------------------------------------------------------------------------
# Test 18: Import validates version compatibility
#------------------------------------------------------------------------------
echo "Test 18: Import validates version compatibility"

if grep -q "version mismatch\|Version difference" "$PROJECT_ROOT/src/config-export-import.ts"; then
    pass "Import validates version compatibility"
else
    fail "Import should validate version compatibility"
fi

#------------------------------------------------------------------------------
# Test 19: Deep merge function for config merging
#------------------------------------------------------------------------------
echo "Test 19: Deep merge function for config merging"

if grep -q "deepMerge" "$PROJECT_ROOT/src/config-export-import.ts"; then
    pass "Deep merge function exists"
else
    fail "Deep merge function should exist for --merge support"
fi

#------------------------------------------------------------------------------
# Test 20: Export timestamp included
#------------------------------------------------------------------------------
echo "Test 20: Export timestamp included"

if grep -q "exported_at" "$PROJECT_ROOT/src/config-export-import.ts"; then
    pass "Export timestamp (exported_at) included"
else
    fail "Export should include timestamp"
fi

#------------------------------------------------------------------------------
# Test 21: Source repo detection
#------------------------------------------------------------------------------
echo "Test 21: Source repo detection"

if grep -q "source_repo\|detectRepository" "$PROJECT_ROOT/src/config-export-import.ts"; then
    pass "Source repo detection implemented"
else
    fail "Source repo detection should be implemented"
fi

#------------------------------------------------------------------------------
# Test 22: YAML format support
#------------------------------------------------------------------------------
echo "Test 22: YAML format support"

if grep -q "format === 'yaml'\|format.*yaml" "$PROJECT_ROOT/src/config-export-import.ts"; then
    pass "YAML format support implemented"
else
    fail "YAML format support should be implemented"
fi

#------------------------------------------------------------------------------
# Test 23: JSON format support
#------------------------------------------------------------------------------
echo "Test 23: JSON format support"

if grep -q "JSON.stringify\|JSON.parse" "$PROJECT_ROOT/src/config-export-import.ts"; then
    pass "JSON format support implemented"
else
    fail "JSON format support should be implemented"
fi

#------------------------------------------------------------------------------
# Test 24: Missing secrets prompt
#------------------------------------------------------------------------------
echo "Test 24: Missing secrets prompt"

if grep -q "Missing secrets\|missingSecrets\|findSecretPlaceholders" "$PROJECT_ROOT/src/config-export-import.ts"; then
    pass "Missing secrets prompt implemented"
else
    fail "Missing secrets prompt should be implemented"
fi

#------------------------------------------------------------------------------
# Test 25: Dry run support for import
#------------------------------------------------------------------------------
echo "Test 25: Dry run support for import"

if grep -q "dryRun\|dry-run\|Dry run mode" "$PROJECT_ROOT/src/config-export-import.ts"; then
    pass "Dry run support implemented"
else
    fail "Dry run support should be implemented"
fi

#------------------------------------------------------------------------------
# Test 26: ConfigExportOptions interface exists
#------------------------------------------------------------------------------
echo "Test 26: ConfigExportOptions interface exists"

if grep -q "interface ConfigExportOptions" "$PROJECT_ROOT/src/config-export-import.ts"; then
    pass "ConfigExportOptions interface exists"
else
    fail "ConfigExportOptions interface should exist"
fi

#------------------------------------------------------------------------------
# Test 27: ConfigImportOptions interface exists
#------------------------------------------------------------------------------
echo "Test 27: ConfigImportOptions interface exists"

if grep -q "interface ConfigImportOptions" "$PROJECT_ROOT/src/config-export-import.ts"; then
    pass "ConfigImportOptions interface exists"
else
    fail "ConfigImportOptions interface should exist"
fi

#------------------------------------------------------------------------------
# Test 28: ExportBundle interface exists
#------------------------------------------------------------------------------
echo "Test 28: ExportBundle interface exists"

if grep -q "interface ExportBundle" "$PROJECT_ROOT/src/config-export-import.ts"; then
    pass "ExportBundle interface exists"
else
    fail "ExportBundle interface should exist"
fi

#------------------------------------------------------------------------------
# Test 29: stripSecrets function exists
#------------------------------------------------------------------------------
echo "Test 29: stripSecrets function exists"

if grep -q "function stripSecrets\|stripSecrets(" "$PROJECT_ROOT/src/config-export-import.ts"; then
    pass "stripSecrets function exists"
else
    fail "stripSecrets function should exist"
fi

#------------------------------------------------------------------------------
# Test 30: Config command has description
#------------------------------------------------------------------------------
echo "Test 30: Config command has description"

if grep -A5 "command('config')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\.description("; then
    pass "config command has description"
else
    fail "config command should have description"
fi

#------------------------------------------------------------------------------
# Test 31: Export command has description
#------------------------------------------------------------------------------
echo "Test 31: Export command has description"

if grep -A5 "command('export')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\.description("; then
    pass "export command has description"
else
    fail "export command should have description"
fi

#------------------------------------------------------------------------------
# Test 32: Import command has description
#------------------------------------------------------------------------------
echo "Test 32: Import command has description"

if grep -A5 "command('import" "$PROJECT_ROOT/src/cli.ts" | grep -q "\.description("; then
    pass "import command has description"
else
    fail "import command should have description"
fi

#------------------------------------------------------------------------------
# Test 33: parseYamlToObject function exists
#------------------------------------------------------------------------------
echo "Test 33: parseYamlToObject function exists"

if grep -q "function parseYamlToObject\|parseYamlToObject(" "$PROJECT_ROOT/src/config-export-import.ts"; then
    pass "parseYamlToObject function exists"
else
    fail "parseYamlToObject function should exist"
fi

#------------------------------------------------------------------------------
# Test 34: objectToYaml function exists
#------------------------------------------------------------------------------
echo "Test 34: objectToYaml function exists"

if grep -q "function objectToYaml\|objectToYaml(" "$PROJECT_ROOT/src/config-export-import.ts"; then
    pass "objectToYaml function exists"
else
    fail "objectToYaml function should exist"
fi

#------------------------------------------------------------------------------
# Test 35: Config export/import supports --config option
#------------------------------------------------------------------------------
echo "Test 35: Config export/import supports --config option"

if grep -A15 "command('export')" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-config" && \
   grep -A15 "command('import" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-config"; then
    pass "--config option supported for both export and import"
else
    fail "--config option should be supported for both export and import"
fi

#------------------------------------------------------------------------------
# Test 36: Secret token detection
#------------------------------------------------------------------------------
echo "Test 36: Secret token detection"

if grep -q "token" "$PROJECT_ROOT/src/config-export-import.ts" | head -1; then
    pass "Secret token detection implemented"
else
    fail "Secret detection should include token"
fi

#------------------------------------------------------------------------------
# Test 37: Color output support
#------------------------------------------------------------------------------
echo "Test 37: Color output support"

if grep -q "colors\s*=\|from './utils/colors.js'" "$PROJECT_ROOT/src/config-export-import.ts"; then
    pass "Color output support implemented"
else
    fail "Color output support should be implemented"
fi

#------------------------------------------------------------------------------
# Test 38: File existence check for config
#------------------------------------------------------------------------------
echo "Test 38: File existence check for config"

if grep -q "existsSync.*configPath\|Config.*not found" "$PROJECT_ROOT/src/config-export-import.ts"; then
    pass "File existence check for config implemented"
else
    fail "File existence check should be implemented"
fi

#------------------------------------------------------------------------------
# Test 39: Import validates bundle structure
#------------------------------------------------------------------------------
echo "Test 39: Import validates bundle structure"

if grep -q "Invalid export bundle\|missing _meta\|missing.*config" "$PROJECT_ROOT/src/config-export-import.ts"; then
    pass "Bundle structure validation implemented"
else
    fail "Bundle structure validation should be implemented"
fi

#------------------------------------------------------------------------------
# Test 40: Suggests running validate after import
#------------------------------------------------------------------------------
echo "Test 40: Suggests running validate after import"

if grep -q "chadgi validate" "$PROJECT_ROOT/src/config-export-import.ts"; then
    pass "Suggests running validate after import"
else
    fail "Should suggest running validate after import"
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

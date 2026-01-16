#!/bin/bash
#
# Tests for Diff command functionality
#
# Run with: bash tests/test-diff.sh
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

echo "=========================================="
echo "  Diff Command Tests"
echo "=========================================="
echo ""

#------------------------------------------------------------------------------
# Test 1: diff.ts file exists
#------------------------------------------------------------------------------
echo "Test 1: diff.ts file exists"

if [ -f "$PROJECT_ROOT/src/diff.ts" ]; then
    pass "diff.ts file exists"
else
    fail "diff.ts should exist"
fi

#------------------------------------------------------------------------------
# Test 2: CLI has diff command
#------------------------------------------------------------------------------
echo "Test 2: CLI has diff command"

if grep -q "command('diff" "$PROJECT_ROOT/src/cli.ts"; then
    pass "diff command exists in CLI"
else
    fail "diff command should exist in CLI"
fi

#------------------------------------------------------------------------------
# Test 3: CLI imports diff module
#------------------------------------------------------------------------------
echo "Test 3: CLI imports diff module"

if grep -q "import { diff }" "$PROJECT_ROOT/src/cli.ts"; then
    pass "diff module imported in CLI"
else
    fail "diff module should be imported in CLI"
fi

#------------------------------------------------------------------------------
# Test 4: diff command has --stat option
#------------------------------------------------------------------------------
echo "Test 4: diff command has --stat option"

if grep -A15 "command('diff" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-stat"; then
    pass "--stat option exists for diff command"
else
    fail "diff command should have --stat option"
fi

#------------------------------------------------------------------------------
# Test 5: diff command has --files option
#------------------------------------------------------------------------------
echo "Test 5: diff command has --files option"

if grep -A15 "command('diff" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-files"; then
    pass "--files option exists for diff command"
else
    fail "diff command should have --files option"
fi

#------------------------------------------------------------------------------
# Test 6: diff command has --pr option
#------------------------------------------------------------------------------
echo "Test 6: diff command has --pr option"

if grep -A15 "command('diff" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-pr"; then
    pass "--pr option exists for diff command"
else
    fail "diff command should have --pr option"
fi

#------------------------------------------------------------------------------
# Test 7: diff command has --output option
#------------------------------------------------------------------------------
echo "Test 7: diff command has --output option"

if grep -A15 "command('diff" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-output"; then
    pass "--output option exists for diff command"
else
    fail "diff command should have --output option"
fi

#------------------------------------------------------------------------------
# Test 8: diff command has --json option
#------------------------------------------------------------------------------
echo "Test 8: diff command has --json option"

if grep -A15 "command('diff" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-json"; then
    pass "--json option exists for diff command"
else
    fail "diff command should have --json option"
fi

#------------------------------------------------------------------------------
# Test 9: diff.ts defines DiffOptions interface
#------------------------------------------------------------------------------
echo "Test 9: diff.ts defines DiffOptions interface"

if grep -q "interface DiffOptions" "$PROJECT_ROOT/src/diff.ts"; then
    pass "DiffOptions interface defined"
else
    fail "DiffOptions interface should be defined"
fi

#------------------------------------------------------------------------------
# Test 10: diff.ts defines DiffResult interface
#------------------------------------------------------------------------------
echo "Test 10: diff.ts defines DiffResult interface"

if grep -q "interface DiffResult" "$PROJECT_ROOT/src/diff.ts"; then
    pass "DiffResult interface defined"
else
    fail "DiffResult interface should be defined"
fi

#------------------------------------------------------------------------------
# Test 11: DiffResult includes filesChanged
#------------------------------------------------------------------------------
echo "Test 11: DiffResult includes filesChanged"

if grep -A15 "interface DiffResult" "$PROJECT_ROOT/src/diff.ts" | grep -q "filesChanged"; then
    pass "DiffResult includes filesChanged"
else
    fail "DiffResult should include filesChanged"
fi

#------------------------------------------------------------------------------
# Test 12: DiffResult includes insertions
#------------------------------------------------------------------------------
echo "Test 12: DiffResult includes insertions"

if grep -A15 "interface DiffResult" "$PROJECT_ROOT/src/diff.ts" | grep -q "insertions"; then
    pass "DiffResult includes insertions"
else
    fail "DiffResult should include insertions"
fi

#------------------------------------------------------------------------------
# Test 13: DiffResult includes deletions
#------------------------------------------------------------------------------
echo "Test 13: DiffResult includes deletions"

if grep -A15 "interface DiffResult" "$PROJECT_ROOT/src/diff.ts" | grep -q "deletions"; then
    pass "DiffResult includes deletions"
else
    fail "DiffResult should include deletions"
fi

#------------------------------------------------------------------------------
# Test 14: DiffResult includes files array
#------------------------------------------------------------------------------
echo "Test 14: DiffResult includes files array"

if grep -A20 "interface DiffResult" "$PROJECT_ROOT/src/diff.ts" | grep -q "files:"; then
    pass "DiffResult includes files"
else
    fail "DiffResult should include files"
fi

#------------------------------------------------------------------------------
# Test 15: DiffResult includes commits array
#------------------------------------------------------------------------------
echo "Test 15: DiffResult includes commits array"

if grep -A20 "interface DiffResult" "$PROJECT_ROOT/src/diff.ts" | grep -q "commits:"; then
    pass "DiffResult includes commits"
else
    fail "DiffResult should include commits"
fi

#------------------------------------------------------------------------------
# Test 16: diff.ts defines FileChange interface
#------------------------------------------------------------------------------
echo "Test 16: diff.ts defines FileChange interface"

if grep -q "interface FileChange" "$PROJECT_ROOT/src/diff.ts"; then
    pass "FileChange interface defined"
else
    fail "FileChange interface should be defined"
fi

#------------------------------------------------------------------------------
# Test 17: FileChange includes file status
#------------------------------------------------------------------------------
echo "Test 17: FileChange includes file status"

if grep -A10 "interface FileChange" "$PROJECT_ROOT/src/diff.ts" | grep -q "status:"; then
    pass "FileChange includes status"
else
    fail "FileChange should include status"
fi

#------------------------------------------------------------------------------
# Test 18: diff.ts defines CommitInfo interface
#------------------------------------------------------------------------------
echo "Test 18: diff.ts defines CommitInfo interface"

if grep -q "interface CommitInfo" "$PROJECT_ROOT/src/diff.ts"; then
    pass "CommitInfo interface defined"
else
    fail "CommitInfo interface should be defined"
fi

#------------------------------------------------------------------------------
# Test 19: diff.ts has getCurrentBranch function
#------------------------------------------------------------------------------
echo "Test 19: diff.ts has getCurrentBranch function"

if grep -q "function getCurrentBranch" "$PROJECT_ROOT/src/diff.ts"; then
    pass "getCurrentBranch function exists"
else
    fail "getCurrentBranch function should exist"
fi

#------------------------------------------------------------------------------
# Test 20: diff.ts has extractIssueNumber function
#------------------------------------------------------------------------------
echo "Test 20: diff.ts has extractIssueNumber function"

if grep -q "function extractIssueNumber" "$PROJECT_ROOT/src/diff.ts"; then
    pass "extractIssueNumber function exists"
else
    fail "extractIssueNumber function should exist"
fi

#------------------------------------------------------------------------------
# Test 21: diff.ts has findBranchForIssue function
#------------------------------------------------------------------------------
echo "Test 21: diff.ts has findBranchForIssue function"

if grep -q "function findBranchForIssue" "$PROJECT_ROOT/src/diff.ts"; then
    pass "findBranchForIssue function exists"
else
    fail "findBranchForIssue function should exist"
fi

#------------------------------------------------------------------------------
# Test 22: diff.ts has getDiffStats function
#------------------------------------------------------------------------------
echo "Test 22: diff.ts has getDiffStats function"

if grep -q "function getDiffStats" "$PROJECT_ROOT/src/diff.ts"; then
    pass "getDiffStats function exists"
else
    fail "getDiffStats function should exist"
fi

#------------------------------------------------------------------------------
# Test 23: diff.ts has getChangedFiles function
#------------------------------------------------------------------------------
echo "Test 23: diff.ts has getChangedFiles function"

if grep -q "function getChangedFiles" "$PROJECT_ROOT/src/diff.ts"; then
    pass "getChangedFiles function exists"
else
    fail "getChangedFiles function should exist"
fi

#------------------------------------------------------------------------------
# Test 24: diff.ts has getCommits function
#------------------------------------------------------------------------------
echo "Test 24: diff.ts has getCommits function"

if grep -q "function getCommits" "$PROJECT_ROOT/src/diff.ts"; then
    pass "getCommits function exists"
else
    fail "getCommits function should exist"
fi

#------------------------------------------------------------------------------
# Test 25: diff.ts has getFullDiff function
#------------------------------------------------------------------------------
echo "Test 25: diff.ts has getFullDiff function"

if grep -q "function getFullDiff" "$PROJECT_ROOT/src/diff.ts"; then
    pass "getFullDiff function exists"
else
    fail "getFullDiff function should exist"
fi

#------------------------------------------------------------------------------
# Test 26: diff.ts has getPrDiff function
#------------------------------------------------------------------------------
echo "Test 26: diff.ts has getPrDiff function"

if grep -q "function getPrDiff" "$PROJECT_ROOT/src/diff.ts"; then
    pass "getPrDiff function exists"
else
    fail "getPrDiff function should exist for --pr option"
fi

#------------------------------------------------------------------------------
# Test 27: diff.ts has highlightDiff function
#------------------------------------------------------------------------------
echo "Test 27: diff.ts has highlightDiff function"

if grep -q "function highlightDiff" "$PROJECT_ROOT/src/diff.ts"; then
    pass "highlightDiff function exists"
else
    fail "highlightDiff function should exist for syntax highlighting"
fi

#------------------------------------------------------------------------------
# Test 28: diff.ts has findDiffTool function
#------------------------------------------------------------------------------
echo "Test 28: diff.ts has findDiffTool function"

if grep -q "function findDiffTool" "$PROJECT_ROOT/src/diff.ts"; then
    pass "findDiffTool function exists"
else
    fail "findDiffTool function should exist for external diff tool detection"
fi

#------------------------------------------------------------------------------
# Test 29: diff.ts supports delta diff tool
#------------------------------------------------------------------------------
echo "Test 29: diff.ts supports delta diff tool"

if grep -q "'delta'" "$PROJECT_ROOT/src/diff.ts"; then
    pass "Supports delta diff tool"
else
    fail "Should support delta diff tool"
fi

#------------------------------------------------------------------------------
# Test 30: diff.ts supports diff-so-fancy tool
#------------------------------------------------------------------------------
echo "Test 30: diff.ts supports diff-so-fancy tool"

if grep -q "'diff-so-fancy'" "$PROJECT_ROOT/src/diff.ts"; then
    pass "Supports diff-so-fancy tool"
else
    fail "Should support diff-so-fancy tool"
fi

#------------------------------------------------------------------------------
# Test 31: diff.ts has printStatView function
#------------------------------------------------------------------------------
echo "Test 31: diff.ts has printStatView function"

if grep -q "function printStatView" "$PROJECT_ROOT/src/diff.ts"; then
    pass "printStatView function exists"
else
    fail "printStatView function should exist for --stat option"
fi

#------------------------------------------------------------------------------
# Test 32: diff.ts has printFilesView function
#------------------------------------------------------------------------------
echo "Test 32: diff.ts has printFilesView function"

if grep -q "function printFilesView" "$PROJECT_ROOT/src/diff.ts"; then
    pass "printFilesView function exists"
else
    fail "printFilesView function should exist for --files option"
fi

#------------------------------------------------------------------------------
# Test 33: diff.ts has printFullDiff function
#------------------------------------------------------------------------------
echo "Test 33: diff.ts has printFullDiff function"

if grep -q "function printFullDiff" "$PROJECT_ROOT/src/diff.ts"; then
    pass "printFullDiff function exists"
else
    fail "printFullDiff function should exist"
fi

#------------------------------------------------------------------------------
# Test 34: diff.ts exports diff function
#------------------------------------------------------------------------------
echo "Test 34: diff.ts exports diff function"

if grep -q "export async function diff" "$PROJECT_ROOT/src/diff.ts"; then
    pass "diff function is exported"
else
    fail "diff function should be exported"
fi

#------------------------------------------------------------------------------
# Test 35: diff command has --config option
#------------------------------------------------------------------------------
echo "Test 35: diff command has --config option"

if grep -A15 "command('diff" "$PROJECT_ROOT/src/cli.ts" | grep -q "\-\-config"; then
    pass "--config option exists for diff command"
else
    fail "diff command should have --config option"
fi

#------------------------------------------------------------------------------
# Test 36: diff command has description
#------------------------------------------------------------------------------
echo "Test 36: diff command has description"

if grep -A2 "command('diff" "$PROJECT_ROOT/src/cli.ts" | grep -q "description"; then
    pass "diff command has description"
else
    fail "diff command should have a description"
fi

#------------------------------------------------------------------------------
# Test 37: diff.ts handles file status types
#------------------------------------------------------------------------------
echo "Test 37: diff.ts handles file status types (added/modified/deleted/renamed)"

if grep -q "'added' | 'modified' | 'deleted' | 'renamed'" "$PROJECT_ROOT/src/diff.ts"; then
    pass "Handles file status types"
else
    fail "Should handle file status types (added/modified/deleted/renamed)"
fi

#------------------------------------------------------------------------------
# Test 38: diff.ts reads branch config from chadgi-config.yaml
#------------------------------------------------------------------------------
echo "Test 38: diff.ts reads branch config"

if grep -q "parseYamlNested.*branch.*base" "$PROJECT_ROOT/src/diff.ts"; then
    pass "Reads branch base config"
else
    fail "Should read branch base config from chadgi-config.yaml"
fi

#------------------------------------------------------------------------------
# Test 39: diff.ts reads branch prefix from config
#------------------------------------------------------------------------------
echo "Test 39: diff.ts reads branch prefix from config"

if grep -q "parseYamlNested.*branch.*prefix" "$PROJECT_ROOT/src/diff.ts"; then
    pass "Reads branch prefix config"
else
    fail "Should read branch prefix config"
fi

#------------------------------------------------------------------------------
# Test 40: diff.ts can write diff to output file
#------------------------------------------------------------------------------
echo "Test 40: diff.ts can write diff to output file"

if grep -q "writeFileSync.*output" "$PROJECT_ROOT/src/diff.ts"; then
    pass "Supports writing diff to output file"
else
    fail "Should support writing diff to output file"
fi

#------------------------------------------------------------------------------
# Test 41: diff.ts uses git diff for comparisons
#------------------------------------------------------------------------------
echo "Test 41: diff.ts uses git diff for comparisons"

if grep -q "git diff" "$PROJECT_ROOT/src/diff.ts"; then
    pass "Uses git diff command"
else
    fail "Should use git diff for comparisons"
fi

#------------------------------------------------------------------------------
# Test 42: diff.ts uses gh cli for PR diffs
#------------------------------------------------------------------------------
echo "Test 42: diff.ts uses gh cli for PR diffs"

if grep -q "gh pr diff" "$PROJECT_ROOT/src/diff.ts"; then
    pass "Uses gh pr diff command"
else
    fail "Should use gh pr diff for PR diffs"
fi

#------------------------------------------------------------------------------
# Test 43: DiffOptions includes pr number option
#------------------------------------------------------------------------------
echo "Test 43: DiffOptions includes pr number option"

if grep -A10 "interface DiffOptions" "$PROJECT_ROOT/src/diff.ts" | grep -q "pr.*number"; then
    pass "DiffOptions includes pr option"
else
    fail "DiffOptions should include pr option"
fi

#------------------------------------------------------------------------------
# Test 44: DiffOptions includes output file option
#------------------------------------------------------------------------------
echo "Test 44: DiffOptions includes output file option"

if grep -A10 "interface DiffOptions" "$PROJECT_ROOT/src/diff.ts" | grep -q "output.*string"; then
    pass "DiffOptions includes output option"
else
    fail "DiffOptions should include output option"
fi

#------------------------------------------------------------------------------
# Test 45: DiffOptions includes stat option
#------------------------------------------------------------------------------
echo "Test 45: DiffOptions includes stat option"

if grep -A10 "interface DiffOptions" "$PROJECT_ROOT/src/diff.ts" | grep -q "stat.*boolean"; then
    pass "DiffOptions includes stat option"
else
    fail "DiffOptions should include stat option"
fi

#------------------------------------------------------------------------------
# Test 46: DiffOptions includes files option
#------------------------------------------------------------------------------
echo "Test 46: DiffOptions includes files option"

if grep -A10 "interface DiffOptions" "$PROJECT_ROOT/src/diff.ts" | grep -q "files.*boolean"; then
    pass "DiffOptions includes files option"
else
    fail "DiffOptions should include files option"
fi

#------------------------------------------------------------------------------
# Test 47: diff.ts has branchExists function
#------------------------------------------------------------------------------
echo "Test 47: diff.ts has branchExists function"

if grep -q "function branchExists" "$PROJECT_ROOT/src/diff.ts"; then
    pass "branchExists function exists"
else
    fail "branchExists function should exist"
fi

#------------------------------------------------------------------------------
# Test 48: diff.ts displays commit messages
#------------------------------------------------------------------------------
echo "Test 48: diff.ts displays commit messages"

if grep -q "commits:" "$PROJECT_ROOT/src/diff.ts" && grep -q "commit.message" "$PROJECT_ROOT/src/diff.ts"; then
    pass "Displays commit messages"
else
    fail "Should display commit messages"
fi

#------------------------------------------------------------------------------
# Test 49: diff.ts has parseFilesFromDiff function
#------------------------------------------------------------------------------
echo "Test 49: diff.ts has parseFilesFromDiff function"

if grep -q "function parseFilesFromDiff" "$PROJECT_ROOT/src/diff.ts"; then
    pass "parseFilesFromDiff function exists"
else
    fail "parseFilesFromDiff function should exist for PR diff parsing"
fi

#------------------------------------------------------------------------------
# Test 50: diff.ts has computeStatsFromFiles function
#------------------------------------------------------------------------------
echo "Test 50: diff.ts has computeStatsFromFiles function"

if grep -q "function computeStatsFromFiles" "$PROJECT_ROOT/src/diff.ts"; then
    pass "computeStatsFromFiles function exists"
else
    fail "computeStatsFromFiles function should exist"
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

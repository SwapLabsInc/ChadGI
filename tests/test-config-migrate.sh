#!/bin/bash
#
# Integration test for chadgi config migrate command
#

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Get script directory to reference local chadgi
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CHADGI="node $PROJECT_DIR/dist/cli.js"

# Create a temporary test directory
TEST_DIR=$(mktemp -d)
CHADGI_DIR="$TEST_DIR/.chadgi"

# Cleanup function
cleanup() {
  rm -rf "$TEST_DIR"
}
trap cleanup EXIT

# Helper function to run tests
run_test() {
  local test_name="$1"
  local test_fn="$2"

  echo -e "${YELLOW}Running: $test_name${NC}"

  if $test_fn; then
    echo -e "${GREEN}PASSED: $test_name${NC}\n"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}FAILED: $test_name${NC}\n"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
}

# Setup function - creates a fresh test directory
setup_test_env() {
  rm -rf "$CHADGI_DIR"
  mkdir -p "$CHADGI_DIR"
}

# Test: Migrate command shows preview for config without version
test_migrate_preview_no_version() {
  setup_test_env

  # Create config without version
  cat > "$CHADGI_DIR/chadgi-config.yaml" << 'EOF'
github:
  repo: test/repo
  project_number: 1
branch:
  base: main
  prefix: feature/issue-
iteration:
  max_iterations: 5
EOF

  # Run migrate with dry-run
  output=$(cd "$TEST_DIR" && $CHADGI config migrate --dry-run 2>&1) || true

  # Check output
  if echo "$output" | grep -q "1.0 (implicit)"; then
    if echo "$output" | grep -q "1.1"; then
      if echo "$output" | grep -q "Dry run mode"; then
        return 0
      fi
    fi
  fi
  echo "Output: $output"
  return 1
}

# Test: Migrate command applies migration with --yes flag
test_migrate_apply_with_yes() {
  setup_test_env

  # Create config without version
  cat > "$CHADGI_DIR/chadgi-config.yaml" << 'EOF'
github:
  repo: test/repo
  project_number: 1
branch:
  base: main
  prefix: feature/issue-
iteration:
  max_iterations: 5
EOF

  # Run migrate with --yes
  output=$(cd "$TEST_DIR" && $CHADGI config migrate --yes 2>&1) || true

  # Check that migration completed
  if echo "$output" | grep -q "Migration completed successfully"; then
    # Check that config now has version
    if grep -q "config_version" "$CHADGI_DIR/chadgi-config.yaml"; then
      # Check backup was created
      if [ -d "$CHADGI_DIR/config-backups" ]; then
        return 0
      fi
    fi
  fi
  echo "Output: $output"
  return 1
}

# Test: Migrate command shows "up to date" for current version
test_migrate_up_to_date() {
  setup_test_env

  # Create config with current version
  cat > "$CHADGI_DIR/chadgi-config.yaml" << 'EOF'
config_version: "1.1"
github:
  repo: test/repo
  project_number: 1
branch:
  base: main
  prefix: feature/issue-
iteration:
  max_iterations: 5
EOF

  # Run migrate
  output=$(cd "$TEST_DIR" && $CHADGI config migrate 2>&1) || true

  # Check that it reports up to date
  if echo "$output" | grep -q "already up to date"; then
    return 0
  fi
  echo "Output: $output"
  return 1
}

# Test: Migrate command creates backup before migration
test_migrate_creates_backup() {
  setup_test_env

  # Create config without version
  cat > "$CHADGI_DIR/chadgi-config.yaml" << 'EOF'
github:
  repo: test/repo
  project_number: 1
branch:
  base: main
  prefix: feature/issue-
iteration:
  max_iterations: 5
EOF

  # Run migrate with --yes
  cd "$TEST_DIR" && $CHADGI config migrate --yes >/dev/null 2>&1 || true

  # Check backup directory exists and has files
  if [ -d "$CHADGI_DIR/config-backups" ]; then
    backup_count=$(ls -1 "$CHADGI_DIR/config-backups" 2>/dev/null | wc -l)
    if [ "$backup_count" -gt 0 ]; then
      return 0
    fi
  fi
  return 1
}

# Test: Migrate --rollback restores from backup
test_migrate_rollback() {
  setup_test_env

  # Create original config
  cat > "$CHADGI_DIR/chadgi-config.yaml" << 'EOF'
github:
  repo: original/repo
  project_number: 1
branch:
  base: main
  prefix: feature/issue-
iteration:
  max_iterations: 5
EOF

  # Run migrate to create a backup
  cd "$TEST_DIR" && $CHADGI config migrate --yes >/dev/null 2>&1 || true

  # Modify the config
  cat > "$CHADGI_DIR/chadgi-config.yaml" << 'EOF'
config_version: "1.1"
github:
  repo: modified/repo
  project_number: 99
branch:
  base: develop
  prefix: feat/
iteration:
  max_iterations: 10
EOF

  # Run rollback
  output=$(cd "$TEST_DIR" && $CHADGI config migrate --rollback --yes 2>&1) || true

  # Check that config was restored
  if grep -q "original/repo" "$CHADGI_DIR/chadgi-config.yaml"; then
    return 0
  fi
  echo "Output: $output"
  return 1
}

# Test: Migration history is recorded
test_migrate_records_history() {
  setup_test_env

  # Create config without version
  cat > "$CHADGI_DIR/chadgi-config.yaml" << 'EOF'
github:
  repo: test/repo
  project_number: 1
branch:
  base: main
  prefix: feature/issue-
iteration:
  max_iterations: 5
EOF

  # Run migrate with --yes
  cd "$TEST_DIR" && $CHADGI config migrate --yes >/dev/null 2>&1 || true

  # Check migration history file exists
  if [ -f "$CHADGI_DIR/migration-history.json" ]; then
    if grep -q '"fromVersion"' "$CHADGI_DIR/migration-history.json"; then
      if grep -q '"success":true' "$CHADGI_DIR/migration-history.json" || grep -q '"success": true' "$CHADGI_DIR/migration-history.json"; then
        return 0
      fi
    fi
  fi
  return 1
}

# Test: Config history command shows migration history
test_config_history() {
  setup_test_env

  # Create config without version
  cat > "$CHADGI_DIR/chadgi-config.yaml" << 'EOF'
github:
  repo: test/repo
  project_number: 1
branch:
  base: main
  prefix: feature/issue-
iteration:
  max_iterations: 5
EOF

  # Run migrate to create history
  cd "$TEST_DIR" && $CHADGI config migrate --yes >/dev/null 2>&1 || true

  # Run config history
  output=$(cd "$TEST_DIR" && $CHADGI config history 2>&1) || true

  # Check output contains history info
  if echo "$output" | grep -q "Migration History"; then
    return 0
  fi
  echo "Output: $output"
  return 1
}

# Test: Validate shows migration warning for old config
test_validate_shows_migration_warning() {
  setup_test_env

  # Create templates (required for validate)
  cat > "$CHADGI_DIR/chadgi-task.md" << 'EOF'
# Task Template
{{ISSUE_TITLE}}
EOF
  cat > "$CHADGI_DIR/chadgi-generate-task.md" << 'EOF'
# Generate Template
{{REPO}}
EOF

  # Create config without version
  cat > "$CHADGI_DIR/chadgi-config.yaml" << 'EOF'
github:
  repo: test/repo
  project_number: 1
branch:
  base: main
  prefix: feature/issue-
iteration:
  max_iterations: 5
EOF

  # Run validate
  output=$(cd "$TEST_DIR" && $CHADGI validate 2>&1) || true

  # Check that it shows migration available
  if echo "$output" | grep -q "migration available"; then
    return 0
  fi
  echo "Output: $output"
  return 1
}

# Main test runner
echo "========================================"
echo "ChadGI Config Migrate Integration Tests"
echo "========================================"
echo ""
echo "Test directory: $TEST_DIR"
echo ""

# Run all tests
run_test "Migrate preview for config without version" test_migrate_preview_no_version
run_test "Migrate applies migration with --yes flag" test_migrate_apply_with_yes
run_test "Migrate shows 'up to date' for current version" test_migrate_up_to_date
run_test "Migrate creates backup before migration" test_migrate_creates_backup
run_test "Migrate --rollback restores from backup" test_migrate_rollback
run_test "Migration history is recorded" test_migrate_records_history
run_test "Config history command shows migration history" test_config_history
run_test "Validate shows migration warning for old config" test_validate_shows_migration_warning

# Summary
echo "========================================"
echo "Test Results"
echo "========================================"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -gt 0 ]; then
  exit 1
fi

exit 0

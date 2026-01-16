/**
 * Test fixtures for configuration files.
 *
 * Provides sample YAML configuration content for testing.
 */

export const validConfig = `# ChadGI Configuration
task_source: github-issues

# Template files
prompt_template: ./chadgi-task.md
generate_template: ./chadgi-generate-task.md
progress_file: ./chadgi-progress.json

# GitHub configuration
github:
  repo: SwapLabsInc/ChadGI
  project_number: 7
  ready_column: Ready
  in_progress_column: In Progress
  review_column: In Review
  done_column: Done

# Branch configuration
branch:
  base: main
  prefix: feature/issue-

# Polling settings
poll_interval: 10
consecutive_empty_threshold: 2
on_empty_queue: generate

# Iteration settings
iteration:
  max_iterations: 5
  completion_promise: "COMPLETE"
  ready_promise: "READY_FOR_PR"
  test_command: "npm test"
  build_command: "npm run build"
  on_max_iterations: skip
  gigachad_mode: false

# Output settings
output:
  show_tool_details: true
  show_cost: true
  truncate_length: 60

# Budget limits
budget:
  per_task_limit: 2.00
  per_session_limit: 20.00
  on_task_budget_exceeded: skip
  on_session_budget_exceeded: stop
  warning_threshold: 80
`;

export const minimalConfig = `# Minimal ChadGI Configuration
github:
  repo: owner/repo
  project_number: 1
  ready_column: Ready
`;

export const configWithPriority = `# ChadGI Configuration with Priority
github:
  repo: SwapLabsInc/ChadGI
  project_number: 7
  ready_column: Ready

priority:
  enabled: true
  labels:
    critical: [priority:critical, p0, urgent]
    high: [priority:high, p1]
    normal: [priority:normal, p2]
    low: [priority:low, p3]
`;

export const configWithDependencies = `# ChadGI Configuration with Dependencies
github:
  repo: SwapLabsInc/ChadGI
  project_number: 7
  ready_column: Ready
  done_column: Done

dependencies:
  enabled: true
  skip_blocked: true

dependency_patterns: depends on blocked by requires
`;

export const configWithCategory = `# ChadGI Configuration with Category
github:
  repo: SwapLabsInc/ChadGI
  project_number: 7
  ready_column: Ready

category:
  mappings:
    bug: [bug, bugfix, fix]
    feature: [feature, enhancement]
    refactor: [refactor, cleanup]
`;

export const configWithInheritance = `# ChadGI Configuration with Inheritance
extends: ./base-config.yaml

github:
  project_number: 9

iteration:
  max_iterations: 10
`;

export const baseConfig = `# Base ChadGI Configuration
github:
  repo: SwapLabsInc/ChadGI
  project_number: 7
  ready_column: Ready

iteration:
  max_iterations: 5
`;

export const configWithCustomVariables = `# ChadGI Configuration with Custom Variables
github:
  repo: SwapLabsInc/ChadGI
  project_number: 7

custom_template_variables:
  - CUSTOM_VAR_ONE
  - CUSTOM_VAR_TWO
`;

export const invalidConfigMissingRepo = `# Invalid Config - Missing Repo
github:
  project_number: 7
  ready_column: Ready
`;

export const taskTemplate = `# Task Template
Issue: #{{ISSUE_NUMBER}}
Title: {{ISSUE_TITLE}}
URL: {{ISSUE_URL}}
Branch: {{BRANCH_NAME}}
Base: {{BASE_BRANCH}}
Repo: {{REPO}}
`;

export const taskTemplateWithUnknownVars = `# Task Template with Unknown Variables
Issue: #{{ISSUE_NUMBER}}
Custom: {{UNKNOWN_VARIABLE}}
Another: {{ANOTHER_UNKNOWN}}
`;

export const configWithModels = `# ChadGI Configuration with Models
github:
  repo: SwapLabsInc/ChadGI
  project_number: 7
  ready_column: Ready

models:
  default: claude-sonnet-4-20250514
  by_category:
    bug: claude-3-haiku-20240307
    feature: claude-3-opus-20240229
    refactor: claude-3-5-sonnet-20241022
    docs: claude-3-haiku-20240307
    test: claude-sonnet-4-20250514
    chore: claude-3-haiku-20240307
`;

export const configWithPartialModels = `# ChadGI Configuration with Partial Models
github:
  repo: owner/repo
  project_number: 1
  ready_column: Ready

models:
  default: claude-sonnet-4-20250514
  by_category:
    bug: claude-3-haiku-20240307
    feature: claude-3-opus-20240229
`;

export const configWithInvalidModels = `# ChadGI Configuration with Invalid Models
github:
  repo: owner/repo
  project_number: 1
  ready_column: Ready

models:
  default: invalid-model-name
  by_category:
    bug: not-a-real-model
`;

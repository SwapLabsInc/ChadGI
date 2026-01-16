# ChadGI

<p align="center">
  <img src="chad-gi.jpeg" alt="ChadGI" width="400">
</p>

<p align="center"><em>Chad does what Chad wants.</em></p>

> Autonomous Task Worker powered by Claude Code

ChadGI is a CLI tool that runs Claude Code in a continuous loop to automatically work through tasks from a GitHub Project board. It's designed for transparency - you can watch it work in real-time and stop it at any moment.

## Features

- Pulls tasks from GitHub Project board's "Ready" column
- Two-phase workflow: Implementation, then PR creation (only after tests pass)
- Rich streaming output showing tool calls with details
- Configurable via YAML with customizable templates
- Progress tracking with session resume capability
- Automatic task generation when queue is empty

## Quick Start

```bash
# Install globally
npm install -g chadgi

# Initialize in your project
cd your-project
chadgi init

# Edit configuration
edit .chadgi/chadgi-config.yaml

# Validate setup
chadgi validate

# Start the automation loop
chadgi start
```

## Prerequisites

Before using ChadGI, ensure you have the following installed:

| Tool | Purpose | Installation |
|------|---------|--------------|
| **Claude Code CLI** | AI agent for task execution | [Install Claude Code](https://claude.ai/claude-code) |
| **GitHub CLI (gh)** | GitHub API interactions | `brew install gh` or [GitHub CLI](https://cli.github.com/) |
| **jq** | JSON parsing | `brew install jq` or `apt install jq` |
| **git** | Version control | Usually pre-installed |

Verify your setup:

```bash
claude --version
gh auth status
jq --version
git --version
```

## CLI Commands

### `chadgi init`

Creates a `.chadgi/` directory with configuration and template files.

```bash
chadgi init           # Initialize ChadGI
chadgi init --force   # Overwrite existing files
```

Creates:
- `.chadgi/chadgi-config.yaml` - Main configuration
- `.chadgi/chadgi-task.md` - Task prompt template
- `.chadgi/chadgi-generate-task.md` - Task generation template
- `.chadgi/.gitignore` - Ignores progress file

### `chadgi setup-project`

Creates a GitHub Project v2 with the required Status field.

```bash
chadgi setup-project                      # Auto-detect repo
chadgi setup-project --repo owner/repo    # Specify repo
chadgi setup-project --name "My Tasks"    # Custom project name
```

**Note:** You may need to manually add Status field options via the GitHub web interface if they don't exist.

### `chadgi validate`

Checks dependencies and configuration.

```bash
chadgi validate                          # Check default config
chadgi validate --config /path/to/config # Check specific config
```

### `chadgi start`

Starts the automation loop.

```bash
chadgi start                             # Use default config
chadgi start --config /path/to/config    # Use specific config
```

Press `Ctrl+C` to stop gracefully.

### `chadgi watch`

Monitor a running ChadGI session in real-time from another terminal.

```bash
chadgi watch                             # Live dashboard with auto-refresh
chadgi watch --once                      # Show current status without auto-refresh
chadgi watch --json --once               # Output machine-readable JSON status
chadgi watch --interval 5000             # Refresh every 5 seconds (default: 2000ms)
```

Example live dashboard:
```
==========================================================
                  CHADGI WATCH
==========================================================
Status: RUNNING /

Phase:  [CODE] IMPLEMENTATION

CURRENT TASK
  Issue:   #42
  Title:   Add user authentication
  Branch:  feature/issue-42-add-user-auth
  Elapsed: 5m 23s

ITERATION
  [######--------------] 2/5
  Retries remaining: 3

SESSION STATS
  Duration:  1h 23m 45s
  Completed: 3 task(s)
  Cost:      $0.4521

Last updated: 1/15/2026, 10:30:45 AM
Press Ctrl+C to exit
```

The watch command is useful for:
- Monitoring long-running sessions from another terminal
- Running ChadGI on remote servers or in detached mode
- Building external dashboards with `--json --once`
- Quick status checks without interrupting the main process

### `chadgi queue`

View and manage the task queue before running ChadGI.

```bash
chadgi queue                             # List tasks in Ready column
chadgi queue list                        # Same as above (list is default)
chadgi queue --json                      # Output as JSON
chadgi queue --limit 5                   # Show only first 5 tasks
chadgi queue skip 123                    # Move issue #123 back to Backlog
chadgi queue promote 456                 # Move issue #456 to front of queue
```

Example output:
```
ChadGI Task Queue
=================
Ready column: 5 tasks

 #   Issue   Priority   Category   Title                          Status
--------------------------------------------------------------------------------
 1   #101    critical   feature    Add user authentication
 2   #102    high       bug        Fix login timeout issue
 3   #103    normal     refactor   Consolidate API handlers       blocked by #99
 4   #104    normal     bug        Handle null pointer in parser  deps resolved
 5   #105    low        feature    Add dark mode support

Commands:
  chadgi queue skip <issue-number>      Move task to Backlog
  chadgi queue promote <issue-number>   Move task to front
  chadgi start                          Process queue
```

**Note:** The `skip` command requires a "Backlog" column in your project board. The `promote` command requires priority ordering to be enabled in your config.

### `chadgi history`

View task execution history with filtering and export options.

```bash
chadgi history                           # Show last 10 tasks
chadgi history --limit 50                # Show more entries
chadgi history --since 7d                # Tasks from last 7 days
chadgi history --since 2024-01-01        # Tasks since specific date
chadgi history --status failed           # Only show failed tasks
chadgi history --since 7d --status failed  # Combine filters
chadgi history --json                    # Machine-readable output
```

Example output:
```
==========================================================
                  CHADGI TASK HISTORY
==========================================================

Showing 10 of 45 total tasks

Summary
  Success: 8
  Failed:  2
  Total Time: 1h 23m 45s
  Total Cost: $0.8234

Task History
──────────────────────────────────────────────────────────────────────────────
#42 [SUCCESS]
  Add user authentication system
  Date:    Jan 15, 2026, 10:30:45 AM
  Elapsed: 12m 34s
  Cost:    $0.1234
  PR: https://github.com/owner/repo/pull/43
──────────────────────────────────────────────────────────────────────────────
#41 [FAILED]
  Fix database connection timeout
  Date:    Jan 15, 2026, 10:15:23 AM
  Elapsed: 8m 12s
  Reason: Build verification failed
──────────────────────────────────────────────────────────────────────────────
```

Supported time formats for `--since`:
- Relative: `7d` (days), `2w` (weeks), `1m` (months), `24h` (hours)
- Absolute: `2024-01-01` (ISO date format)

## Configuration

### Configuration File (`chadgi-config.yaml`)

```yaml
# Task source - where to get tasks from
task_source: github-issues

# Template files (relative to .chadgi directory)
prompt_template: ./chadgi-task.md
generate_template: ./chadgi-generate-task.md
progress_file: ./chadgi-progress.json

# GitHub configuration
github:
  repo: owner/repo
  project_number: 1
  # Column names must match exactly (case-sensitive)
  ready_column: Ready
  in_progress_column: In progress
  review_column: In review
  done_column: Done  # Used when gigachad_mode is enabled

# Branch configuration
branch:
  base: main
  prefix: feature/issue-

# Polling settings
poll_interval: 10
consecutive_empty_threshold: 2

# What to do when queue is empty: generate, wait, exit
on_empty_queue: generate

# Iteration settings
iteration:
  max_iterations: 5
  completion_promise: "COMPLETE"
  ready_promise: "READY_FOR_PR"
  test_command: "npm test"
  build_command: "npm run build"
  on_max_iterations: skip
  gigachad_mode: false  # Auto-merge PRs without human review

# Output settings
output:
  show_tool_details: true
  show_cost: true
  truncate_length: 60
```

### Template Variables

Templates support these variables:

| Variable | Description |
|----------|-------------|
| `{{ISSUE_NUMBER}}` | GitHub issue number |
| `{{ISSUE_TITLE}}` | Issue title |
| `{{ISSUE_URL}}` | Full issue URL |
| `{{ISSUE_BODY}}` | Issue description |
| `{{BRANCH_NAME}}` | Created branch name |
| `{{BASE_BRANCH}}` | Base branch (e.g., main) |
| `{{REPO}}` | Repository (owner/repo) |
| `{{REPO_OWNER}}` | Repository owner |
| `{{PROJECT_NUMBER}}` | Project number |
| `{{READY_COLUMN}}` | Ready column name |
| `{{COMPLETION_PROMISE}}` | Completion signal string |
| `{{TEST_COMMAND}}` | Configured test command |
| `{{BUILD_COMMAND}}` | Configured build command |

## GitHub Project Setup

ChadGI uses GitHub Projects v2 to manage tasks. You need a project with a Status field that has these options:

- **Ready** - Tasks waiting to be picked up
- **In progress** - Task currently being worked on
- **In review** - PR created, awaiting review
- **Done** - (Optional) Task completed via GigaChad Mode auto-merge

### Option 1: Automatic Setup

```bash
chadgi setup-project --repo owner/repo
```

This creates the project but you may need to manually add Status options.

### Option 2: Manual Setup

1. Go to your GitHub profile or organization
2. Click "Projects" tab
3. Click "New project" -> "Board"
4. Name your project (e.g., "ChadGI Tasks")
5. In the project settings, configure the Status field with options:
   - Ready
   - In progress
   - In review
   - Done (if using GigaChad Mode)
6. Note the project number from the URL

### Adding Tasks

Add issues to the project and move them to the "Ready" column:

```bash
# Using GitHub CLI
gh issue create --repo owner/repo --title "Add dark mode" --body "Description..."
gh project item-add PROJECT_NUMBER --owner OWNER --url ISSUE_URL
# Then move to "Ready" column in the GitHub web interface
```

Or use the GitHub web interface to create issues and add them to the project.

## Workflow

```
+-------------------------------------------------------------+
|                       CHADGI WORKFLOW                       |
+-------------------------------------------------------------+
|                                                             |
|   +-----------+                                             |
|   |   Ready   | <--- Finds tasks in "Ready" column          |
|   +-----+-----+                                             |
|         |                                                   |
|         v                                                   |
|  +-------------+                                            |
|  | In Progress | <--- Updates board, starts working         |
|  +------+------+                                            |
|         |                                                   |
|         v                                                   |
|   +---------------------+                                   |
|   | PHASE 1: IMPLEMENT  | <--- Claude implements & commits  |
|   |   (no PR yet)       |      Outputs: READY_FOR_PR        |
|   +----------+----------+                                   |
|              |                                              |
|              v                                              |
|   +---------------------+                                   |
|   | VERIFY: Test/Build  | <--- Runs configured test/build   |
|   +----------+----------+                                   |
|              |                                              |
|         Pass |  Fail --> Iterate (back to Phase 1)          |
|              v                                              |
|   +---------------------+                                   |
|   | PHASE 2: CREATE PR  | <--- Claude creates PR            |
|   |                     |      Outputs: COMPLETE            |
|   +----------+----------+                                   |
|              |                                              |
|              v                                              |
|   +------------+                                            |
|   |  In Review | <--- Updates board, PR ready               |
|   +-----+------+                                            |
|         |                                                   |
|         v                                                   |
|   Queue empty? --Yes--> Generate new tasks (optional)       |
|         |                                                   |
|         No                                                  |
|         |                                                   |
|         +-----------------> Loop to next task               |
+-------------------------------------------------------------+
```

### Two-Phase Workflow

ChadGI ensures tests pass **before** creating a PR:

**Phase 1: Implementation**
1. Claude implements the feature/fix
2. Claude runs tests locally
3. Claude commits changes
4. Claude outputs `<promise>READY_FOR_PR</promise>`

**Verification**
- ChadGI runs `test_command` and `build_command`
- If verification fails, Claude iterates to fix issues
- Only proceeds to Phase 2 when verification passes

**Phase 2: PR Creation**
1. ChadGI confirms tests passed
2. Claude pushes branch and creates PR
3. Claude outputs `<promise>COMPLETE</promise>`

### GigaChad Mode

For the truly fearless, **GigaChad Mode** bypasses human review entirely:

```yaml
iteration:
  gigachad_mode: true
```

When enabled, after PR creation:
1. ChadGI automatically merges the PR into the target branch (squash merge)
2. Pulls the latest changes locally to prevent merge conflicts on next task
3. Moves the ticket directly to the "Done" column (not "In Review")

**This is Chad-level confidence.** Only enable if:
- You have comprehensive test coverage
- You trust your CI/CD pipeline
- You're comfortable with autonomous deployments
- You want maximum velocity

To use GigaChad Mode, you'll also need a "Done" column in your project board:
```yaml
github:
  done_column: Done
```

#### Commit Prefix for Rollbacks

Auto-merged commits are prefixed with `[GIGACHAD]` by default, making it easy to identify autonomous merges in your git history:

```
[GIGACHAD] feat: add user authentication
[GIGACHAD] fix: resolve database connection issue
feat: manual human-reviewed commit
```

To rollback to the last human-approved commit:
```bash
# Find the last non-GigaChad commit
git log --oneline | grep -v "^\[GIGACHAD\]" | head -1

# Or reset to before GigaChad started
git log --oneline --all | grep -v GIGACHAD
```

Customize the prefix in your config:
```yaml
iteration:
  gigachad_commit_prefix: "[AUTO]"  # Or "[BOT]", "🤖", etc.
```

## Safety Notes

**ChadGI runs Claude Code with `--dangerously-skip-permissions`**

This means Claude Code will:
- Execute commands without confirmation
- Create/modify/delete files automatically
- Push code to GitHub
- Create Pull Requests
- Create GitHub issues (when generating tasks)
- **With GigaChad Mode:** Auto-merge PRs without human review

**Recommended safeguards:**
1. Run in a dedicated terminal you can monitor
2. Have your repository backed up
3. Review PRs before merging (unless using GigaChad Mode)
4. Use a test repository first
5. Set higher `poll_interval` for more review time
6. **Avoid GigaChad Mode on production repositories without comprehensive tests**

## Troubleshooting

### "No tasks found in 'Ready' column"
- Add issues to your project and move them to "Ready"
- Verify column names match exactly (case-sensitive)
- Wait for task generation if `on_empty_queue: generate`

### "Could not find project #N"
- Check the project number in your config
- Ensure GitHub CLI has project scope: `gh auth refresh -s project`

### Config file not loading
- Ensure you ran `chadgi init`
- Check path: `./.chadgi/chadgi-config.yaml`
- Use `--config` flag to specify custom path

### Template not found
- Templates should be in the `.chadgi/` directory
- Paths are relative to the config file location

### "gh auth" errors
- Re-authenticate: `gh auth login`
- Add project scope: `gh auth refresh -s project`

### Progress file shows interrupted session
- Check the branch and issue mentioned
- The previous task may be partially complete
- ChadGI will continue from where it left off

## License

MIT

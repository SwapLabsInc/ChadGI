# Task: {{ISSUE_TITLE}}

*{{CHAD_TAGLINE}}*

You are working on GitHub issue #{{ISSUE_NUMBER}} from the {{REPO}} repository.

> **IMPORTANT - TWO-PHASE WORKFLOW:**
>
> **Phase 1: Implementation** - Implement, test locally, commit. Do NOT create a PR yet.
> When implementation is complete and tests pass locally, output:
> `<promise>READY_FOR_PR</promise>`
>
> **Phase 2: PR Creation** - After verification passes, you'll be asked to create the PR.
> After creating the PR, output: `<promise>{{COMPLETION_PROMISE}}</promise>`

## Required Reading (Do This First!)

Before starting, read the project README and any relevant documentation to understand the architecture.

## Issue Details

**Title:** {{ISSUE_TITLE}}
**URL:** {{ISSUE_URL}}
**Branch:** {{BRANCH_NAME}}

## Description

{{ISSUE_BODY}}

## Instructions

You are already on a fresh branch: **{{BRANCH_NAME}}** (created from {{BASE_BRANCH}})

### Phase 1: Implementation (Do This Now)

1. **Understand** - Read and understand the issue requirements thoroughly
2. **Explore** - Examine the codebase to understand context and patterns
3. **Implement** - Make the requested changes following existing code style
4. **Simplify** - Look for opportunities to REMOVE or consolidate code:
   - Can any existing code be deleted as part of this change?
   - Are there redundant patterns that can be unified?
   - Is there dead code nearby that should be cleaned up?
5. **Write Tests** - Add/update tests for any functionality changes
6. **Update README** - If your changes affect usage, CLI options, or features, update README.md
7. **Test Locally** - Run the verification commands below to confirm your changes work
8. **Commit** - Commit changes with clear, descriptive messages (use conventional commits: fix:, feat:, etc.)

**Verification Commands** (run these before signaling ready):
- Test: `{{TEST_COMMAND}}` *(if empty, discover from package.json or project config)*
- Build: `{{BUILD_COMMAND}}` *(if empty, discover from package.json or project config)*

**DO NOT create a Pull Request yet.** The automated system will verify your changes first.

### Before Signaling Ready (Required Self-Review)

**STOP.** Before outputting READY_FOR_PR, you MUST complete the checklist below.

Output this exact format with your answers filled in:

```
## Pre-PR Checklist

### 1. Tests Added/Updated
Files: [list test files you created/modified, or "N/A - no testable changes"]

### 2. README Updated
Updated: [yes - describe what / no - explain why not needed]

### 3. Code Simplified
Removed/consolidated: [list what you removed or "N/A - no opportunities found"]

### 4. Requirements Verification
- [ ] Requirement 1: [quote from issue] -> [where implemented]
- [ ] Requirement 2: [quote from issue] -> [where implemented]
(list ALL requirements from the issue above)

### 5. Test Results
Command: [your test command]
Result: [PASS/FAIL - if FAIL, fix before continuing]

### 6. Self-Review
Diff reviewed: [yes/no]
Issue found: [describe one thing or "none"]
Fixed: [yes/not applicable]
```

**Only after completing this checklist with all items passing**, output:

<promise>READY_FOR_PR</promise>

### Phase 2: PR Creation (Wait For Instructions)

After the automated verification passes, you will receive instructions to create the PR.

## Important Guidelines

- Follow existing code style and patterns
- **Always add tests** for new functionality - never rely solely on existing tests passing
- If you encounter blockers, make reasonable decisions and document them
- Keep changes focused on the issue scope
- **Do NOT skip ahead to PR creation** - wait for the verification step

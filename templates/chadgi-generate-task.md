# Generate New Tasks

You are analyzing the {{REPO}} repository to suggest 2-3 new improvement tasks.

**IMPORTANT:** You are on the {{BASE_BRANCH}} branch. Analyze the current production code.

## Required Reading (Do This First!)

Before suggesting tasks, read the project README and any architecture documentation to understand the product.

## Existing Tasks (DO NOT DUPLICATE)

These tasks already exist in the project board or have been completed:
{{EXISTING_ISSUES}}

## Your Task

1. **Explore** - Examine the codebase to understand its structure and purpose
2. **Identify** - Find 2-3 valuable improvements, features, or fixes that are NOT in the list above
3. **Create & Queue** - Create GitHub issues and add them to the Ready column

## Issue Creation Process

For EACH task, run these commands in sequence:

```bash
# Step 1: Create the issue and capture the URL
ISSUE_URL=$(gh issue create --repo {{REPO}} --title "<title>" --body "<body>" | grep -o 'https://[^ ]*')
echo "Created: $ISSUE_URL"

# Step 2: Add to project board and get the item ID
ITEM_ID=$(gh project item-add {{PROJECT_NUMBER}} --owner {{REPO_OWNER}} --url "$ISSUE_URL" --format json | jq -r '.id')
echo "Item ID: $ITEM_ID"

# Step 3: Get the project and field IDs needed for moving
PROJECT_ID=$(gh project list --owner {{REPO_OWNER}} --format json | jq -r '.projects[] | select(.number == {{PROJECT_NUMBER}}) | .id')
FIELD_DATA=$(gh project field-list {{PROJECT_NUMBER}} --owner {{REPO_OWNER}} --format json)
STATUS_FIELD_ID=$(echo "$FIELD_DATA" | jq -r '.fields[] | select(.name == "Status") | .id')
READY_OPTION_ID=$(echo "$FIELD_DATA" | jq -r '.fields[] | select(.name == "Status") | .options[] | select(.name == "{{READY_COLUMN}}") | .id')

# Step 4: Move to Ready column
gh project item-edit --project-id "$PROJECT_ID" --id "$ITEM_ID" --field-id "$STATUS_FIELD_ID" --single-select-option-id "$READY_OPTION_ID"
echo "Moved to {{READY_COLUMN}}"
```

**Critical:** Issues left in Backlog will NOT be picked up. You MUST complete all 4 steps for each issue.

### Issue Format

Each issue description should include:

**Problem/Opportunity**
What problem does this solve or what value does it add?

**Requirements**
- Specific acceptance criteria (bullet points)
- Clear definition of done

**Technical Notes**
- Implementation hints
- Relevant files or areas of the codebase

## Focus Areas

Consider improvements in these areas:
- Code quality and maintainability
- Missing features that add value
- Performance optimizations
- Developer experience
- Documentation gaps
- Test coverage

## Constraints

- DO NOT suggest anything similar to existing tasks listed above
- Create exactly 2-3 issues, no more, no less
- Make issues specific and actionable
- Each issue should be completable in a single session

# Unified JSON Response Schema

This document describes the unified JSON response format for ChadGI commands, designed for consistent machine-readable output.

## Overview

ChadGI commands that support JSON output (`--json` flag) can optionally use a unified response wrapper format. This format provides:

- Consistent structure across all commands
- Error information with machine-readable codes
- Pagination metadata for list responses
- Runtime metrics for debugging

## Enabling Unified Format

The unified format is **opt-in** for backwards compatibility. Enable it using:

```bash
# Option 1: Environment variable
export CHADGI_JSON_UNIFIED=1
chadgi queue --json

# Option 2: Command-line flag (where supported)
chadgi status --json --json-unified
```

## Response Structure

### Success Response

```json
{
  "success": true,
  "data": {
    // Command-specific response data
  },
  "meta": {
    "timestamp": "2026-01-15T10:30:00.000Z",
    "version": "1.0.5",
    "command": "queue",
    "runtime_ms": 123
  },
  "pagination": {
    "total": 100,
    "filtered": 50,
    "limit": 10,
    "offset": 0
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "CONFIG_NOT_FOUND",
    "message": "Configuration file not found at .chadgi/chadgi-config.yaml",
    "details": {
      // Optional additional context
    }
  },
  "meta": {
    "timestamp": "2026-01-15T10:30:00.000Z",
    "version": "1.0.5",
    "command": "validate",
    "runtime_ms": 45
  }
}
```

## Field Definitions

### Root Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `success` | boolean | Yes | Whether the operation succeeded |
| `data` | object | On success | The response payload |
| `error` | object | On failure | Error information |
| `meta` | object | Yes | Execution metadata |
| `pagination` | object | For lists | Pagination information |

### Meta Object

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO 8601 timestamp when response was generated |
| `version` | string | ChadGI version (e.g., "1.0.5") |
| `command` | string | Command name (e.g., "queue", "history", "status") |
| `runtime_ms` | number | Execution time in milliseconds |

### Error Object

| Field | Type | Description |
|-------|------|-------------|
| `code` | string | Machine-readable error code |
| `message` | string | Human-readable error message |
| `details` | object | Optional additional error context |

### Pagination Object

| Field | Type | Description |
|-------|------|-------------|
| `total` | number | Total items before filtering |
| `filtered` | number | Items after filtering (before limit/offset) |
| `limit` | number | Maximum items returned |
| `offset` | number | Items skipped |

## Error Codes

Standard error codes used across commands:

### Configuration Errors
- `CONFIG_NOT_FOUND` - Configuration file not found
- `CONFIG_INVALID` - Configuration file has invalid format
- `NOT_INITIALIZED` - ChadGI directory not initialized

### GitHub Errors
- `GITHUB_AUTH_ERROR` - GitHub CLI not authenticated
- `GITHUB_API_ERROR` - GitHub API returned an error
- `PROJECT_NOT_FOUND` - GitHub Project not found
- `ISSUE_NOT_FOUND` - GitHub Issue not found

### Validation Errors
- `VALIDATION_ERROR` - General validation failure
- `INVALID_ARGUMENT` - Invalid command argument

### Runtime Errors
- `COMMAND_FAILED` - Command execution failed
- `TIMEOUT` - Operation timed out
- `BUDGET_EXCEEDED` - Budget limit exceeded

### File/Lock Errors
- `FILE_NOT_FOUND` - Required file not found
- `LOCK_HELD` - Task lock held by another process

### Generic Errors
- `UNKNOWN_ERROR` - Unexpected error occurred

## Command-Specific Schemas

### queue

```json
{
  "success": true,
  "data": {
    "readyColumn": "Ready",
    "taskCount": 3,
    "tasks": [
      {
        "number": 42,
        "title": "Add user authentication",
        "url": "https://github.com/owner/repo/issues/42",
        "itemId": "PVTI_xxx",
        "category": "feature",
        "priority": 1,
        "priorityName": "High",
        "labels": ["enhancement"],
        "dependencies": [41],
        "dependencyStatus": "resolved"
      }
    ]
  },
  "pagination": { "total": 3 }
}
```

### history

```json
{
  "success": true,
  "data": {
    "entries": [
      {
        "issueNumber": 42,
        "issueTitle": "Add user authentication",
        "outcome": "success",
        "elapsedTime": 300,
        "cost": 0.25,
        "prUrl": "https://github.com/owner/repo/pull/43",
        "startedAt": "2026-01-15T10:00:00Z",
        "completedAt": "2026-01-15T10:05:00Z"
      }
    ],
    "total": 10,
    "filtered": 5,
    "dateRange": {
      "since": "2026-01-14T00:00:00Z",
      "until": "2026-01-15T10:30:00Z"
    },
    "statusFilter": "success"
  },
  "pagination": { "total": 10, "filtered": 5, "limit": 10 }
}
```

### status

```json
{
  "success": true,
  "data": {
    "state": "running",
    "currentTask": {
      "id": "42",
      "title": "Add user authentication",
      "branch": "feature/issue-42-add-user-authentication",
      "startedAt": "2026-01-15T10:00:00Z",
      "elapsedSeconds": 300
    },
    "session": {
      "startedAt": "2026-01-15T09:00:00Z",
      "tasksCompleted": 3,
      "totalCostUsd": 0.75,
      "elapsedSeconds": 5400
    },
    "lastUpdated": "2026-01-15T10:05:00Z"
  }
}
```

## Usage Examples

### CI/CD Integration

```bash
#!/bin/bash
# Check queue and process results
result=$(CHADGI_JSON_UNIFIED=1 chadgi queue --json)

if echo "$result" | jq -e '.success' > /dev/null; then
  task_count=$(echo "$result" | jq '.data.taskCount')
  echo "Found $task_count tasks in queue"
else
  error_code=$(echo "$result" | jq -r '.error.code')
  echo "Error: $error_code"
  exit 1
fi
```

### Parsing with jq

```bash
# Get task numbers from queue
chadgi queue --json | jq '.tasks[].number'

# With unified format enabled:
CHADGI_JSON_UNIFIED=1 chadgi queue --json | jq '.data.tasks[].number'
```

### Node.js Integration

```javascript
import { execSync } from 'child_process';

const result = JSON.parse(
  execSync('CHADGI_JSON_UNIFIED=1 chadgi status --json').toString()
);

if (result.success) {
  console.log(`State: ${result.data.state}`);
  console.log(`Runtime: ${result.meta.runtime_ms}ms`);
} else {
  console.error(`Error [${result.error.code}]: ${result.error.message}`);
}
```

## Migration from Legacy Format

If you have scripts consuming the legacy JSON format, you can migrate gradually:

1. **Test with unified format**: Set `CHADGI_JSON_UNIFIED=1` in a test environment
2. **Update parsers**: Access data via `.data` instead of directly
3. **Add error handling**: Check `.success` before accessing `.data`
4. **Use metadata**: Leverage `runtime_ms` and `timestamp` for debugging

The legacy format remains the default to avoid breaking existing integrations.

# Custom Benchmark Tasks

This directory contains custom benchmark task definitions for `chadgi benchmark`.

## Task Format

Each task is a JSON file with the following structure:

```json
{
  "id": "unique-task-id",
  "name": "Human-readable Task Name",
  "description": "Brief description of what this task tests",
  "category": "code-review|bug-fix|refactor|feature|test|docs|custom",
  "complexity": "simple|medium|complex",
  "prompt": "The prompt that will be sent to Claude",
  "expectedOutcome": "Description of the expected output (for reference)",
  "maxDuration": 60
}
```

## Fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique identifier for the task (used with --tasks flag) |
| `name` | Yes | Display name shown in reports |
| `description` | Yes | Brief description of what this task tests |
| `category` | Yes | Category for grouping in reports |
| `complexity` | Yes | simple, medium, or complex |
| `prompt` | Yes | The actual prompt sent to Claude |
| `expectedOutcome` | No | What a successful response should include |
| `maxDuration` | No | Timeout in seconds (default: 120) |

## Categories

- `code-review` - Code review and analysis tasks
- `bug-fix` - Fixing bugs in provided code
- `refactor` - Code refactoring tasks
- `feature` - Implementing new features
- `test` - Writing tests
- `docs` - Documentation generation
- `custom` - Custom/other tasks

## Usage

1. Create a `.json` file in this directory
2. Define your task using the format above
3. Run benchmarks with `chadgi benchmark --full` to include custom tasks
4. Or run specific tasks with `chadgi benchmark --tasks your-task-id`

## Example: Testing Your Codebase

Create a task specific to your project:

```json
{
  "id": "my-api-review",
  "name": "API Endpoint Review",
  "description": "Review our REST API for best practices",
  "category": "code-review",
  "complexity": "medium",
  "prompt": "Review this API endpoint for security, performance, and REST best practices:\n\n```typescript\n// Paste your actual code here\n```",
  "expectedOutcome": "Should identify any security issues, suggest performance improvements",
  "maxDuration": 90
}
```

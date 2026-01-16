# Claude Code Instructions for ChadGI

## Commit Message Format

This repo uses [Conventional Commits](https://www.conventionalcommits.org/) with semantic-release for automated versioning.

**Always use these prefixes:**

- `fix:` - Bug fixes → triggers **patch** release (1.0.x)
- `feat:` - New features → triggers **minor** release (1.x.0)
- `docs:` - Documentation only (no release)
- `chore:` - Maintenance tasks (no release)
- `refactor:` - Code refactoring (no release)
- `test:` - Adding/updating tests (no release)

**For breaking changes**, add `BREAKING CHANGE:` in the commit body → triggers **major** release (x.0.0)

**Examples:**
```
fix: resolve race condition in task queue

feat: add webhook notifications for task completion

feat: redesign config system

BREAKING CHANGE: config file format changed from JSON to YAML
```

## PR and Release Flow

- PRs merged to `master` automatically trigger releases via semantic-release
- Version is determined from commit messages - no manual version bumping needed
- CHANGELOG.md is auto-generated from commits

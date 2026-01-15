#!/bin/bash
set -e

# Default to patch if no argument provided
VERSION_TYPE=${1:-patch}

# Validate version type
if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major)$ ]]; then
  echo "Usage: ./scripts/publish.sh [patch|minor|major]"
  echo "  patch - 1.0.0 -> 1.0.1 (bug fixes)"
  echo "  minor - 1.0.0 -> 1.1.0 (new features)"
  echo "  major - 1.0.0 -> 2.0.0 (breaking changes)"
  exit 1
fi

echo "Bumping $VERSION_TYPE version..."
npm version $VERSION_TYPE

echo "Publishing to npm..."
npm publish

echo "Pushing to git..."
git push && git push --tags

echo "Done!"

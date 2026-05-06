#!/bin/bash

# Robust Release Script for ERPGrafico
# Usage: ./release.sh [patch|minor|major]

set -e

# 1. Validate argument
if [ -z "$1" ]; then
    echo "Usage: ./release.sh [patch|minor|major]"
    exit 1
fi

# 2. Check for clean working directory
if [ -n "$(git status --porcelain)" ]; then
    echo "Error: Working directory is not clean. Please commit or stash your changes first."
    exit 1
fi

echo "🚀 Starting release process ($1)..."

# 3. Update Frontend version (without creating git tag yet)
cd frontend
NEW_VERSION=$(npm version $1 --no-git-tag-version | sed 's/v//')
cd ..

echo "📦 New version identified: v$NEW_VERSION"

# 4. Update Backend version
echo "$NEW_VERSION" > backend/VERSION

# 5. Commit the changes
git add frontend/package.json backend/VERSION
if [ -f frontend/package-lock.json ]; then
    git add frontend/package-lock.json
fi

git commit -m "chore: release v$NEW_VERSION"

# 6. Create Git Tag
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"

echo "✅ Release v$NEW_VERSION created locally."
echo "🔗 Run 'git push && git push --tags' to publish."

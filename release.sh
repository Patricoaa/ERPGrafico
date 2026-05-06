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

# 3. Execute Release
echo "🚀 Running standard-version ($1)..."

# Determine the release type
RELEASE_TYPE=""
if [ "$1" == "patch" ] || [ "$1" == "minor" ] || [ "$1" == "major" ]; then
    RELEASE_TYPE="--release-as $1"
fi

# Execute standard-version
# This will:
# 1. Bump versions in frontend/package.json and backend/VERSION (configured in .versionrc.json)
# 2. Update CHANGELOG.md
# 3. Create git commit and tag
npx standard-version $RELEASE_TYPE

echo "✅ Release created locally with CHANGELOG update."
echo "🔗 Run 'git push && git push --tags' to publish."

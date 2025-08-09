#!/bin/bash

# Script to run plugin health check locally and create a PR
# Usage: ./scripts/update-plugin-health.sh

set -e

echo "🚀 Starting plugin health update process..."

# Check if gh CLI is authenticated
if ! gh auth status >/dev/null 2>&1; then
    echo "❌ Error: GitHub CLI not authenticated"
    echo "Run: gh auth login"
    exit 1
fi

# Ensure we're on main/master branch and up to date
echo "📥 Updating main branch..."
git checkout master || git checkout main
git pull origin master || git pull origin main

# Create a new branch with timestamp
BRANCH_NAME="update-plugin-health-$(date +%Y%m%d)"
echo "🌿 Creating branch: $BRANCH_NAME"
git checkout -b "$BRANCH_NAME"

# Run the health check
echo "🔍 Analyzing plugin health..."
npm run health-check

# Check if there are changes
if git diff --quiet HEAD -- PLUGINS.md; then
    echo "ℹ️  No changes detected in PLUGINS.md"
    git checkout master || git checkout main
    git branch -D "$BRANCH_NAME"
    exit 0
fi

# Show statistics from the report
if [ -f "plugin-health-report.json" ]; then
    echo ""
    echo "📊 Health Statistics:"
    node -e "
        const report = require('./plugin-health-report.json');
        const stats = report.statistics;
        console.log('  Total plugins:', report.totalPlugins);
        console.log('  🟢 Healthy:', stats.healthy);
        console.log('  🟡 Concerning:', stats.concerning);
        console.log('  🔴 Problematic:', stats.problematic);
        console.log('  ⚪ Unknown:', stats.unknown);
    "
    echo ""
fi

# Commit changes
echo "💾 Committing changes..."
git add PLUGINS.md
git commit -m "chore: update plugin health indicators

Monthly automated health check for all Metalsmith plugins.
Updated $(date +%Y-%m-%d)"

# Push to remote
echo "📤 Pushing to GitHub..."
git push origin "$BRANCH_NAME"

# Create pull request
echo "🔄 Creating pull request..."
PR_BODY="## Plugin Health Analysis Results

This automated analysis updates the health indicators for all plugins in PLUGINS.md.

### Health Indicators
- 🟢 **Healthy**: Actively maintained with recent commits and good adoption
- 🟡 **Concerning**: Some maintenance activity but may have issues  
- 🔴 **Problematic**: Likely abandoned or deprecated
- ⚪ **Unknown**: Unable to determine health status

### Analysis Based On
- Recent commit activity (last 12 months)
- Issue response patterns
- npm download statistics
- Overall maintenance status

Generated on $(date +%Y-%m-%d)"

gh pr create \
    --title "Update Plugin Health Indicators ($(date +%Y-%m-%d))" \
    --body "$PR_BODY" \
    --base master

echo ""
echo "✅ Success! Pull request created."
echo "   Review and merge at: https://github.com/metalsmith/awesome-metalsmith/pulls"
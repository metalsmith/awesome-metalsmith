#!/bin/bash

# Script to run plugin health check and commit changes
# Usage: ./scripts/update-plugin-health.sh

set -e

# Read config
CONFIG_FILE="$(dirname "$0")/config.json"
PLUGINS_MD=$(node -e "console.log(require('$CONFIG_FILE').paths.pluginsMarkdown)")
HEALTH_REPORT=$(node -e "console.log(require('$CONFIG_FILE').paths.healthReport)")

echo "🚀 Starting plugin health update process..."

# Run the health check
echo "🔍 Analyzing plugin health..."
npm run health-check

# Check if there are changes
if git diff --quiet HEAD -- "$PLUGINS_MD"; then
    echo "ℹ️  No changes detected in $PLUGINS_MD"
    echo "✅ Health check complete - no updates needed"
    exit 0
fi

# Show statistics from the report
if [ -f "$HEALTH_REPORT" ]; then
    echo ""
    echo "📊 Health Statistics:"
    node -e "
        const report = require('./$HEALTH_REPORT');
        const stats = report.statistics;
        console.log('  Total plugins:', report.totalPlugins);
        if (stats.upToDate !== undefined) {
            console.log('  🟢 Up-to-date:', stats.upToDate);
            console.log('  🟡 Needing attention:', stats.needingAttention);
            console.log('  🔴 Uncertain:', stats.uncertain);
            console.log('  📁 Archived:', stats.archived);
            if (stats.unknown > 0) {
                console.log('  ⚠️  404 repositories:', stats.unknown, '(not listed)');
            }
        }
    "
    echo ""
fi

# Commit changes
echo "💾 Committing changes..."
git add "$PLUGINS_MD"
if [ -f "$HEALTH_REPORT" ]; then
    git add "$HEALTH_REPORT"
fi

git commit -m "chore: update plugin health indicators

Automated health check for all Metalsmith plugins.
Updated $(date +%Y-%m-%d)"

# Push to remote origin
echo "📤 Pushing changes to origin..."
git push origin

echo ""
echo "✅ Success! Plugin health data updated and pushed to origin."
echo "   Changes committed to current branch: $(git branch --show-current)"
echo ""
echo "📋 Next steps:"
echo "   1. Review the changes in your local repository"
echo "   2. Create a pull request manually if needed"
echo "   3. Merge with upstream when ready"
# Adding New Plugins - Quick Guide

## For Quick Plugin Additions

When you want to add a new plugin, you can use the "New Plugins" section for easy organization.

### Step 1: Add to New Plugins Section

Edit PLUGINS.md and add the plugin to the "New Plugins" section at the top:

```markdown
## 🆕 New Plugins

*Recently added plugins - these will be analyzed and categorized in the next health check.*

- [metalsmith-awesome-plugin](https://github.com/author/metalsmith-awesome-plugin)
- [metalsmith-your-new-plugin](https://github.com/yourname/metalsmith-your-new-plugin)
```

### Step 2: Commit Your Changes

```bash
git add PLUGINS.md
git commit -m "Add new plugin: metalsmith-awesome-plugin"
git push origin main
```

### What Happens Next

When the health check script runs, it will:

1. **Analyze ALL plugins** including new ones from the "New Plugins" section
2. **Categorize new plugins** based on their health status (🟢 up-to-date, 🟡 needing attention, etc.)
3. **Remove the "New Plugins" section** since all plugins are now categorized
4. **Place plugins** in the appropriate health category sections

## Running Health Checks

```bash
npm run health-check
```

This will analyze all plugins (including new ones) and regenerate the PLUGINS.md file with proper categorization.

## Benefits

- ✅ **Quick additions** for easy plugin submissions
- ✅ **Automatic processing** - new plugins get analyzed immediately
- ✅ **Simple workflow** - no need for separate processing steps
- ✅ **Perfect for PR reviews** - easy to see what's new before they get categorized

## Example Workflow

1. Someone submits a PR with a new plugin in the "New Plugins" section
2. Maintainer merges the PR
3. Next health check automatically analyzes and categorizes all new plugins
4. The "New Plugins" section disappears as everything gets properly categorized

This makes plugin submissions simple while maintaining the health analysis system!
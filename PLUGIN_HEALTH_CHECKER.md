# Plugin Health Checker for Awesome Metalsmith

A local tool to analyze the health of all Metalsmith plugins listed in PLUGINS.md and automatically update the file with health indicators.

## Quick Start

```bash
# Install dependencies
npm install

# Run health check and create PR (one command)
./scripts/update-plugin-health.sh
```

That's it! The script will analyze all plugins, update PLUGINS.md, and create a pull request.

## How It Works

The health checker:
1. **Parses PLUGINS.md** to extract all plugin repositories
2. **Analyzes each plugin** using GitHub API and npm registry
3. **Fetches package.json** from each repository for dependency analysis
4. **Calculates health scores** based on:
   - Recent commit activity (45% weight)
   - Issue responsiveness (20% weight)
   - npm download statistics (15% weight)
   - GitHub stars (10% weight)
   - Has package.json (10% weight)
5. **Analyzes dependencies** for security and deprecation issues:
   - Identifies known security vulnerabilities
   - Flags outdated and deprecated packages
   - Checks for pre-1.0 version dependencies
6. **Updates PLUGINS.md** with health and security indicators
7. **Creates a pull request** for review

## Health Indicators

- 🟢 **Up-to-date**: Updated within the last 2 years
- 🟡 **Needing attention**: Updated 2-5 years ago
- 🔴 **Uncertain**: Updated more than 5 years ago
- 📁 **Archived**: Repository is archived
- ⚪ **Unknown**: Unable to determine health status

## Security Indicators

- ⚠️ **Security concerns**: Known vulnerabilities or security issues detected
- 📦 **Outdated dependencies**: Uses deprecated or outdated packages

## Prerequisites

### GitHub CLI Authentication
The tool uses your GitHub CLI authentication automatically:

```bash
# Check if you're authenticated
gh auth status

# If not, authenticate
gh auth login
```

This provides the necessary API access without managing tokens.

## Usage Options

### Option 1: Automated Script (Recommended)
```bash
./scripts/update-plugin-health.sh
```
This script handles everything: runs analysis, commits changes, creates PR.

### Option 2: Manual Steps
```bash
# Run the analysis
npm run health-check

# Review changes
git diff PLUGINS.md

# Check the detailed report
cat plugin-health-report.json | jq '.statistics'

# Create PR manually
git checkout -b update-plugin-health
git add PLUGINS.md
git commit -m "chore: update plugin health indicators"
git push origin update-plugin-health
gh pr create
```

### Option 3: Dry Run (Preview Only)
```bash
# Preview without making changes
npm run health-check:dry
```

## NPM Scripts

- `npm run health-check` - Run full analysis and update PLUGINS.md
- `npm run health-check:dry` - Preview changes without updating files
- `npm run update` - Shortcut for ./scripts/update-plugin-health.sh

## Configuration

Edit scoring weights and thresholds in `scripts/analyze-plugin-health.js`:

```javascript
scoring: {
  weights: {
    recentCommits: 0.45,
    issueActivity: 0.20,
    downloads: 0.15,
    stars: 0.10,
    hasPackageJson: 0.10
  },
  thresholds: {
    healthy: 70,      // Score >= 70 = 🟢
    concerning: 40,   // Score >= 40 = 🟡
    // Score < 40 = 🔴
  }
}
```

## Output Files

- **PLUGINS.md** - Updated with health indicators, security badges, and reorganized
- **plugin-health-report.json** - Detailed analysis data including security information (git-ignored)

## Security Analysis Features

The health checker now includes comprehensive security analysis:

### What It Checks

1. **Known Security Vulnerabilities**
   - Flags packages with known security issues (e.g., node-sass, request, har-validator)
   - Identifies deprecated packages that may have security implications

2. **Outdated Dependencies**
   - Pre-1.0 version dependencies (often unstable)
   - Deprecated build tools (Gulp, Grunt, Bower)
   - Legacy packages (jQuery, CoffeeScript)
   - Outdated Metalsmith versions

3. **Security Indicators in PLUGINS.md**
   - ⚠️ appears next to plugins with security concerns
   - 📦 appears next to plugins with outdated/deprecated dependencies
   - Both badges can appear if both issues are present

### Security Report

The `plugin-health-report.json` includes detailed security information:
```json
{
  "security": {
    "totalDependencies": 15,
    "outdatedPatterns": ["gulp: ^3.9.1 (consider modern build tools)"],
    "deprecatedPackages": ["bower: Uses Bower (deprecated, use npm)"],
    "securityConcerns": ["node-sass: Known security issues or deprecated"]
  }
}
```

### Interpreting Security Results

- **⚠️ Security concerns**: Immediate attention recommended - known vulnerabilities
- **📦 Outdated dependencies**: Consider updating - may affect stability/compatibility
- No badges: Dependencies appear to be up-to-date and secure

## Monthly Maintenance Routine

1. Run the update script monthly:
   ```bash
   ./scripts/update-plugin-health.sh
   ```

2. Review the created pull request on GitHub

3. Merge when ready

## Handling Rate Limits

The tool automatically uses your `gh` CLI authentication for API access:
- **With auth**: 5,000 requests/hour (enough for all plugins)
- **Without auth**: 60 requests/hour (fails after ~15 plugins)

If you see rate limit errors, ensure you're authenticated with `gh auth login`.

## Troubleshooting

### "GitHub CLI not authenticated"
```bash
gh auth login
```

### "Rate limit exceeded"
Make sure you're authenticated with GitHub CLI. The tool auto-detects gh auth.

### "No changes detected"
The plugins haven't changed significantly since the last run.

### Script permission denied
```bash
chmod +x scripts/update-plugin-health.sh
```

## Project Structure

```
awesome-metalsmith/
├── scripts/
│   ├── analyze-plugin-health.js    # Main analysis script
│   └── update-plugin-health.sh     # Automation script
├── PLUGINS.md                      # Plugin list (updated by tool)
├── PLUGIN_HEALTH_CHECKER.md        # This file
├── plugin-health-report.json       # Detailed report (git-ignored)
└── package.json                    # Dependencies and scripts
```

## Contributing

To improve the health checker:
1. Modify the scoring algorithm in `scripts/analyze-plugin-health.js`
2. Test with `npm run health-check:dry`
3. Submit a PR with your improvements

## Benefits

- **No CI/CD complexity** - Runs locally with your permissions
- **No secrets management** - Uses gh CLI authentication
- **Full control** - Review all changes before committing
- **Simple maintenance** - One command monthly update
- **Transparent process** - See exactly what changes are made
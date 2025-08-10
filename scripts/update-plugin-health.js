#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const config = require('./config.json');

// Cross-platform script to run plugin health check and create PR
// Works on Windows, macOS, and Linux

console.log('🚀 Starting plugin health update process...\n');

// Function to run command and handle errors
function runCommand(command, options = {}) {
  try {
    return execSync(command, { 
      encoding: 'utf8', 
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options 
    });
  } catch (error) {
    if (!options.allowFailure) {
      console.error(`❌ Error running: ${command}`);
      console.error(error.message);
      process.exit(1);
    }
    return null;
  }
}

// Check if gh CLI is authenticated
console.log('🔐 Checking GitHub CLI authentication...');
const authStatus = runCommand('gh auth status', { silent: true, allowFailure: true });
if (!authStatus) {
  console.error('❌ Error: GitHub CLI not authenticated');
  console.error('Run: gh auth login');
  process.exit(1);
}
console.log('✅ GitHub CLI authenticated\n');

// Get current branch name
const currentBranch = runCommand('git branch --show-current', { silent: true }).trim();
console.log(`📍 Current branch: ${currentBranch}`);

// Ensure we're on main/master branch and up to date
const mainBranch = currentBranch === 'master' ? 'master' : 'main';
console.log(`📥 Updating ${mainBranch} branch...`);

if (currentBranch !== mainBranch) {
  runCommand(`git checkout ${mainBranch}`);
}
runCommand(`git pull origin ${mainBranch}`);

// Create a new branch with timestamp
const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
const branchName = `update-plugin-health-${timestamp}`;
console.log(`🌿 Creating branch: ${branchName}`);
runCommand(`git checkout -b "${branchName}"`);

// Run the health check
console.log('🔍 Analyzing plugin health...');
runCommand('npm run health-check');

// Check if there are changes
const gitStatus = runCommand('git status --porcelain', { silent: true });
const hasChanges = gitStatus.includes(path.basename(config.paths.pluginsMarkdown));

if (!hasChanges) {
  console.log(`ℹ️  No changes detected in ${config.paths.pluginsMarkdown}`);
  runCommand(`git checkout ${mainBranch}`);
  runCommand(`git branch -D "${branchName}"`);
  process.exit(0);
}

// Show statistics from the report
if (fs.existsSync(config.paths.healthReport)) {
  try {
    const report = JSON.parse(fs.readFileSync(config.paths.healthReport, 'utf8'));
    const stats = report.statistics;
    console.log('\n📊 Health Statistics:');
    console.log(`  Total plugins: ${report.totalPlugins}`);
    console.log(`  🟢 Healthy: ${stats.healthy}`);
    console.log(`  🟡 Concerning: ${stats.concerning}`);
    console.log(`  🔴 Problematic: ${stats.problematic}`);
    console.log(`  ⚪ Unknown: ${stats.unknown}\n`);
  } catch (error) {
    console.log('⚠️  Could not read health report statistics\n');
  }
}

// Commit changes
const date = new Date().toISOString().split('T')[0];
console.log('💾 Committing changes...');
runCommand(`git add ${config.paths.pluginsMarkdown}`);
runCommand(`git commit -m "chore: update plugin health indicators

Monthly automated health check for all Metalsmith plugins.
Updated ${date}"`);

// Push to remote
console.log('📤 Pushing to GitHub...');
runCommand(`git push origin "${branchName}"`);

// Create pull request
console.log('🔄 Creating pull request...');
const prBody = `## Plugin Health Analysis Results

This automated analysis updates the health indicators for all plugins in ${config.paths.pluginsMarkdown}.

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

Generated on ${date}`;

// Write PR body to temp file to handle multiline content cross-platform
const tempFile = path.join(__dirname, 'temp-pr-body.txt');
fs.writeFileSync(tempFile, prBody);

try {
  runCommand(`gh pr create --title "Update Plugin Health Indicators (${date})" --body-file "${tempFile}" --base ${mainBranch}`);
  
  console.log('\n✅ Success! Pull request created.');
  console.log('   Review and merge at: https://github.com/metalsmith/awesome-metalsmith/pulls');
} finally {
  // Clean up temp file
  if (fs.existsSync(tempFile)) {
    fs.unlinkSync(tempFile);
  }
}
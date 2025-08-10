#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const config = require('./config.json');

// Cross-platform script to run plugin health check and commit changes
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

// Run the health check
console.log('🔍 Analyzing plugin health...');
runCommand('npm run health-check');

// Check if there are changes
const gitStatus = runCommand('git status --porcelain', { silent: true });
const hasChanges = gitStatus.includes(path.basename(config.paths.pluginsMarkdown));

if (!hasChanges) {
  console.log(`ℹ️  No changes detected in ${config.paths.pluginsMarkdown}`);
  console.log('✅ Health check complete - no updates needed');
  process.exit(0);
}

// Show statistics from the report
if (fs.existsSync(config.paths.healthReport)) {
  try {
    const report = JSON.parse(fs.readFileSync(config.paths.healthReport, 'utf8'));
    const stats = report.statistics;
    console.log('\n📊 Health Statistics:');
    console.log(`  Total plugins: ${report.totalPlugins}`);
    
    if (stats.upToDate !== undefined) {
      console.log(`  🟢 Up-to-date: ${stats.upToDate}`);
      console.log(`  🟡 Needing attention: ${stats.needingAttention}`);
      console.log(`  🔴 Uncertain: ${stats.uncertain}`);
      console.log(`  📁 Archived: ${stats.archived}`);
      if (stats.unknown > 0) {
        console.log(`  ⚠️  404 repositories: ${stats.unknown} (not listed)`);
      }
      console.log('');
    }
  } catch (error) {
    console.log('⚠️  Could not read health report statistics\n');
  }
}

// Commit changes
const date = new Date().toISOString().split('T')[0];
console.log('💾 Committing changes...');

// Add the PLUGINS.md file
runCommand(`git add ${config.paths.pluginsMarkdown}`);

// Add health report if it exists
if (fs.existsSync(config.paths.healthReport)) {
  runCommand(`git add ${config.paths.healthReport}`);
}

// Commit with descriptive message
runCommand(`git commit -m "chore: update plugin health indicators

Automated health check for all Metalsmith plugins.
Updated ${date}"`);

// Push to remote origin
console.log('📤 Pushing changes to origin...');
runCommand('git push origin');

// Get current branch name
const currentBranch = runCommand('git branch --show-current', { silent: true }).trim();

console.log('\n✅ Success! Plugin health data updated and pushed to origin.');
console.log(`   Changes committed to current branch: ${currentBranch}`);
console.log('\n📋 Next steps:');
console.log('   1. Review the changes in your local repository');
console.log('   2. Create a pull request manually if needed');
console.log('   3. Merge with upstream when ready');
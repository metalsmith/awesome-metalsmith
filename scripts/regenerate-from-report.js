#!/usr/bin/env node

// Regenerate PLUGINS.md from existing health report using new categorization
const fs = require('fs');
const { formatDistanceToNow, differenceInDays } = require('date-fns');

console.log('📝 Regenerating PLUGINS.md from existing health report...\n');

// Check if health report exists
if (!fs.existsSync('plugin-health-report.json')) {
  console.error('❌ No plugin-health-report.json found. Run health check first.');
  process.exit(1);
}

// Load the existing health report
const report = JSON.parse(fs.readFileSync('plugin-health-report.json', 'utf8'));

// Function to get health indicator based on new categories
function getHealthIndicator(lastCommitDate, isArchived) {
  if (isArchived) return '📁'; // Archived
  if (!lastCommitDate) return '⚪'; // Unknown
  
  const daysSinceCommit = differenceInDays(new Date(), new Date(lastCommitDate));
  const yearsSinceCommit = daysSinceCommit / 365;
  
  if (yearsSinceCommit <= 2) return '🟢'; // Up-to-date
  if (yearsSinceCommit <= 5) return '🟡'; // Needing attention
  return '🔴'; // Uncertain (>5 years)
}

// Recategorize plugins with new criteria
const corePlugins = [];
const upToDate = [];
const needingAttention = [];
const uncertain = [];
const archived = [];
const unknown = [];

for (const plugin of report.plugins) {
  const newIndicator = getHealthIndicator(plugin.metrics.lastCommit, plugin.metrics.archived);
  
  const entry = {
    name: plugin.name,
    url: plugin.url,
    health: {
      ...plugin,
      healthIndicator: newIndicator
    },
    displayName: `${newIndicator} [${plugin.name}](${plugin.url})`
  };
  
  // Check if it's a core plugin (github.com/metalsmith/...)
  const isCorePlugin = plugin.owner === 'metalsmith';
  
  if (isCorePlugin) {
    entry.displayName = `[${plugin.name}](${plugin.url})`; // No health indicator for core plugins
    corePlugins.push(entry);
  } else {
    switch (newIndicator) {
      case '🟢':
        upToDate.push(entry);
        break;
      case '🟡':
        needingAttention.push(entry);
        break;
      case '🔴':
        uncertain.push(entry);
        break;
      case '📁':
        archived.push(entry);
        break;
      default:
        unknown.push(entry);
    }
  }
}

// Sort each group by most recent commit first
const sortByCommitDate = (a, b) => {
  const aDate = a.health.metrics.lastCommit ? new Date(a.health.metrics.lastCommit) : new Date(0);
  const bDate = b.health.metrics.lastCommit ? new Date(b.health.metrics.lastCommit) : new Date(0);
  return bDate - aDate;
};

corePlugins.sort(sortByCommitDate);
upToDate.sort(sortByCommitDate);
needingAttention.sort(sortByCommitDate);
uncertain.sort(sortByCommitDate);
archived.sort(sortByCommitDate);

// Generate markdown
let markdown = '# Metalsmith Plugins\n\n';

// Add core plugins section first
if (corePlugins.length > 0) {
  markdown += '## 🏛️ Core Plugins\n\n';
  markdown += '*Official plugins maintained by the Metalsmith team.*\n\n';
  for (const plugin of corePlugins) {
    markdown += `- ${plugin.displayName}`;
    if (plugin.health.metrics.lastCommit) {
      const timeAgo = formatDistanceToNow(new Date(plugin.health.metrics.lastCommit), { addSuffix: true });
      markdown += ` - Updated ${timeAgo}`;
    }
    markdown += '\n';
  }
  markdown += '\n---\n\n';
}

markdown += '## Health Indicators\n\n';
markdown += '- 🟢 **Up-to-date**: Updated within the last 2 years\n';
markdown += '- 🟡 **Needing attention**: Updated 2-5 years ago\n';
markdown += '- 🔴 **Uncertain**: Updated more than 5 years ago\n';
markdown += '- 📁 **Archived**: Repository is archived\n';
markdown += '- ⚪ **Unknown**: Unable to determine status\n\n';
markdown += `*Last updated: ${new Date().toISOString().split('T')[0]}*\n\n`;
markdown += '---\n\n';

// Add plugins by category
if (upToDate.length > 0) {
  markdown += '## 🟢 Up-to-date Plugins\n\n';
  for (const plugin of upToDate) {
    markdown += `- ${plugin.displayName}`;
    if (plugin.health.metrics.weeklyDownloads) {
      markdown += ` - ${plugin.health.metrics.weeklyDownloads.toLocaleString()} weekly downloads`;
    }
    if (plugin.health.metrics.lastCommit) {
      const timeAgo = formatDistanceToNow(new Date(plugin.health.metrics.lastCommit), { addSuffix: true });
      markdown += ` - Updated ${timeAgo}`;
    }
    markdown += '\n';
  }
  markdown += '\n';
}

if (needingAttention.length > 0) {
  markdown += '## 🟡 Plugins Needing Attention (2-5 years)\n\n';
  for (const plugin of needingAttention) {
    markdown += `- ${plugin.displayName}`;
    if (plugin.health.metrics.lastCommit) {
      const timeAgo = formatDistanceToNow(new Date(plugin.health.metrics.lastCommit), { addSuffix: true });
      markdown += ` - Last updated ${timeAgo}`;
    }
    markdown += '\n';
  }
  markdown += '\n';
}

if (uncertain.length > 0) {
  markdown += '## 🔴 Uncertain Status (>5 years)\n\n';
  for (const plugin of uncertain) {
    markdown += `- ${plugin.displayName}`;
    if (plugin.health.metrics.lastCommit) {
      const timeAgo = formatDistanceToNow(new Date(plugin.health.metrics.lastCommit), { addSuffix: true });
      markdown += ` - Last updated ${timeAgo}`;
    }
    markdown += '\n';
  }
  markdown += '\n';
}

if (archived.length > 0) {
  markdown += '## 📁 Archived Plugins\n\n';
  for (const plugin of archived) {
    markdown += `- ${plugin.displayName}`;
    if (plugin.health.metrics.lastCommit) {
      const timeAgo = formatDistanceToNow(new Date(plugin.health.metrics.lastCommit), { addSuffix: true });
      markdown += ` - Last updated ${timeAgo}`;
    }
    markdown += '\n';
  }
  markdown += '\n';
}

if (unknown.length > 0) {
  markdown += '## ⚪ Unknown Status\n\n';
  for (const plugin of unknown) {
    markdown += `- [${plugin.name}](${plugin.url})\n`;
  }
  markdown += '\n';
}

// Add statistics
const totalPlugins = report.totalPlugins;
markdown += '## Statistics\n\n';
markdown += `- Total plugins: ${totalPlugins}\n`;
markdown += `- Up-to-date: ${upToDate.length} (${Math.round(upToDate.length / totalPlugins * 100)}%)\n`;
markdown += `- Needing attention: ${needingAttention.length} (${Math.round(needingAttention.length / totalPlugins * 100)}%)\n`;
markdown += `- Uncertain: ${uncertain.length} (${Math.round(uncertain.length / totalPlugins * 100)}%)\n`;
markdown += `- Archived: ${archived.length} (${Math.round(archived.length / totalPlugins * 100)}%)\n`;
markdown += `- Unknown: ${unknown.length} (${Math.round(unknown.length / totalPlugins * 100)}%)\n`;

// Write updated file
fs.writeFileSync('PLUGINS.md', markdown);

console.log('✅ PLUGINS.md regenerated with new categorization');
console.log('\n📊 New Statistics:');
console.log(`  Total plugins: ${totalPlugins}`);
console.log(`  🟢 Up-to-date: ${upToDate.length}`);
console.log(`  🟡 Needing attention: ${needingAttention.length}`);
console.log(`  🔴 Uncertain: ${uncertain.length}`);
console.log(`  📁 Archived: ${archived.length}`);
console.log(`  ⚪ Unknown: ${unknown.length}`);
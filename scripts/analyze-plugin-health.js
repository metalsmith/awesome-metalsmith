const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { formatDistanceToNow, differenceInDays } = require('date-fns');

// Load environment variables from .env file if it exists
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not critical, can use environment variables directly
}

// Try to get GitHub token from gh CLI if not in environment
if (!process.env.GITHUB_TOKEN) {
  try {
    const { execSync } = require('child_process');
    const token = execSync('gh auth token', { encoding: 'utf8' }).trim();
    if (token) {
      process.env.GITHUB_TOKEN = token;
      console.log('✅ Using GitHub token from gh CLI\n');
    }
  } catch (e) {
    // gh CLI not available or not authenticated
  }
}

// Configuration
const CONFIG = {
  github: {
    baseUrl: 'https://api.github.com',
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'metalsmith-plugin-health-checker'
    }
  },
  npm: {
    baseUrl: 'https://registry.npmjs.org'
  },
  scoring: {
    weights: {
      recentCommits: 0.45,
      issueActivity: 0.20,
      downloads: 0.15,
      stars: 0.10,
      hasPackageJson: 0.10
    },
    thresholds: {
      healthy: 70,
      concerning: 40,
      daysForRecent: 365,
      minDownloadsHealthy: 100,
      minStarsHealthy: 10
    }
  },
  rateLimit: {
    requestsPerMinute: 30,
    delayMs: 2000
  }
};

// Add GitHub token if available
if (process.env.GITHUB_TOKEN) {
  CONFIG.github.headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
}

class PluginHealthAnalyzer {
  constructor() {
    this.plugins = [];
    this.healthData = new Map();
    this.rateLimitRemaining = null;
    this.rateLimitReset = null;
  }

  async run() {
    try {
      console.log('🚀 Starting plugin health analysis...\n');
      
      // Parse PLUGINS.md first to know how many plugins we have
      await this.parsePluginsMarkdown();
      console.log(`📋 Found ${this.plugins.length} plugins to analyze\n`);
      
      // Check for GitHub token
      if (!process.env.GITHUB_TOKEN) {
        console.log('⚠️  WARNING: No GitHub token detected!');
        console.log('   Without authentication, GitHub API is limited to 60 requests/hour.');
        console.log('   With 300+ plugins, this will fail after ~15 plugins.\n');
        console.log('   To fix this, you have 3 options:\n');
        console.log('   Option 1: Use GitHub CLI (easiest for local testing)');
        console.log('   $ gh auth login');
        console.log('   Then run the script normally\n');
        console.log('   Option 2: Use .env file');
        console.log('   $ cp .env.example .env');
        console.log('   Then add your token to .env\n');
        console.log('   Option 3: Use environment variable');
        console.log('   $ GITHUB_TOKEN=your_token npm run health-check\n');
        
        if (this.plugins.length > 20 && !process.env.FORCE_RUN) {
          console.log('❌ Aborting. Add FORCE_RUN=true to run anyway.\n');
          process.exit(1);
        }
      }
      
      // Always process all plugins, including new ones
      const newPluginsCount = this.plugins.filter(p => p.isNewPlugin).length;
      
      if (newPluginsCount > 0) {
        console.log(`🆕 Found ${newPluginsCount} new plugins - will analyze and categorize them\n`);
      }
      
      console.log(`🔍 Analyzing ${this.plugins.length} plugins\n`);
      
      for (let i = 0; i < this.plugins.length; i++) {
        const plugin = this.plugins[i];
        console.log(`[${i + 1}/${this.plugins.length}] Analyzing ${plugin.name}...`);
        
        await this.analyzePlugin(plugin);
        
        // Rate limiting
        if ((i + 1) % CONFIG.rateLimit.requestsPerMinute === 0) {
          console.log('⏳ Rate limit pause...');
          await this.delay(60000);
        } else {
          await this.delay(CONFIG.rateLimit.delayMs);
        }
      }
      
      // Generate updated markdown
      await this.generateUpdatedMarkdown();
      
      console.log('\n✅ Plugin health analysis complete!');
      
    } catch (error) {
      console.error('❌ Error during analysis:', error.message);
      process.exit(1);
    }
  }

  async parsePluginsMarkdown() {
    const content = await fs.readFile('PLUGINS.md', 'utf-8');
    const lines = content.split('\n');
    let inNewPluginsSection = false;
    
    for (const line of lines) {
      // Check if we're entering the "New Plugins" section
      if (line.includes('## 🆕 New Plugins') || line.includes('## New Plugins')) {
        inNewPluginsSection = true;
        continue;
      }
      
      // Check if we're leaving the section (next ## header)
      if (inNewPluginsSection && line.startsWith('## ') && !line.includes('New Plugins')) {
        inNewPluginsSection = false;
      }
      
      // Match plugin entries: - [plugin-name](github-url)
      const match = line.match(/^-\s+\[([^\]]+)\]\(([^)]+)\)/);
      if (match) {
        const [, name, url] = match;
        
        // Extract GitHub owner and repo from URL
        const githubMatch = url.match(/github\.com\/([^\/]+)\/([^\/\#]+)/);
        if (githubMatch) {
          const [, owner, repo] = githubMatch;
          this.plugins.push({
            name: name.trim(),
            url: url.trim(),
            owner: owner.trim(),
            repo: repo.replace(/\.git$/, '').trim(),
            originalLine: line,
            isNewPlugin: inNewPluginsSection
          });
        }
      }
    }
    
    // Remove duplicates based on repo URL
    const seen = new Set();
    this.plugins = this.plugins.filter(plugin => {
      const key = `${plugin.owner}/${plugin.repo}`;
      if (seen.has(key)) {
        console.log(`⚠️  Duplicate found: ${plugin.name} (${key})`);
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  async analyzePlugin(plugin) {
    const health = {
      name: plugin.name,
      url: plugin.url,
      owner: plugin.owner,
      repo: plugin.repo,
      scores: {},
      metrics: {},
      healthScore: 0,
      healthIndicator: '⚪',
      lastAnalyzed: new Date().toISOString()
    };

    try {
      // Fetch GitHub repository data
      const repoData = await this.fetchGitHubRepoData(plugin);
      if (repoData) {
        health.metrics.lastCommit = repoData.lastCommit;
        health.metrics.stars = repoData.stars;
        health.metrics.openIssues = repoData.openIssues;
        health.metrics.archived = repoData.archived;
        health.metrics.hasPackageJson = repoData.hasPackageJson;
        
        // Calculate GitHub-based scores
        health.scores.recentCommits = this.calculateRecentCommitScore(repoData.lastCommit);
        health.scores.stars = this.calculateStarsScore(repoData.stars);
        health.scores.hasPackageJson = repoData.hasPackageJson ? 100 : 0;
        
        // Check if archived
        if (repoData.archived) {
          health.healthIndicator = '🔴';
          health.healthScore = 0;
          health.metrics.status = 'archived';
          this.healthData.set(plugin.name, health);
          return;
        }
      }

      // Fetch npm data
      const npmData = await this.fetchNpmData(plugin);
      if (npmData) {
        health.metrics.weeklyDownloads = npmData.weeklyDownloads;
        health.metrics.lastPublish = npmData.lastPublish;
        health.scores.downloads = this.calculateDownloadScore(npmData.weeklyDownloads);
      }

      // Fetch issue activity
      const issueActivity = await this.fetchIssueActivity(plugin);
      if (issueActivity) {
        health.metrics.recentIssueActivity = issueActivity.hasRecentActivity;
        health.scores.issueActivity = issueActivity.activityScore;
      }

      // Calculate overall health score
      health.healthScore = this.calculateOverallScore(health.scores);
      health.healthIndicator = this.getHealthIndicator(health.metrics.lastCommit, health.metrics.archived);

    } catch (error) {
      console.error(`  ❌ Error analyzing ${plugin.name}: ${error.message}`);
      health.error = error.message;
    }

    this.healthData.set(plugin.name, health);
  }

  async fetchGitHubRepoData(plugin) {
    try {
      // Fetch repository info
      const repoUrl = `${CONFIG.github.baseUrl}/repos/${plugin.owner}/${plugin.repo}`;
      const repoResponse = await axios.get(repoUrl, { headers: CONFIG.github.headers });
      
      this.updateRateLimits(repoResponse.headers);
      
      const repoData = repoResponse.data;
      
      // Fetch latest commit
      const commitsUrl = `${CONFIG.github.baseUrl}/repos/${plugin.owner}/${plugin.repo}/commits`;
      let lastCommit = null;
      
      try {
        const commitsResponse = await axios.get(commitsUrl, { 
          headers: CONFIG.github.headers,
          params: { per_page: 1 }
        });
        
        if (commitsResponse.data && commitsResponse.data.length > 0) {
          lastCommit = commitsResponse.data[0].commit.committer.date;
        }
      } catch (error) {
        console.log(`  ⚠️  Could not fetch commits for ${plugin.name}`);
      }
      
      // Check for package.json
      let hasPackageJson = false;
      try {
        const packageUrl = `${CONFIG.github.baseUrl}/repos/${plugin.owner}/${plugin.repo}/contents/package.json`;
        await axios.head(packageUrl, { headers: CONFIG.github.headers });
        hasPackageJson = true;
      } catch (error) {
        // Package.json doesn't exist
      }
      
      return {
        lastCommit: lastCommit || repoData.pushed_at,
        stars: repoData.stargazers_count,
        openIssues: repoData.open_issues_count,
        archived: repoData.archived,
        hasPackageJson
      };
      
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log(`  ⚠️  Repository not found: ${plugin.owner}/${plugin.repo}`);
      } else {
        console.log(`  ⚠️  GitHub API error for ${plugin.name}: ${error.message}`);
      }
      return null;
    }
  }

  async fetchNpmData(plugin) {
    try {
      // Try different package name formats
      const possibleNames = [
        plugin.name,
        plugin.name.toLowerCase(),
        plugin.repo,
        plugin.repo.toLowerCase()
      ];
      
      for (const packageName of possibleNames) {
        try {
          const npmUrl = `${CONFIG.npm.baseUrl}/${packageName}`;
          const response = await axios.get(npmUrl);
          
          if (response.data) {
            // Fetch download stats
            const downloadsUrl = `https://api.npmjs.org/downloads/point/last-week/${packageName}`;
            const downloadsResponse = await axios.get(downloadsUrl);
            
            return {
              weeklyDownloads: downloadsResponse.data.downloads || 0,
              lastPublish: response.data.time && response.data.time.modified
            };
          }
        } catch (error) {
          // Try next possible name
        }
      }
    } catch (error) {
      // npm package not found or error
    }
    
    return null;
  }

  async fetchIssueActivity(plugin) {
    try {
      const issuesUrl = `${CONFIG.github.baseUrl}/repos/${plugin.owner}/${plugin.repo}/issues`;
      const response = await axios.get(issuesUrl, {
        headers: CONFIG.github.headers,
        params: {
          state: 'all',
          sort: 'updated',
          per_page: 10
        }
      });
      
      this.updateRateLimits(response.headers);
      
      if (response.data && response.data.length > 0) {
        const recentIssues = response.data.filter(issue => {
          const daysSinceUpdate = differenceInDays(new Date(), new Date(issue.updated_at));
          return daysSinceUpdate <= 180; // Issues updated in last 6 months
        });
        
        const hasRecentActivity = recentIssues.length > 0;
        const activityScore = hasRecentActivity ? 
          Math.min(100, (recentIssues.length / 5) * 100) : 0;
        
        return {
          hasRecentActivity,
          activityScore
        };
      }
      
      return { hasRecentActivity: false, activityScore: 0 };
      
    } catch (error) {
      return null;
    }
  }

  calculateRecentCommitScore(lastCommitDate) {
    if (!lastCommitDate) return 0;
    
    const daysSinceCommit = differenceInDays(new Date(), new Date(lastCommitDate));
    
    if (daysSinceCommit <= 30) return 100;
    if (daysSinceCommit <= 90) return 85;
    if (daysSinceCommit <= 180) return 70;
    if (daysSinceCommit <= 365) return 50;
    if (daysSinceCommit <= 730) return 25;
    
    return 0;
  }

  calculateDownloadScore(weeklyDownloads) {
    if (!weeklyDownloads) return 0;
    
    if (weeklyDownloads >= 10000) return 100;
    if (weeklyDownloads >= 1000) return 85;
    if (weeklyDownloads >= 100) return 70;
    if (weeklyDownloads >= 10) return 50;
    if (weeklyDownloads >= 1) return 25;
    
    return 0;
  }

  calculateStarsScore(stars) {
    if (!stars) return 0;
    
    if (stars >= 100) return 100;
    if (stars >= 50) return 85;
    if (stars >= 20) return 70;
    if (stars >= 10) return 50;
    if (stars >= 5) return 25;
    
    return 10;
  }

  calculateOverallScore(scores) {
    const weights = CONFIG.scoring.weights;
    let totalScore = 0;
    let totalWeight = 0;
    
    for (const [key, weight] of Object.entries(weights)) {
      if (scores[key] !== undefined) {
        totalScore += scores[key] * weight;
        totalWeight += weight;
      }
    }
    
    return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
  }

  getHealthIndicator(lastCommitDate, isArchived) {
    if (isArchived) return '📁'; // Archived
    if (!lastCommitDate) return '⚪'; // Unknown
    
    const daysSinceCommit = differenceInDays(new Date(), new Date(lastCommitDate));
    const yearsSinceCommit = daysSinceCommit / 365;
    
    if (yearsSinceCommit <= 2) return '🟢'; // Up-to-date
    if (yearsSinceCommit <= 5) return '🟡'; // Needing attention
    return '🔴'; // Uncertain (>5 years)
  }

  async generateUpdatedMarkdown() {
    console.log('\n📝 Generating updated PLUGINS.md...');
    
    // Core plugins (maintained by Metalsmith org)
    const corePlugins = [];
    
    // New plugins that were just added (no health check yet)
    const newPlugins = [];
    
    // Group plugins by health status
    const upToDate = [];
    const needingAttention = [];
    const uncertain = [];
    const archived = [];
    const unknown = [];
    
    for (const plugin of this.plugins) {
      // New plugins from "New Plugins" section will be analyzed and categorized normally
      
      const health = this.healthData.get(plugin.name);
      if (!health) {
        unknown.push(plugin);
        continue;
      }
      
      const entry = {
        ...plugin,
        health,
        displayName: `${health.healthIndicator} [${plugin.name}](${plugin.url})`
      };
      
      // Check if it's a core plugin (github.com/metalsmith/...)
      const isCorePlugin = plugin.owner === 'metalsmith';
      
      if (isCorePlugin) {
        entry.displayName = `[${plugin.name}](${plugin.url})`; // No health indicator for core plugins
        corePlugins.push(entry);
      } else {
        switch (health.healthIndicator) {
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
    
    // New plugins section will be empty after health check (all plugins get categorized)
    
    // Add core plugins section
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
    
    markdown += '## Community Plugins\n\n';\n    markdown += '### Health Indicators\n\n';
    markdown += '- 🟢 **Up-to-date**: Updated within the last 2 years\n';
    markdown += '- 🟡 **Needing attention**: Updated 2-5 years ago\n';
    markdown += '- 🔴 **Uncertain**: Updated more than 5 years ago\n';
    markdown += '- 📁 **Archived**: Repository is archived\n';
    markdown += '- ⚪ **Unknown**: Unable to determine status\n\n';
    markdown += `*Last updated: ${new Date().toISOString().split('T')[0]}*\n\n`;
    markdown += '---\n\n';
    
    // Add community plugins by category
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
    
    // Add statistics (excluding core plugins from percentages)
    const communityPlugins = this.plugins.length - corePlugins.length;
    markdown += '## Statistics\n\n';
    markdown += `- Total plugins: ${this.plugins.length}\n`;
    markdown += `- Core plugins: ${corePlugins.length}\n`;
    markdown += `- Community plugins: ${communityPlugins}\n\n`;
    markdown += '### Community Plugin Health\n';
    if (communityPlugins > 0) {
      markdown += `- Up-to-date: ${upToDate.length} (${Math.round(upToDate.length / communityPlugins * 100)}%)\n`;
      markdown += `- Needing attention: ${needingAttention.length} (${Math.round(needingAttention.length / communityPlugins * 100)}%)\n`;
      markdown += `- Uncertain: ${uncertain.length} (${Math.round(uncertain.length / communityPlugins * 100)}%)\n`;
      markdown += `- Archived: ${archived.length} (${Math.round(archived.length / communityPlugins * 100)}%)\n`;
      markdown += `- Unknown: ${unknown.length} (${Math.round(unknown.length / communityPlugins * 100)}%)\n`;
    }
    
    // Write updated file
    await fs.writeFile('PLUGINS.md', markdown);
    
    // Also save detailed health data as JSON for debugging
    const healthReport = {
      timestamp: new Date().toISOString(),
      totalPlugins: this.plugins.length,
      statistics: {
        upToDate: upToDate.length,
        needingAttention: needingAttention.length,
        uncertain: uncertain.length,
        archived: archived.length,
        unknown: unknown.length
      },
      plugins: Array.from(this.healthData.values())
    };
    
    await fs.writeFile(
      'plugin-health-report.json',
      JSON.stringify(healthReport, null, 2)
    );
    
    console.log('✅ PLUGINS.md updated successfully');
    console.log(`📊 Detailed report saved to plugin-health-report.json`);
  }

  updateRateLimits(headers) {
    if (headers['x-ratelimit-remaining']) {
      this.rateLimitRemaining = parseInt(headers['x-ratelimit-remaining']);
    }
    if (headers['x-ratelimit-reset']) {
      this.rateLimitReset = new Date(parseInt(headers['x-ratelimit-reset']) * 1000);
    }
    
    if (this.rateLimitRemaining !== null && this.rateLimitRemaining < 10) {
      console.log(`⚠️  GitHub rate limit low: ${this.rateLimitRemaining} requests remaining`);
      
      // If we're about to hit the limit, pause until reset
      if (this.rateLimitRemaining <= 1 && this.rateLimitReset) {
        const waitTime = this.rateLimitReset - new Date();
        if (waitTime > 0) {
          const minutes = Math.ceil(waitTime / 60000);
          console.log(`⏸️  Rate limit exhausted. Waiting ${minutes} minutes until reset...`);
          return this.delay(waitTime + 1000); // Add 1 second buffer
        }
      }
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run the analyzer
const analyzer = new PluginHealthAnalyzer();
analyzer.run();
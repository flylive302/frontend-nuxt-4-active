#!/usr/bin/env node

/**
 * Nuxt 4 Commit Message Generator - Exact Format
 * Produces deterministic, structured commit messages following strict user-specified format
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// ===== CONFIGURATION =====
const NUXT_SCOPE_MAP = {
  'app/pages/': 'pages',
  'app/components/': 'components',
  'app/layouts/': 'layouts',
  'app/composables/': 'composables',
  'stores/': 'stores',
  'app/plugins/': 'plugins',
  'app/middleware/': 'middleware',
  'app.vue': 'app',
  'error.vue': 'app',
  'app.config.ts': 'app',
  'nuxt.config': 'build',
  'server/': 'server',
  'app/assets/': 'assets',
  'public/': 'assets',
  'i18n/': 'i18n',
  'tests/': 'testing',
  'e2e/': 'testing',
  'scripts/': 'ci',
  '.github/': 'ci',
  '.kiro/': 'ci',
  'package.json': 'deps',
  'package-lock.json': 'deps',
  '.nvmrc': 'deps',
  '.npmrc': 'deps',
};

const SCOPE_PRIORITY = [
  'pages', 'components', 'stores', 'composables', 'server', 'plugins',
  'layouts', 'middleware', 'app', 'build', 'pwa', 'twa', 'i18n',
  'testing', 'deps', 'ci', 'chore'
];

const TYPE_PRIORITY = [
  'fix', 'feat', 'refactor', 'perf', 'build', 'test', 'docs', 'style', 'ci', 'chore'
];

// ===== UTILITY FUNCTIONS =====
function exec(command, options = {}) {
  try {
    const result = execSync(command, { 
      encoding: 'utf8', 
      stdio: ['ignore', 'pipe', 'pipe'], 
      shell: '/bin/bash',
      ...options 
    });
    return result ? result.trim() : null;
  } catch (error) {
    // Return stderr output if command failed but produced output
    if (error.stderr) {
      try {
        return error.stderr.toString().trim();
      } catch (e) {
        return null;
      }
    }
    return null;
  }
}

function getGitChanges() {
  const staged = exec('git diff --staged --name-status') || exec('git diff --name-status') || '';
  const diff = exec('git diff --staged --unified=0') || exec('git diff --unified=0') || '';
  
  const files = staged.split('\n').filter(Boolean).map(line => {
    const [status, ...pathParts] = line.split('\t');
    return { status, path: pathParts.join('\t') };
  }).filter(f => f.status && f.path);

  return { files, diff };
}

function classifyFile(filePath) {
  for (const [pattern, scope] of Object.entries(NUXT_SCOPE_MAP)) {
    if (filePath.includes(pattern) || filePath.startsWith(pattern)) {
      return scope;
    }
  }
  return 'chore';
}

function getDominantScope(files) {
  const scopeCounts = {};
  
  files.forEach(({ path: filePath }) => {
    const scope = classifyFile(filePath);
    scopeCounts[scope] = (scopeCounts[scope] || 0) + 1;
  });

  let maxCount = 0;
  let dominantScope = 'chore';
  
  for (const scope of SCOPE_PRIORITY) {
    if (scopeCounts[scope] > maxCount) {
      maxCount = scopeCounts[scope];
      dominantScope = scope;
    }
  }
  
  return dominantScope;
}

function inferType(files, diff) {
  const types = new Set();
  
  files.forEach(({ status, path: filePath }) => {
    // Test files
    if (filePath.includes('test') || filePath.includes('spec')) {
      types.add('test');
    }
    
    // Documentation
    if (filePath.endsWith('.md') || filePath.includes('docs/')) {
      types.add('docs');
    }
    
    // Config changes
    if (filePath.includes('nuxt.config') || filePath.includes('vite.config') || filePath.includes('tsconfig')) {
      types.add('build');
    }
    
    // CI/CD
    if (filePath.includes('.github') || filePath.includes('ci')) {
      types.add('ci');
    }
    
    // Dependencies
    if (filePath.includes('package.json') || filePath.includes('package-lock')) {
      types.add('deps');
    }
    
    // New files suggest feat
    if (status === 'A') {
      types.add('feat');
    }
    
    // Deleted files suggest refactor or chore
    if (status === 'D') {
      types.add('refactor');
    }
  });
  
  // Check diff for keywords
  if (diff) {
    const lowerDiff = diff.toLowerCase();
    if (lowerDiff.includes('fix') || lowerDiff.includes('bug') || lowerDiff.includes('error')) types.add('fix');
    if (lowerDiff.includes('todo') || lowerDiff.includes('fixme')) types.add('fix');
    if (lowerDiff.includes('performance') || lowerDiff.includes('optimize') || lowerDiff.includes('perf')) types.add('perf');
    if (lowerDiff.includes('refactor') || lowerDiff.includes('restructure')) types.add('refactor');
  }
  
  // Default to feat if adding files, refactor if modifying, chore otherwise
  if (types.size === 0) {
    const hasNew = files.some(f => f.status === 'A');
    types.add(hasNew ? 'feat' : 'refactor');
  }
  
  // Return highest priority type
  for (const type of TYPE_PRIORITY) {
    if (types.has(type)) return type;
  }
  
  return 'chore';
}

function generateChanges(files) {
  const changes = [];
  const grouped = {};
  
  files.forEach(({ status, path: filePath }) => {
    const scope = classifyFile(filePath);
    if (!grouped[scope]) grouped[scope] = [];
    grouped[scope].push({ status, path: filePath });
  });
  
  // Generate detailed changes list
  const scopeVerbs = {
    'A': 'Added',
    'M': 'Updated',
    'D': 'Removed',
    'R': 'Renamed',
    'C': 'Copied'
  };
  
  files.forEach(({ status, path: filePath }) => {
    const verb = scopeVerbs[status] || 'Modified';
    const scope = classifyFile(filePath);
    
    // Extract component/page/composable name
    const fileName = path.basename(filePath, path.extname(filePath));
    const dirName = path.dirname(filePath);
    
    let changeText = '';
    if (status === 'A') {
      if (filePath.includes('components/')) {
        changeText = `Added ${fileName} component`;
      } else if (filePath.includes('pages/')) {
        changeText = `Added ${fileName} page`;
      } else if (filePath.includes('composables/')) {
        changeText = `Added ${fileName} composable`;
      } else if (filePath.includes('stores/')) {
        changeText = `Added ${fileName} store`;
      } else if (filePath.includes('plugins/')) {
        changeText = `Added ${fileName} plugin`;
      } else if (filePath.includes('server/api/')) {
        changeText = `Added ${fileName} API endpoint`;
      } else {
        changeText = `${verb} ${filePath}`;
      }
    } else if (status === 'D') {
      changeText = `${verb} ${filePath}`;
    } else if (status === 'M') {
      if (filePath.includes('components/')) {
        changeText = `Updated ${fileName} component`;
      } else if (filePath.includes('pages/')) {
        changeText = `Updated ${fileName} page`;
      } else if (filePath.includes('composables/')) {
        changeText = `Updated ${fileName} composable`;
      } else if (filePath.includes('stores/')) {
        changeText = `Updated ${fileName} store`;
      } else if (filePath.includes('plugins/')) {
        changeText = `Updated ${fileName} plugin`;
      } else if (filePath.includes('server/api/')) {
        changeText = `Updated ${fileName} API endpoint`;
      } else if (filePath.includes('nuxt.config')) {
        changeText = `Updated nuxt.config.ts`;
      } else if (filePath.includes('app.config')) {
        changeText = `Updated app.config.ts`;
      } else {
        changeText = `${verb} ${filePath}`;
      }
    } else {
      changeText = `${verb} ${filePath}`;
    }
    
    changes.push(changeText);
  });
  
  // Remove duplicates
  return [...new Set(changes)];
}

function getDependencyChanges() {
  const stagedDiff = exec('git diff --staged package.json') || '';
  const unstagedDiff = exec('git diff package.json') || '';
  const diff = stagedDiff || unstagedDiff;
  
  if (!diff) return 'No dependency changes';
  
  const changes = [];
  const lines = diff.split('\n');
  let inDependencies = false;
  let inDevDependencies = false;
  
  const packageChanges = {
    added: [],
    updated: [],
    removed: []
  };
  
  lines.forEach(line => {
    if (line.includes('"dependencies"')) {
      inDependencies = true;
      inDevDependencies = false;
      return;
    }
    if (line.includes('"devDependencies"')) {
      inDependencies = false;
      inDevDependencies = true;
      return;
    }
    if (line.includes('}') && (inDependencies || inDevDependencies)) {
      inDependencies = false;
      inDevDependencies = false;
      return;
    }
    
    if (line.startsWith('+') && !line.startsWith('+++') && (inDependencies || inDevDependencies)) {
      const match = line.match(/"([^"]+)":\s*"([^"]+)"/);
      if (match) {
        const [, name, version] = match;
        // Check if this is an update
        const removedLine = lines.find(l => l.startsWith('-') && l.includes(`"${name}"`));
        if (removedLine) {
          const oldMatch = removedLine.match(/"([^"]+)":\s*"([^"]+)"/);
          if (oldMatch) {
            packageChanges.updated.push(`${name} ${oldMatch[2]} → ${version}`);
          }
        } else {
          packageChanges.added.push(`${name}@${version}`);
        }
      }
    }
    if (line.startsWith('-') && !line.startsWith('---') && (inDependencies || inDevDependencies)) {
      const match = line.match(/"([^"]+)":\s*"([^"]+)"/);
      if (match) {
        const [, name] = match;
        // Only add to removed if not already in updated
        if (!packageChanges.updated.some(u => u.startsWith(name))) {
          packageChanges.removed.push(name);
        }
      }
    }
  });
  
  const deps = [];
  if (packageChanges.added.length) deps.push(`Added: ${packageChanges.added.join(', ')}`);
  if (packageChanges.updated.length) deps.push(`Updated: ${packageChanges.updated.join(', ')}`);
  if (packageChanges.removed.length) deps.push(`Removed: ${packageChanges.removed.join(', ')}`);
  
  return deps.length ? deps.join('; ') : 'No dependency changes';
}

function runQA() {
  const qa = {
    tests: 'N/A',
    lint: 'N/A',
    build: 'N/A',
    typecheck: 'N/A',
    docs: 'N/A'
  };
  
  // Tests
  try {
    const testResult = exec('npm run test 2>&1', { maxBuffer: 10 * 1024 * 1024 });
    if (testResult) {
      const passMatch = testResult.match(/(\d+)\s+passed/i);
      const failMatch = testResult.match(/(\d+)\s+failed/i);
      const totalMatch = testResult.match(/(\d+)\s+total/i);
      const coverageMatch = testResult.match(/(\d+\.?\d*)%/);
      
      if (passMatch && totalMatch) {
        const passed = parseInt(passMatch[1]);
        const total = parseInt(totalMatch[1]);
        const coverage = coverageMatch ? `${coverageMatch[1]}%` : 'coverage N/A';
        qa.tests = `${passed}/${total} passed (${coverage})`;
      } else if (passMatch) {
        const passed = parseInt(passMatch[1]);
        qa.tests = `${passed}/${passed} passed (coverage N/A)`;
      }
    }
  } catch (e) {
    // Ignore
  }
  
  // Lint
  try {
    const lintResult = exec('npm run lint 2>&1', { maxBuffer: 10 * 1024 * 1024 });
    if (lintResult !== null) {
      const errorMatches = lintResult.match(/(\d+)\s+error/gi) || [];
      const warningMatches = lintResult.match(/(\d+)\s+warning/gi) || [];
      
      let errors = 0;
      let warnings = 0;
      
      errorMatches.forEach(m => {
        const num = parseInt(m.match(/(\d+)/)[1]);
        errors += num;
      });
      
      warningMatches.forEach(m => {
        const num = parseInt(m.match(/(\d+)/)[1]);
        warnings += num;
      });
      
      // Also count individual error/warning lines if no numbers found
      if (errors === 0 && warnings === 0) {
        const errorLines = (lintResult.match(/error/gi) || []).length;
        const warningLines = (lintResult.match(/warning/gi) || []).length;
        errors = errorLines > 0 ? errorLines : 0;
        warnings = warningLines > 0 ? warningLines : 0;
      }
      
      qa.lint = `${errors} errors, ${warnings} warnings`;
    }
  } catch (e) {
    // Ignore
  }
  
  // Build
  try {
    const buildResult = exec('npm run build 2>&1', { maxBuffer: 10 * 1024 * 1024 });
    if (buildResult !== null) {
      const hasError = buildResult.toLowerCase().includes('error') || 
                       buildResult.includes('failed') ||
                       buildResult.includes('Failed');
      
      if (hasError) {
        qa.build = 'Failed';
      } else {
        const warningMatches = buildResult.match(/(\d+)\s+warning/gi) || [];
        const warnings = warningMatches.length > 0 ? warningMatches.length : 0;
        qa.build = `Success (${warnings} warnings)`;
      }
    }
  } catch (e) {
    // Ignore - build might fail but we still want to report
    qa.build = 'Failed';
  }
  
  // Typecheck
  try {
    const tscResult = exec('npx tsc --noEmit 2>&1', { maxBuffer: 10 * 1024 * 1024 });
    if (tscResult !== null) {
      const errorMatch = tscResult.match(/Found (\d+) error/);
      if (errorMatch) {
        qa.typecheck = `${errorMatch[1]} errors`;
      } else if (tscResult.includes('error')) {
        const errorCount = (tscResult.match(/error TS\d+/g) || []).length;
        qa.typecheck = errorCount > 0 ? `${errorCount} errors` : 'Clean';
      } else {
        qa.typecheck = 'Clean';
      }
    }
  } catch (e) {
    // Typecheck failed, try to extract error count
    try {
      const tscResult = exec('npx tsc --noEmit 2>&1', { maxBuffer: 10 * 1024 * 1024 });
      if (tscResult) {
        const errorCount = (tscResult.match(/error TS\d+/g) || []).length;
        qa.typecheck = errorCount > 0 ? `${errorCount} errors` : 'Clean';
      }
    } catch (e2) {
      qa.typecheck = 'N/A';
    }
  }
  
  // Documentation
  const hasReadme = fs.existsSync('README.md');
  const hasDocs = fs.existsSync('docs') || fs.existsSync('.kiro');
  qa.docs = (hasReadme || hasDocs) ? 'Updated' : 'N/A';
  
  return qa;
}

function getBranch() {
  return exec('git rev-parse --abbrev-ref HEAD') || 'unknown';
}

function findRelatedDocs() {
  const docs = [];
  if (fs.existsSync('.kiro')) {
    try {
      const kiroFiles = exec('find .kiro -name "*.md" -type f 2>/dev/null') || '';
      if (kiroFiles) {
        docs.push(...kiroFiles.split('\n').filter(Boolean));
      }
    } catch (e) {
      // Ignore
    }
  }
  if (fs.existsSync('docs')) {
    try {
      const docFiles = exec('find docs -name "*.md" -type f 2>/dev/null') || '';
      if (docFiles) {
        docs.push(...docFiles.split('\n').filter(Boolean));
      }
    } catch (e) {
      // Ignore
    }
  }
  return docs.length ? docs.join(', ') : 'N/A';
}

function generateShortDescription(files, type, scope) {
  if (files.length === 0) return 'update project files';
  
  const added = files.filter(f => f.status === 'A');
  const modified = files.filter(f => f.status === 'M');
  const removed = files.filter(f => f.status === 'D');
  
  if (type === 'feat') {
    if (added.some(f => f.path.includes('components/'))) {
      return 'add new components';
    } else if (added.some(f => f.path.includes('pages/'))) {
      return 'add new pages';
    } else if (added.some(f => f.path.includes('composables/'))) {
      return 'add new composables';
    } else {
      return 'add new features';
    }
  } else if (type === 'fix') {
    return 'fix bugs and resolve issues';
  } else if (type === 'refactor') {
    if (removed.length > 0) {
      return 'refactor and remove unused code';
    } else {
      return 'refactor internal structure';
    }
  } else if (type === 'perf') {
    return 'optimize performance and bundle size';
  } else if (type === 'build') {
    return 'update build configuration';
  } else if (type === 'test') {
    return 'add and update tests';
  } else if (type === 'docs') {
    return 'update documentation';
  } else if (type === 'ci') {
    return 'update CI configuration';
  } else {
    return 'update project files';
  }
}

function inferPerformanceImpact(files, diff) {
  const perfKeywords = ['optimize', 'performance', 'bundle', 'lazy', 'code-split', 'memo', 'cache'];
  const degradeKeywords = ['import.*\*', 'require.*\*'];
  
  if (!diff) return 'Neutral';
  
  const lowerDiff = diff.toLowerCase();
  const hasPerfKeywords = perfKeywords.some(kw => lowerDiff.includes(kw));
  
  if (hasPerfKeywords) {
    return 'Improved';
  }
  
  // Check for bundle size changes
  if (diff.includes('import') && diff.match(/import.*from.*['"]/g)?.length > 10) {
    return 'Neutral';
  }
  
  return 'Neutral';
}

function inferBreakingChanges(files, diff) {
  if (!diff) return 'None';
  
  const breakingKeywords = ['breaking', 'BREAKING', 'remove', 'deprecated', 'migration'];
  const lowerDiff = diff.toLowerCase();
  
  if (breakingKeywords.some(kw => lowerDiff.includes(kw))) {
    // Try to extract what broke
    const breakingMatch = diff.match(/breaking[:\s]+([^\n]+)/i);
    if (breakingMatch) {
      return breakingMatch[1].trim();
    }
    return 'See diff for breaking changes';
  }
  
  // Check for API changes
  const apiFiles = files.filter(f => f.path.includes('server/api/') || f.path.includes('composables/'));
  if (apiFiles.length > 0 && diff.includes('export')) {
    // Could be breaking but default to None unless explicit
    return 'None';
  }
  
  return 'None';
}

// ===== MAIN GENERATOR =====
function generateCommitMessage() {
  const { files, diff } = getGitChanges();
  
  if (files.length === 0) {
    console.error('No changes detected. Stage your changes first.');
    process.exit(1);
  }
  
  const scope = getDominantScope(files);
  const type = inferType(files, diff);
  const changes = generateChanges(files);
  const deps = getDependencyChanges();
  const qa = runQA();
  const branch = getBranch();
  const related = findRelatedDocs();
  const shortDesc = generateShortDescription(files, type, scope);
  const perfImpact = inferPerformanceImpact(files, diff);
  const breakingChanges = inferBreakingChanges(files, diff);
  
  // Build commit message in EXACT format specified
  const message = `${type}(${scope}): ${shortDesc}

Changes:

${changes.map(c => `• ${c}`).join('\n')}

Quality Assurance:

Tests: ${qa.tests}
Lint: ${qa.lint}
Build: ${qa.build}
Typecheck: ${qa.typecheck}
Documentation: ${qa.docs}

Impact:

• Performance: ${perfImpact} – ${perfImpact === 'Improved' ? 'optimized code paths and reduced bundle size' : perfImpact === 'Degraded' ? 'additional dependencies or complexity added' : 'no significant performance changes'}
• Breaking Changes: ${breakingChanges}
• Dependencies: ${deps}

Context:

• Branch: ${branch}
• Related: ${related}
• Implements/Previous/Strategy: ${changes.length > 0 ? 'Incremental development following Nuxt 4 conventions' : 'Maintenance and updates'}`;

  return message;
}

// ===== EXECUTION =====
try {
  const message = generateCommitMessage();
  console.log(message);
} catch (error) {
  console.error('Error generating commit message:', error.message);
  process.exit(1);
}


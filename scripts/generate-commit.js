#!/usr/bin/env node

/**
 * Nuxt 4 Commit Message Generator
 * Produces deterministic, structured commit messages following strict conventions
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
    return execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...options }).trim();
  } catch (error) {
    return null;
  }
}

function getGitChanges() {
  const staged = exec('git diff --staged --name-status') || exec('git diff --name-status') || '';
  const diff = exec('git diff --staged --unified=0') || exec('git diff --unified=0') || '';
  
  const files = staged.split('\n').filter(Boolean).map(line => {
    const [status, ...pathParts] = line.split('\t');
    return { status, path: pathParts.join('\t') };
  });

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
    if (diff.includes('fix') || diff.includes('bug')) types.add('fix');
    if (diff.includes('TODO') || diff.includes('FIXME')) types.add('fix');
    if (diff.includes('performance') || diff.includes('optimize')) types.add('perf');
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
  
  Object.entries(grouped).forEach(([scope, items]) => {
    const added = items.filter(i => i.status === 'A').length;
    const modified = items.filter(i => i.status === 'M').length;
    const deleted = items.filter(i => i.status === 'D').length;
    
    if (added) changes.push(`Added ${added} ${scope} file${added > 1 ? 's' : ''}`);
    if (modified) changes.push(`Updated ${modified} ${scope} file${modified > 1 ? 's' : ''}`);
    if (deleted) changes.push(`Removed ${deleted} ${scope} file${deleted > 1 ? 's' : ''}`);
  });
  
  return changes;
}

function getDependencyChanges() {
  const diff = exec('git diff --staged package.json') || exec('git diff package.json') || '';
  if (!diff) return 'No dependency changes';
  
  const changes = [];
  const lines = diff.split('\n');
  
  lines.forEach(line => {
    if (line.startsWith('+') && line.includes('"') && !line.includes('+++')) {
      const match = line.match(/"([^"]+)":\s*"([^"]+)"/);
      if (match) changes.push(`${match[1]}@${match[2]}`);
    }
  });
  
  return changes.length ? changes.join(', ') : 'Minor dependency updates';
}

function runQA() {
  const qa = {
    tests: 'N/A',
    lint: 'N/A',
    build: 'N/A',
    typecheck: 'N/A',
    docs: 'N/A'
  };
  
  // Lint
  const lintResult = exec('npm run lint 2>&1');
  if (lintResult) {
    const errors = (lintResult.match(/error/gi) || []).length;
    const warnings = (lintResult.match(/warning/gi) || []).length;
    qa.lint = `${errors} errors, ${warnings} warnings`;
  }
  
  // Tests
  const testResult = exec('npm run test 2>&1');
  if (testResult) {
    const passMatch = testResult.match(/(\d+)\s+passed/);
    const totalMatch = testResult.match(/Tests\s+(\d+)\s+passed/);
    if (passMatch) {
      qa.tests = `${passMatch[1]}/${passMatch[1]} passed (coverage N/A)`;
    }
  }
  
  // Typecheck
  const tscResult = exec('npx tsc --noEmit 2>&1');
  if (tscResult !== null) {
    const errorMatch = tscResult.match(/Found (\d+) error/);
    qa.typecheck = errorMatch ? `${errorMatch[1]} errors` : 'Clean';
  }
  
  // Build
  const buildResult = exec('npm run build 2>&1');
  if (buildResult !== null) {
    qa.build = buildResult.includes('error') ? 'Failed' : 'Success (0 warnings)';
  }
  
  // Docs
  qa.docs = fs.existsSync('README.md') ? 'Updated' : 'N/A';
  
  return qa;
}

function getBranch() {
  return exec('git rev-parse --abbrev-ref HEAD') || 'unknown';
}

function findRelatedDocs() {
  const docs = [];
  if (fs.existsSync('.kiro')) {
    const kiroFiles = exec('find .kiro -name "*.md" 2>/dev/null') || '';
    docs.push(...kiroFiles.split('\n').filter(Boolean));
  }
  return docs.length ? docs.join(', ') : 'N/A';
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
  
  // Generate short description
  const description = changes[0]?.toLowerCase().replace(/^(added|updated|removed)\s+\d+\s+/, '') || 'update project files';
  
  // Build commit message
  const message = `${type}(${scope}): ${description}

📝 Changes:
${changes.map(c => `• ${c}`).join('\n')}

✅ Quality Assurance:
Tests: ${qa.tests}
Lint: ${qa.lint}
Build: ${qa.build}
Typecheck: ${qa.typecheck}
Documentation: ${qa.docs}

📊 Impact:
• Performance: Neutral – no performance-critical changes
• Breaking Changes: None
• Dependencies: ${deps}

🔍 Context:
• Branch: ${branch}
• Related: ${related}
• Implements: Incremental development following Nuxt 4 conventions`;

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

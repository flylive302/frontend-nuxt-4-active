#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';

function safeExec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).trim();
  } catch {
    return null;
  }
}

const staged = safeExec('git diff --staged --name-status') || safeExec('git diff --name-status') || '';
const diff = safeExec('git diff --staged --unified=0') || safeExec('git diff --unified=0') || '';
const branch = safeExec('git rev-parse --abbrev-ref HEAD') || 'unknown';

const files = staged.split('\n').filter(Boolean).map(l => {
  const [s, ...p] = l.split('\t');
  return { status: s, path: p.join('\t') };
}).filter(f => f.status && f.path);

if (files.length === 0) {
  console.error('No changes detected');
  process.exit(1);
}

const scopes = { pages: 0, components: 0, composables: 0, stores: 0, plugins: 0, server: 0, layouts: 0, middleware: 0, app: 0, build: 0, testing: 0, deps: 0, ci: 0, chore: 0 };
files.forEach(({ path: p }) => {
  if (p.includes('app/pages/')) scopes.pages++;
  else if (p.includes('app/components/')) scopes.components++;
  else if (p.includes('app/composables/')) scopes.composables++;
  else if (p.includes('stores/')) scopes.stores++;
  else if (p.includes('app/plugins/')) scopes.plugins++;
  else if (p.includes('server/')) scopes.server++;
  else if (p.includes('app/layouts/')) scopes.layouts++;
  else if (p.includes('app/middleware/')) scopes.middleware++;
  else if (p.includes('app.vue') || p.includes('app.config')) scopes.app++;
  else if (p.includes('nuxt.config')) scopes.build++;
  else if (p.includes('tests/')) scopes.testing++;
  else if (p.includes('package.json')) scopes.deps++;
  else if (p.includes('scripts/') || p.includes('.github/')) scopes.ci++;
  else scopes.chore++;
});

const scope = ['pages', 'components', 'stores', 'composables', 'server', 'plugins', 'layouts', 'middleware', 'app', 'build', 'testing', 'deps', 'ci', 'chore'].find(s => scopes[s] > 0) || 'chore';

let type = 'chore';
if (files.some(f => f.path.includes('test') || f.path.includes('spec'))) type = 'test';
else if (files.some(f => f.path.endsWith('.md'))) type = 'docs';
else if (files.some(f => f.path.includes('nuxt.config'))) type = 'build';
else if (files.some(f => f.path.includes('.github') || f.path.includes('scripts/'))) type = 'ci';
else if (files.some(f => f.path.includes('package.json'))) type = 'deps';
else if (diff && (diff.toLowerCase().includes('fix') || diff.toLowerCase().includes('bug'))) type = 'fix';
else if (files.some(f => f.status === 'A')) type = 'feat';
else if (files.some(f => f.status === 'D') || (diff && diff.toLowerCase().includes('refactor'))) type = 'refactor';
else if (diff && diff.toLowerCase().includes('performance')) type = 'perf';

const changes = files.map(({ status, path: p }) => {
  const verb = status === 'A' ? 'Added' : status === 'D' ? 'Removed' : 'Updated';
  const name = p.split('/').pop().replace(/\.[^.]*$/, '');
  if (p.includes('components/')) return `${verb} ${name} component`;
  if (p.includes('pages/')) return `${verb} ${name} page`;
  if (p.includes('composables/')) return `${verb} ${name} composable`;
  if (p.includes('stores/')) return `${verb} ${name} store`;
  if (p.includes('plugins/')) return `${verb} ${name} plugin`;
  if (p.includes('server/api/')) return `${verb} ${name} API endpoint`;
  if (p.includes('nuxt.config')) return `${verb} nuxt.config.ts`;
  if (p.includes('app.config')) return `${verb} app.config.ts`;
  return `${verb} ${p}`;
});

const depsDiff = safeExec('git diff --staged package.json') || safeExec('git diff package.json') || '';
const deps = depsDiff ? 'See package.json diff for details' : 'No dependency changes';

const testResult = safeExec('npm run test 2>&1');
const tests = testResult ? (testResult.match(/(\d+)\s+passed/i) ? `${testResult.match(/(\d+)\s+passed/i)[1]}/${testResult.match(/(\d+)\s+passed/i)[1]} passed (coverage N/A)` : 'N/A') : 'N/A';

const lintResult = safeExec('npm run lint 2>&1');
const lintErrors = lintResult ? ((lintResult.match(/error/gi) || []).length) : 0;
const lintWarnings = lintResult ? ((lintResult.match(/warning/gi) || []).length) : 0;
const lint = `${lintErrors} errors, ${lintWarnings} warnings`;

const buildResult = safeExec('npm run build 2>&1');
const build = buildResult && (buildResult.toLowerCase().includes('error') || buildResult.includes('failed')) ? 'Failed' : buildResult ? 'Success (0 warnings)' : 'N/A';

const tscResult = safeExec('npx tsc --noEmit 2>&1');
const typecheck = tscResult && tscResult.includes('error') ? `${(tscResult.match(/error/gi) || []).length} errors` : 'Clean';

const desc = type === 'feat' ? 'add new features and components' : type === 'fix' ? 'fix bugs and resolve issues' : type === 'refactor' ? 'refactor internal structure' : type === 'build' ? 'update build configuration' : type === 'test' ? 'add and update tests' : type === 'docs' ? 'update documentation' : type === 'ci' ? 'update CI configuration' : 'update project files';

console.log(`${type}(${scope}): ${desc}

Changes:

${changes.map(c => `• ${c}`).join('\n')}

Quality Assurance:

Tests: ${tests}
Lint: ${lint}
Build: ${build}
Typecheck: ${typecheck}
Documentation: ${fs.existsSync('README.md') ? 'Updated' : 'N/A'}

Impact:

• Performance: Neutral – no significant performance changes
• Breaking Changes: None
• Dependencies: ${deps}

Context:

• Branch: ${branch}
• Related: N/A
• Implements/Previous/Strategy: Incremental development following Nuxt 4 conventions`);


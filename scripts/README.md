# Commit Message Generator

Generates structured, deterministic commit messages for this Nuxt 4 project following strict conventions.

## Usage

```bash
# Generate commit message for staged changes
npm run commit

# Or run directly
node scripts/generate-commit.js

# Use with git commit
git commit -m "$(npm run commit --silent)"
```

## What It Does

1. **Analyzes Git Changes**: Scans staged files (or unstaged if nothing staged)
2. **Classifies Files**: Maps changes to Nuxt-aware scopes (pages, components, composables, etc.)
3. **Runs QA**: Executes lint, tests, typecheck, and build commands
4. **Extracts Dependencies**: Parses package.json changes
5. **Generates Message**: Produces a structured commit following the exact format

## Output Format

```
type(scope): short description

📝 Changes:
• Bullet list of changes

✅ Quality Assurance:
Tests: X/Y passed (coverage)
Lint: X errors, Y warnings
Build: Success/Failed
Typecheck: Clean/X errors
Documentation: Status

📊 Impact:
• Performance: Improved/Neutral/Degraded
• Breaking Changes: None or description
• Dependencies: Package updates

🔍 Context:
• Branch: branch-name
• Related: Links to specs/docs
• Implements: Context bullets
```

## Scope Classification

- `pages/**` → pages
- `components/**` → components
- `composables/**` → composables
- `stores/**` → stores
- `plugins/**` → plugins
- `server/**` → server
- `nuxt.config.*` → build
- `package.json` → deps
- `.github/**` → ci
- `tests/**` → testing

## Type Selection

Types are inferred deterministically:
- `feat` - New features, components, pages
- `fix` - Bug fixes, regressions
- `refactor` - Internal restructuring
- `perf` - Performance improvements
- `build` - Build config changes
- `test` - Test additions/updates
- `docs` - Documentation only
- `ci` - CI/CD changes
- `chore` - Maintenance tasks

## Requirements

- Node.js (project already has it)
- Git repository with changes
- npm scripts: `lint`, `test`, `build` (already configured)

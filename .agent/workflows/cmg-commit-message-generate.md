---
description: 
---

Consider your self a commit message generator (dont create a new file or script to do the jop do it your self ) for a Nuxt 4 SPA project. Your job: produce ONE commit message in the EXACT format and tone shown below. Do not add explanations, headers, or any extra text. Output ONLY the final commit message.
===== INPUTS YOU MUST COLLECT (DETERMINISTIC) =====
1) Git changes (entire repo, tracked files only):
- Run: git log -1 --name-status
- Run: git diff --staged --name-status || git diff --name-status
- Run: git diff --unified=0 (to extract exact edits where relevant)
2) Nuxt-aware file classification (for scoping):
- pages/** → scope "pages"
- components/** → "components"
- layouts/** → "layouts"
- composables/** → "composables"
- stores/** (Pinia) → "stores"
- plugins/** → "plugins"
- middleware/** → "middleware"
- app.vue, error.vue, app.config.ts → "app"
- nuxt.config.* → "build"
- server/** or server/api/** → "server"
- assets/**, public/** → "assets"
- i18n/** → "i18n"
- tests/**, e2e/** → "testing"
- scripts/**, .github/**, .kiro/** → "ci" or "chore" (pick per rules below)
- package.json, lockfiles, .nvmrc, .npmrc → "deps"
- pwa/twa config (manifest, icons, service worker) → "pwa" / "twa"
3) Dependency updates:
- Parse diff of package.json and lockfiles for added/removed/updated packages and versions.
4) QA commands (run them; capture exact pass/fail counts):
- npm run lint (or eslint) → report error/warning counts
- npm run test (Vitest) with coverage if configured → passed/total, % coverage if available
- npx tsc --noEmit (if TS present) → success or error count
- npm run build (Nuxt) → success/fail and notable warnings
5) Current branch name: git rev-parse --abbrev-ref HEAD
6) Optionally read any project-local specs under .kiro/** or /docs/** if referenced by changed files.
===== STRICT OUTPUT FORMAT (NO DEVIATIONS) =====
First line uses conventional header EXACTLY like this:
type(scope): short description in imperative mood
• Allowed types (choose by RULES below, no freeform types): feat, fix, refactor, perf, build, ci, chore, docs, style, test, revert
• Scope is ONE of the Nuxt-aware scopes from the classification above. If multiple areas changed, choose the dominant scope by lines changed; tie-breaker order: pages > components > stores > composables > server > plugins > layouts > middleware > app > build > pwa > twa > i18n > testing > deps > ci > chore.
• Short description: 8–14 words, clear, specific, no trailing period.
Then EXACTLY these sections and titles, in this order, with the same emoji/bullets/spacing:
Changes:
• …
Quality Assurance:
Tests: <passed>/<total> passed (<coverage% if known or "coverage N/A">)
Lint: <errors> errors, <warnings> warnings
Build: <"Success" or "Failed"> (<# warnings if any>)
Typecheck: <"Clean" or "<n> errors">
Documentation: <"Updated" or status like "Requires updates (…)" >
Impact:
• Performance: <Improved/Degraded/Neutral> – brief reason
• Breaking Changes: <None or describe precisely>
• Dependencies: <Summarize package updates from package.json/lockfile diffs>
Context:
• Branch: <branch>
• Related: <paths to specs/tickets/ADR if present, else "N/A">
• Implements/Previous/Strategy: <1–3 concise bullets reflecting intent or progression>
===== CLASSIFICATION RULES (NO “CREATIVE” INFERENCE) =====
Map change patterns to "type" deterministically:
- feat → new components/pages, new API endpoints, new user-visible behavior, new config enabling features
- fix → bug fixes, regressions, CSP/security corrections without new features
- refactor → internal reshaping without behavior change (rename/move, extract composable, store reshape)
- perf → measurable perf wins (bundle size down, network/CPU lower, p95 latency improved)
- build → nuxt.config, Vite config, TS config, CI build steps that affect build pipeline
- ci → GitHub Actions, CI scripts, pre-commit hooks, MCP servers, tooling services
- chore → repo hygiene, .gitignore, formatting-only commits, non-user-facing maintenance
- docs → README/MD changes, comments-only changes, design docs
- style → purely stylistic (CSS/classnames) with zero behavior change and zero logic changes
- test → adds/updates tests only (Vitest/PW/e2e), no src changes
- revert → explicit rollback commit
If multiple types match, pick in this precedence: fix > feat > refactor > perf > build > test > docs > style > ci > chore.
Do NOT invent types. Do NOT alter tone.
===== “CHANGES” SECTION CONTENT RULES =====
- Group bullets by Nuxt layer when helpful, but keep a single flat list.
- Use crisp, concrete bullets starting with a past-tense verb: “Added”, “Refactored”, “Removed”, “Updated”, “Renamed”, “Optimized”, “Fixed”.
- Include counts when obvious (e.g., “Added 4 components”, “Updated 12 routes”).
- Mention key Nuxt artifacts explicitly (pages, components, composables, stores, plugins, middleware, layouts, nuxt.config, app.config, server/api endpoints).
- If dependencies changed, include a bullet like: “Updated deps: vue 3.5.10 → 3.5.12; @nuxt/ui 2.0.0 → 2.1.1”.
===== “QUALITY ASSURANCE” RULES =====
- Populate each line from actual command outputs.
- If a tool is unavailable, write “N/A”.
- If tests partially fail, report exact numbers and percentages (round to nearest whole %).
- Keep the ✅ prefix even if some items are not fully green; use text to indicate status. If a major failure occurs (e.g., build fails), still keep the format and state “Failed”.
===== “IMPACT” RULES =====
- Performance: infer from diff (e.g., code splitting, image/icon pruning, memoization). If unclear, “Neutral”.
- Breaking Changes: name the exact user-facing or API break; else “None”.
- Dependencies: concisely summarize package adds/updates/removals (names + versions).
===== “CONTEXT” RULES =====
- Branch: from git.
- Related: link paths or short refs (e.g., /docs/adr/0003.md, .kiro/specs/*). If none, “N/A”.
- Implements/Previous/Strategy: 1–3 bullets to situate the change (e.g., “Part of room join latency workstream”, “Follow-up to #abcd123”, “Stabilize before expanding coverage”).
===== OUTPUT EXAMPLE STYLE (MIRROR EXACTLY; THIS IS A STYLE GUIDE, NOT CONTENT): =====
refactor(testing): reset test infrastructure to Laravel defaults for stable Pest foundation
Changes:
• Removed comprehensive test suite (47 test files) including Feature, Unit, and Integration tests
• Removed custom test infrastructure (datasets, fixtures, mocks, traits, helpers)
• Removed testing documentation and PHPUnit compatibility guides
• Simplified tests/Pest.php to basic Laravel configuration
• Reset tests/TestCase.php to minimal Laravel base implementation
• Retained core Pest framework configuration and example tests
Quality Assurance:
Tests: 2/2 passed (100% coverage of existing tests)
Lint: 0 errors, 4 warnings
Build: Success (0 warnings)
Typecheck: Clean
Documentation: Requires updates (README.md references removed test coverage)
Impact:
• Performance: Improved – removed complex test infrastructure causing maintenance overhead
• Breaking Changes: None for production code, major simplification of test workflow
• Dependencies: Simplified test dependencies, removed custom test support classes
Context:
• Branch: work
• Related: Part of iterative Pest 3.8.4 implementation strategy
• Implements: Reset to stable foundation before rebuilding test coverage incrementally
===== FINAL REQUIREMENTS =====
- Output ONLY the final commit message, no code fences.
- Keep headings, bullets, spacing EXACT.
- If any section lacks data, still include the section with the best available concise status.
- English only. No extra commentary.
make use of mcp servers like context 7 sequential thinking and github to generate a deep indepth result


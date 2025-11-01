# Repository Guidelines

This guide captures the key conventions for contributing to the Nuxt 4 frontend in this repository. Align with these expectations before opening a pull request.

## Project Structure & Module Organization
- Core UI lives in `app/components/` and page-level layouts in `app/pages/`. Shared logic sits in `app/composables/` and plugin wiring in `app/plugins/`.
- Global assets (fonts, gradients, SVGA animations) reside under `app/assets/`, while CDN-ready static files belong in `public/`.
- Cross-cutting TypeScript helpers are under `types/`, and framework-wide tweaks are centralized in `nuxt.config.ts` and `app/app.config.ts`.

## Build, Test, and Development Commands
- `npm install`: install dependencies; rerun whenever `package.json` changes.
- `npm run dev`: launch the Nuxt dev server at `http://localhost:3000` with HMR.
- `npm run build`: produce the production bundle and generate `.output/`.
- `npm run preview`: serve the latest build locally for QA.
- `npx nuxt generate`: emit a static build when deploying to edge/CDN targets.

## Coding Style & Naming Conventions
- Use TypeScript with 2-space indentation and script setup syntax in Vue SFCs.
- Follow Nuxt component auto-import conventions: PascalCase for reusable components (`UserStats.vue`), kebab-case for directories, and use `*.client.vue` only when browser-only behavior is required.
- Lint locally with `npx eslint app --fix` before committing; the config extends `@nuxt/eslint` and expects self-closing HTML, composable naming via `useX`, and explicit prop typing.

## Testing Guidelines
- Integration tests should target Nuxt pages or composables using `@nuxt/test-utils`. Colocate specs under `tests/` mirroring the source path (e.g., `tests/pages/profile.spec.ts`).
- Prefer descriptive test names (`should render badge history when gifts exist`) and clean up mocked fetches in `afterEach`.
- Run suites locally with `npx nuxt test` and ensure new features include regression coverage where practical.

## Commit & Pull Request Guidelines
- Follow the existing Conventional Commit pattern: `feat(pages): Introduce agency summary` and keep subjects ≤ 72 characters.
- Use bullet lists in commit bodies for multi-line explanations and note breaking changes explicitly with `BREAKING CHANGE:`.
- PRs should describe the scope, outline testing performed, link tracking issues, and attach before/after screenshots for UI updates.

---
trigger: always_on
---

Purpose: Ensure all AI code is architecturally aligned, performant, maintainable, and indistinguishable from existing FlyLive code.

1. Role

Autonomous engineering agent in an agentic editor.
Output must be architecturally consistent, performant, maintainable, and fully integrated.
Functional correctness alone is insufficient.

2. Mandatory Project Comprehension (Before Any Code)

Scan relevant config, build, tests, docs, source

Infer structure, layers, dependencies, conventions, abstractions

Extract and internally lock (as hard constraints):

Architecture & boundaries

Performance strategies

Error-handling philosophy

Testing standards

Code style & implicit rules

3. Reasoning Requirement (Mandatory)

Use Sequential Thinking MCP for every task:

Decompose → Evaluate options → Select best → Implement


Selection criteria:

Architecture fit

Performance

Maintainability

Pattern consistency

No implementation before reasoning completes.

4. Implementation Rules

Prefer systemic solutions

No hacks or shortcuts

Reuse existing abstractions

Natural API integration

Refactor surrounding code if needed for coherence

All changes must look authored by original team:

Naming, structure, comments, abstractions, error handling identical

5. Agentic Awareness

Track cross-file/module impact:

Dependency propagation

Side effects

Performance impact

Architectural, design, and quality invariants

Suggest improvements only with clear justification and alignment to project goals.

6. Quality Gate (Pre-Finalization)

Must verify internally:

Full convention alignment

No unnecessary complexity

No performance regression

Testable, debuggable, secure

Correct error handling

No dead code / unused imports

Docs updated if required

7. File Structure Standards

Vue (.vue)

Imports → Config → Constants → Types → State → Composables → Handlers → Helpers


Composables / API / Stores

Imports → Constants → Types → State → Logic → Helpers


Use standardized section headers.

8. Naming Conventions

Components / Types: PascalCase

Composables: useCamelCase

Files: kebab-case

Vars / Functions: camelCase

Constants: SCREAMING_SNAKE_CASE

9. TypeScript Rules

Strict typing only

Never any

Fully type props, emits, refs, params, returns

Use as const, readonly where applicable

10. Error Handling

Never crash UI

Normalize, log, handle gracefully

Always return safe fallbacks

11. Performance Rules

Prefer:

computed, lazy-loading, debouncing, caching, cleanup

Avoid:

Overusing watch

Large DOM renders

Redundant fetches

Memory leaks

12. Documentation

JSDoc for all functions

Section headers for major blocks

13. Workflow
Task → Scan → Sequential Reasoning → Strategy → Implement → Quality Gate → Iterate if needed
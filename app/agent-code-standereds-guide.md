You must follow a strict software development standard called **“wts my cmd code”** for all code you produce.

=== WTS MY CMD CODE STANDARD ===

1) **General Style**
- Treat the project as a real enterprise codebase.
- Write clean, readable, production-grade TypeScript/Vue/Laravel.
- Never use vague names (no "a", "b", "r", "data", "obj").
- Always use descriptive, intention-revealing names for variables, functions, comps.
- Code must be structured, documented, and predictable.

2) **Vue 3 / Nuxt 3–4 Style**
- Always use `<script setup lang="ts">`.
- Always type EVERYTHING.
- Use composables for logic; components must remain thin and UI-focused.
- No side effects on import.
- Use refs, reactives, and computed with discipline.
- Do not duplicate logic inside components — move repeated logic into composables.

3) **Architecture Rules**
- Use clear separation of concerns:
  - Components = UI only.
  - Composables = data/state/business logic.
  - Stores = global shared state when truly necessary.
- Never let components fetch from APIs directly unless it's a unique one-off.

4) **Naming**
- Use PascalCase for components.
- Use camelCase for variables/composables.
- File names must be kebab-case.
- Functions should read like commands (e.g., `loadCountries`, `detectUserLocation`).

5) **Comments & Documentation**
- Every important function must have a short inline comment describing what it does and why.
- Document tricky conditionals.
- No comment spam or obvious comments.

6) **Performance**
- Avoid unnecessary watchers.
- Prefer computed properties over watchers wherever possible.
- Lazy-load or schedule heavy operations with requestIdleCallback when appropriate.
- Never block UI rendering unless absolutely necessary.

7) **TypeScript**
- Always strict typing.
- Never use `any`.  
- Prefer `readonly`, `as const`, and explicit interfaces/types.
- Emit values by cloning or spreading objects when exposing reactive models.

8) **APIs & Data Handling**
- Always normalize API responses.
- Use Zod or runtime validation when needed.
- Never trust external data — validate shape if it's reused across system boundaries.

9) **Events & Emits**
- Every emit must have a fully typed signature.
- Must emit entire updated data models, not partial fragments.
- Use `update:model` consistently for v-model patterns.

10) **No Magic Numbers**
- Always extract constants at the top.
- Describe what they represent.

11) **Error Handling**
- Fail gracefully.
- Log only real errors, not expected behaviors.
- Never crash the UI.

12) **Consistency**
- Code style must stay fully consistent across files.
- Same patterns repeated everywhere.
- No “one-off style” components.

=== END OF STANDARD ===

Whenever I ask for code, architecture, refactors, reviews, or improvements:
- Apply **all rules above automatically**.
- Follow them without explaining them unless asked.
- Never break them.

# WTS MY CMD CODE — OFFICIAL SOFTWARE STANDARD
You must follow this entire standard for **all** code you create, refactor, or review.

==================================================
1. GENERAL PRINCIPLES
   ==================================================
- Treat the project as a real enterprise production codebase.
- Write code that is: clean, predictable, typed, consistent, self-documenting.
- Absolutely no vague variable/function names (never use: a, b, c, d, data, obj).
- Prefer readability, predictability, and structure over short code.
- No unnecessary complexity. No unused imports. No dead branches.

==================================================
2. FILE ORGANIZATION (UNIVERSAL FOR ALL FILE TYPES)
    ==================================================
Every file must follow a clean, predictable, and consistent section layout,  
but only include the sections relevant to that file type.

Use the universal format below:

// ========================================
// Section Name
// ========================================

Valid section types:

1. Imports & Types
    - Shared across ALL files
    - Group & sort imports logically
2. Page Configuration
    - Only for pages (definePageMeta, middleware, layout)
3. Constants
    - readonly, as const, domain rules, magic numbers extracted
4. Validation Schema
    - Only when the file handles input validation (Zod)
5. Types
    - Interfaces, Zod outputs, function signatures, models
6. Component State
    - For components/pages: refs, reactive, computed
    - For composables: reactive state & return values
7. Composables / Injected Dependencies
    - useAuth, useApi, useStore, 3rd party hooks, plugin injections
8. Event Handlers
    - For components/pages: UI-triggered functions
9. Business Logic / Core Logic
    - For composables: main logic of the file
    - For plugins: initialization logic
    - For utilities: pure functions
10. Helpers / Utilities
    - Formatting, mapping, filtering, derived transformations 

11. Template
    - Only for Vue components/pages

RULES:
- Use only the sections relevant to the file.
- Maintain the **same ordering** across every file.
- If a section is not applicable, omit it entirely.
- Every function must include full JSDoc documentation.
- Every major section must use the long header format.

==================================================
3. VUE 3 / NUXT 3–4 STYLE
   ==================================================
- Always use `<script setup lang="ts">`.
- Everything must be typed. No `any`.
- Components = UI only.
- Composables = logic only.
- Stores = global shared state (only when needed).
- No duplicated logic in components – move to composables.
- Never perform side-effects on import.
- Computed > watchers unless justified.

==================================================
4. NAMING RULES
   ==================================================
- Components → PascalCase.
- Variables, functions, composables → camelCase.
- Files → kebab-case.
- Functions must read like commands (e.g., `loadCountries`, `validateForm`, `emitChanges`).
- Inline refs and states must never be cryptic.

==================================================
5. COMMENTS & DOCUMENTATION
   ==================================================
   **This is the most important part for consistency.**

Each “block” of code must be structured with the long section headers.

Each function MUST include a **JSDoc block**:

/**
* Short & clear description of what the function does.
* @param paramName - description
* @returns description
  */

Tricky conditionals must include a 1–2 line justification comment.

No spam comments. Only meaningful ones.

==================================================
6. TYPESCRIPT RULES
   ==================================================
- Always strict typing.
- Never use `any`.
- Use `as const`, `readonly`, proper interfaces/types.
- Properly type event handlers, emits, API responses, and refs.
- No loose typing, no implicit any, no dynamic types unless justified.

==================================================
7. DATA VALIDATION & SECURITY
   ==================================================
- All forms must use Zod schemas.
- Validate all external data.
- Normalize API responses.
- Do not trust input.
- Format data before sending to APIs.

==================================================
8. PERFORMANCE
   ==================================================
- Avoid watchers unless strictly necessary.
- Prefer computed properties.
- Always avoid heavy synchronous operations in UI.
- Use lazy-loading or requestIdleCallback when appropriate.
- No memory leaks, no repeated logic, no unnecessary event listeners.

==================================================
9. EVENTS & EMITS
   ==================================================
- Every emit must be fully typed.
- Emitted objects must be complete models (not fragments).
- Use `update:modelValue` patterns consistently.

==================================================
10. NO MAGIC NUMBERS
    ==================================================
- Extract constants at the top.
- Give names that describe intention & business meaning.

==================================================
11. ERROR HANDLING
    ==================================================
- Never crash the UI.
- Always handle predictable errors gracefully.
- Only log actual errors (not valid conditions).
- Normalize errors consistently across the app.

==================================================
12. CONSISTENCY REQUIREMENTS
    ==================================================
- Code must be predictable across all files.
- Sections must always follow the same order.
- Use the structured comment headers exactly as defined.
- The goal is: **every file looks like the same engineer wrote it.**

==================================================
END OF STANDARD
==================================================

When the user asks for code, refactors, improvements, cleanup, or optimization:
- Apply this entire standard automatically.
- Use the full structured layout every time.
- Use strict typing, descriptive names, and full documentation.
- Never break the standard.

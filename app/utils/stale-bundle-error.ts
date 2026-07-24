/**
 * Stale-bundle error matcher — pure, framework-agnostic.
 *
 * Cloudflare Pages serves content-hashed chunks, so a deploy invalidates the
 * hashes an already-open tab knows about. The failure surfaces in more than one
 * shape, and the wording differs per engine, so the only reliable signal is the
 * message text. Extracted from `plugins/chunk-reload.client.ts` to keep it
 * unit-testable (the plugin itself is not), mirroring `utils/ota-gate.ts`.
 *
 * The distinction this draws is load-bearing in BOTH directions:
 *  - miss a stale-bundle error → the user dead-ends on a broken route;
 *  - match an application error → a reload loop the user cannot escape.
 * So this stays an explicit allowlist rather than anything fuzzier.
 */

/** Message fragments that mean "the bundle on disk no longer matches this tab". */
const STALE_BUNDLE_MESSAGES = [
  // vue-router: a lazy route component's import resolved empty. Reaches
  // `router.onError` only — Nuxt's `app:chunkError` never fires for it.
  "Couldn't resolve component",
  // Dynamic import failures, one phrasing per engine.
  'Failed to fetch dynamically imported module', // Chromium
  'error loading dynamically imported module', // Firefox
  'Importing a module script failed', // Safari
  // Vite preload of a chunk's stylesheet.
  'Unable to preload CSS',
  // Nuxt's route-MIDDLEWARE loader, not a component: it does
  // `await Vf[name]?.().then(E => E.default || E)`, so a stale import that
  // resolves `undefined` throws on `.default` instead of producing any of the
  // phrasings above (Sentry JAVASCRIPT-VUE-6G, iOS Safari + Chromium).
  //
  // Matching `.default` is deliberately narrow rather than fuzzy: `.default` is
  // an ES-module interop artifact that application code essentially never reads,
  // so this cannot swallow a normal app error. It is matched on the *property
  // name only* — the object identifier is minified and changes every build, so
  // anything including it would silently stop matching on the next deploy.
  "(reading 'default')", // Chromium
  ".default')", // Safari — "undefined is not an object (evaluating 'E.default')"
] as const;

/**
 * True when `error` indicates a stale bundle, i.e. a full reload against the
 * new manifest is the correct recovery.
 *
 * Accepts `unknown` because callers receive it from router/window error hooks,
 * which make no type guarantees.
 */
export function isStaleBundleError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return STALE_BUNDLE_MESSAGES.some((fragment) => message.includes(fragment));
}

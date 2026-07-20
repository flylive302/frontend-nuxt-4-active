// ========================================
// View Transition rejection handling
// ========================================
//
// The View Transitions spec rejects `ready` / `finished` as NORMAL control
// flow whenever a transition is skipped or aborted: tab hidden, rapid
// back-to-back navigations, skipTransition(), duplicate
// view-transition-name, or the DOM-update timeout. Nuxt's router
// integration exposes the ViewTransition but attaches no rejection
// handlers, so every skipped transition surfaced as an unhandled promise
// rejection (Sentry: AbortError / InvalidStateError / TimeoutError).
//
// Handling them here — at the source — is the correct treatment: a skipped
// transition falls back to an instant swap and the app is fully functional.
// Real DOM-update *callback* errors are NOT swallowed: Vue/Nuxt surface
// those through their own error hooks independently of these promises.
//
// A `ViewTransition` exposes THREE promises. `ready`/`finished` (below) were
// covered, but `updateCallbackDone` was not — and it is the one Nuxt rejects
// directly: Nuxt's `view-transitions.client` plugin passes an `update`
// callback returning a promise it rejects via `abortTransition?.()` on
// `router.onError`/`app:error`/`vue:error`, so an aborted navigation leaves
// `updateCallbackDone` rejected with no handler. That was the residual
// unhandled rejection still reaching Sentry as JAVASCRIPT-VUE-3K/3P/3R
// (`mechanism: onunhandledrejection`, DOMException, no stacktrace) even with
// the `ready` catch in place. Catching it closes the last channel.
// ========================================

export default defineNuxtPlugin((nuxtApp) => {
  const log = createLogger('[ViewTransition]')

  nuxtApp.hook('page:view-transition:start', (transition) => {
    transition.ready.catch((err) => log.debug('Transition not ready (skipped/aborted)', err))
    transition.updateCallbackDone.catch((err) => log.debug('Transition update aborted', err))
    transition.finished.catch((err) => log.debug('Transition did not finish (skipped/aborted)', err))
  })
})

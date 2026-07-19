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
// ========================================

export default defineNuxtPlugin((nuxtApp) => {
  const log = createLogger('[ViewTransition]')

  nuxtApp.hook('page:view-transition:start', (transition) => {
    transition.ready.catch((err) => log.debug('Transition not ready (skipped/aborted)', err))
    transition.finished.catch((err) => log.debug('Transition did not finish (skipped/aborted)', err))
  })
})

// ========================================
// Reload telemetry boot reporter
// ========================================
//
// Every boot asks one question: did the previous page session end in a reload,
// and if so, why? See `~/utils/reload-telemetry` for the three causes and why
// the third is inferred rather than reported.
//
// The two halves run at deliberately different times:
//
//  - **Consume in the plugin body.** The markers must be read and cleared
//    before `useRoomLifecycle`'s heartbeat overwrites the snapshot with *this*
//    session's state. A plugin body runs before `app.vue` setup, so this wins
//    that race by construction rather than by timing luck. It touches storage
//    only, so it needs neither Pinia nor the router.
//
//  - **Report on `app:mounted`.** Grading the outcome means reading the room
//    store and the resolved route, neither of which is trustworthy earlier.
// ========================================

export default defineNuxtPlugin((nuxtApp) => {
  const { consume, report } = useReloadTelemetry()

  const pending = consume()
  if (!pending) return

  nuxtApp.hook('app:mounted', () => {
    report(pending)
  })
})

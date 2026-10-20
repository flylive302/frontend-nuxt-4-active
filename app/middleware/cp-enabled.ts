// ========================================
// CP Event Gate
// ========================================
//
// GATE. CP Event pages 404 while the server's `cp.enabled` flag is off.
//
// Cold deep link: route middleware runs before `/bootstrap` has answered, so
// the store still holds the off defaults. Reading it then would 404 an enabled
// event. We wait for bootstrap to settle (`complete` | `error`), bounded so a
// dead backend cannot hang navigation. A warm open is `complete` immediately
// (persisted catalog) and a background revalidate refreshes the flag.
// A failed or timed-out bootstrap counts as off.
import { CP_GATE_WAIT_MS } from '~/constants/bootstrap'

export default defineNuxtRouteMiddleware(async () => {
  const bootstrapStore = useBootstrapStore()

  if (bootstrapStore.phase === 'idle' || bootstrapStore.phase === 'loading') {
    await new Promise<void>((resolve) => {
      let stop: () => void = () => {}
      const timer = setTimeout(() => {
        stop()
        resolve()
      }, CP_GATE_WAIT_MS)
      stop = watch(
        () => bootstrapStore.phase,
        (phase) => {
          if (phase === 'complete' || phase === 'error') {
            clearTimeout(timer)
            stop()
            resolve()
          }
        },
        { immediate: true },
      )
    })
  }

  if (!bootstrapStore.cpEnabled) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', fatal: true })
  }
})

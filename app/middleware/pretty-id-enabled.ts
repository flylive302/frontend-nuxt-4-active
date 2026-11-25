// ========================================
// Pretty ID Event Gate
// ========================================
//
// GATE. Pretty ID pages 404 while the server's `pretty_id.enabled` flag is off.
//
// Cold deep link: route middleware runs before `/bootstrap` has answered, so
// the store still holds the off defaults. Reading it then would 404 an enabled
// event. We wait for bootstrap to settle (`complete` | `error`), bounded so a
// dead backend cannot hang navigation. A warm open is `complete` immediately
// (persisted catalog) and a background revalidate refreshes the flag.
// A failed or timed-out bootstrap counts as off.
import { PRETTY_ID_GATE_WAIT_MS } from '~/constants/bootstrap'
import { awaitBootstrapSettled } from '~/utils/await-bootstrap-settled'

export default defineNuxtRouteMiddleware(async () => {
  const bootstrapStore = useBootstrapStore()

  await awaitBootstrapSettled(bootstrapStore, PRETTY_ID_GATE_WAIT_MS)

  if (!bootstrapStore.prettyIdEnabled) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', fatal: true })
  }
})

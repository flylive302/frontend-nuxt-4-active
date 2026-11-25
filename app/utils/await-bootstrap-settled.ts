/**
 * Waits for the bootstrap store to settle (`complete` | `error`), bounded.
 *
 * Shared by the route-gate middlewares (pretty-id-enabled,
 * pretty-id-auction-enabled). A cold deep link runs middleware before
 * `/bootstrap` has answered, so the store still holds off defaults; reading a
 * flag then would wrongly deny an enabled event. A warm open is already
 * `complete` (persisted catalog) and returns immediately. On timeout it
 * resolves anyway — the caller then reads the (off) defaults, so a dead
 * backend cannot hang navigation.
 */
import { watch } from 'vue'

type BootstrapPhase = 'idle' | 'loading' | 'complete' | 'error'

export async function awaitBootstrapSettled(
  store: { readonly phase: BootstrapPhase },
  waitMs: number,
): Promise<void> {
  if (store.phase !== 'idle' && store.phase !== 'loading') return

  await new Promise<void>((resolve) => {
    let stop: () => void = () => {}
    const timer = setTimeout(() => {
      stop()
      resolve()
    }, waitMs)
    stop = watch(
      () => store.phase,
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

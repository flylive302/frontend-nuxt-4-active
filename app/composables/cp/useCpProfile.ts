/**
 * Data composable for a user's CP profile (`/cp-event/{signature}-cp`) and the
 * small CP section on the regular profile.
 *
 * `status` separates the failure modes the page renders differently:
 *  - `blocked`   403 (block in either direction)
 *  - `not_found` 404
 *  - `error`     anything else
 * `refetch()` is the entry point for socket handlers (ticket 11) and for the
 * break action; it never blanks data already on screen.
 */

import { watchDebounced } from '@vueuse/core'
import type { MaybeRefOrGetter } from 'vue'
import type { CpEnvelope, CpProfileResponse } from '~/types/cp'
import { useApi } from '~/composables/shared/useApi'
import { CP_SIGNAL_DEBOUNCE_MS } from '~/constants/cp-event'
import { createLogger } from '~/utils/logger'

const log = createLogger('[CpProfile]')

const HTTP_FORBIDDEN = 403
const HTTP_NOT_FOUND = 404

export type CpProfileStatus = 'idle' | 'loading' | 'ready' | 'blocked' | 'not_found' | 'error'

export function useCpProfile(
  signature: MaybeRefOrGetter<string | null | undefined>,
  /**
   * Lazy-load gate: fetch only while this is true, and again whenever the
   * signature changes. Omitted = always visible (fetches immediately).
   */
  visible?: MaybeRefOrGetter<boolean>,
) {
  const { api, normalizeError } = useApi()
  const store = useCpStore()

  const status = ref<CpProfileStatus>('idle')
  const error = ref<string | null>(null)

  const profile = computed(() => {
    const sig = toValue(signature)
    return sig ? store.profileFor(sig) : null
  })

  // Only the latest request may write the store / status (older responses are dropped).
  let requestSeq = 0
  let fetchedSignature: string | null = null

  async function fetchProfile(): Promise<void> {
    const sig = toValue(signature)
    // GATE
    if (!sig) return
    const seq = ++requestSeq
    fetchedSignature = sig
    const hadData = store.profileFor(sig) !== null
    if (!hadData) status.value = 'loading'
    error.value = null
    try {
      const response = await api<CpEnvelope<CpProfileResponse>>(`/cp/profile/${encodeURIComponent(sig)}`)
      if (seq !== requestSeq) return
      store.setProfile(sig, response.data)
      status.value = 'ready'
    } catch (err) {
      if (seq !== requestSeq) return
      const normalized = normalizeError(err)
      if (normalized.status === HTTP_FORBIDDEN) status.value = 'blocked'
      else if (normalized.status === HTTP_NOT_FOUND) status.value = 'not_found'
      else {
        // A failed background refetch keeps the stale data on screen.
        status.value = hadData ? 'ready' : 'error'
        error.value = normalized.message
      }
      log.warn('Failed to fetch cp/profile', { status: normalized.status })
    }
  }

  const isVisible = (): boolean => visible === undefined || toValue(visible)

  // Fetch trigger: once visible, and again when the signature changes while mounted.
  const stopVisibleWatch = watch(
    () => [toValue(signature), isVisible()] as const,
    ([sig, visibleNow]) => {
      if (!sig || !visibleNow || sig === fetchedSignature) return
      // Never keep showing the previous user's ready/blocked state while this fetch runs.
      status.value = store.profileFor(sig) !== null ? 'ready' : 'loading'
      fetchProfile().catch((err: unknown) => log.warn('Visible fetch failed', err))
    },
    { immediate: true },
  )

  // Realtime hint (cp.pair.*): debounced refetch — a combo of N gifts = one fetch.
  // Skipped until the first fetch happened and while hidden (a lazy block that never scrolled in).
  const stopSignalWatch = watchDebounced(
    () => store.pairSignal,
    () => {
      if (fetchedSignature === null || toValue(visible) === false) return
      fetchProfile().catch((err: unknown) => log.warn('Signal refetch failed', err))
    },
    { debounce: CP_SIGNAL_DEBOUNCE_MS },
  )

  onScopeDispose(() => {
    stopSignalWatch()
    stopVisibleWatch()
  })

  return {
    profile,
    status: readonly(status),
    error: readonly(error),
    refetch: fetchProfile,
  }
}

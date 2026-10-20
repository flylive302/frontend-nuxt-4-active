/**
 * Action composable for CP pairs. `breakPair`: GATE → EXECUTE → REACT.
 *
 * No optimistic removal: the pair disappears only after the server confirms
 * (200) or says it is already gone and the profile/event data refetch.
 * "Already gone" = 403 (the break policy rejects a pair that is no longer
 * active: ended by the other partner / decay / admin) or 409 (race). The Break
 * button is only shown to partners, so a 403 from the UI means "already ended".
 */

import { useApi } from '~/composables/shared/useApi'
import { createLogger } from '~/utils/logger'

const log = createLogger('[CpActions]')

const HTTP_FORBIDDEN = 403
const HTTP_CONFLICT = 409

interface BreakOptions {
  /** REACT — called after a confirmed (or already-broken) break to refetch the visible data. */
  onSettled?: () => void | Promise<void>
}

export function useCpActions() {
  const { api, normalizeError } = useApi()
  const toast = useToast()
  const store = useCpStore()

  const breakingPairId = ref<number | null>(null)
  const isBreaking = computed(() => breakingPairId.value !== null)

  async function runSettled(onSettled: BreakOptions['onSettled']): Promise<void> {
    // Cached leaderboard / own-pair data is stale now; the event page refetches on open.
    store.resetEvent()
    try {
      await onSettled?.()
    } catch (err) {
      log.warn('Refetch after break failed', err)
    }
  }

  /** @returns true when the pair is gone (broken now or already). */
  async function breakPair(pairId: number, options: BreakOptions = {}): Promise<boolean> {
    // GATE — one break at a time
    if (breakingPairId.value !== null) return false
    breakingPairId.value = pairId

    try {
      // EXECUTE
      await api(`/cp/pairs/${pairId}/break`, { method: 'POST' })
      // REACT
      toast.add({ title: 'CP broken', description: 'This pair has been ended.', color: 'neutral', icon: 'i-lucide-heart-crack' })
      await runSettled(options.onSettled)
      return true
    } catch (err) {
      const normalized = normalizeError(err)
      if (normalized.status === HTTP_FORBIDDEN || normalized.status === HTTP_CONFLICT) {
        // Already broken (other partner, decay, admin) — just resync.
        await runSettled(options.onSettled)
        return true
      }
      toast.add({ title: 'Could not break CP', description: normalized.message, color: 'error' })
      return false
    } finally {
      breakingPairId.value = null
    }
  }

  return { breakPair, breakingPairId, isBreaking }
}

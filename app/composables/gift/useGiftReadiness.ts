import { ref, watch, onUnmounted, type Ref } from 'vue'
import type { Gift } from '~/types/gift/gift'
import { isGiftAssetCached } from '~/services/giftAssetCache'
import { isLuckyCategory } from '~/utils/gift'

export type GiftReadinessState = 'idle' | 'checking' | 'ready' | 'error'

const POLL_MS = 200
const TIMEOUT_MS = 10_000

/**
 * Watches the selected gift and polls isGiftAssetCached() until the asset is confirmed in cache
 * or 10 seconds elapse. Returns a readiness state to drive the gift card overlay.
 *
 * No spinner is shown for already-cached gifts: the first async check resolves before any
 * state is set to 'checking', so L1 hits (synchronous fast path) produce no visible flash.
 */
export function useGiftReadiness(selectedGift: Ref<Gift | null>) {
  const readinessState = ref<GiftReadinessState>('idle')
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null
  let generation = 0

  function cleanup() {
    if (pollTimer !== null) { clearInterval(pollTimer); pollTimer = null }
    if (timeoutTimer !== null) { clearTimeout(timeoutTimer); timeoutTimer = null }
  }

  async function checkAndWatch(gift: Gift, gen: number) {
    const cached = await isGiftAssetCached(gift)
    if (gen !== generation) return

    if (cached) {
      readinessState.value = 'ready'
      return
    }

    readinessState.value = 'checking'

    timeoutTimer = setTimeout(() => {
      if (gen !== generation) return
      cleanup()
      readinessState.value = 'error'
    }, TIMEOUT_MS)

    pollTimer = setInterval(async () => {
      const nowCached = await isGiftAssetCached(gift)
      if (gen !== generation) return
      if (nowCached) {
        cleanup()
        readinessState.value = 'ready'
      }
    }, POLL_MS)
  }

  watch(
    selectedGift,
    (gift) => {
      cleanup()
      generation++
      readinessState.value = 'idle'
      if (gift) {
        // Lucky gifts use fly animation (thumbnail only) — no animation asset to preload
        if (isLuckyCategory(gift.category)) {
          readinessState.value = 'ready'
          return
        }
        checkAndWatch(gift, generation)
      }
    },
    { immediate: true },
  )

  onUnmounted(cleanup)

  return { readinessState }
}

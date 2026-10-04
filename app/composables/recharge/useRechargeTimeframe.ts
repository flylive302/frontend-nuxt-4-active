/**
 * One mission timeframe page's data + countdown wiring (daily / weekly / monthly).
 *
 * Owns the page lifecycle that index/weekly/monthly used to duplicate:
 *   mount   → fetch progress + subscribe to realtime mission echoes
 *   unmount → unsubscribe
 * and derives the server-synced countdown from the store.
 */

import type { ComputedRef, Ref } from 'vue'
import type { MissionProgressResponse } from '~/types/mission/recharge'
import type { RechargeTimeframe } from '~/constants/recharge'

interface UseRechargeTimeframeReturn {
  progress: ComputedRef<MissionProgressResponse | null>
  isLoading: Readonly<Ref<boolean>>
  error: Readonly<Ref<string | null>>
  hours: Readonly<Ref<number>>
  minutes: Readonly<Ref<number>>
  seconds: Readonly<Ref<number>>
  /** Re-fetch this timeframe (retry button). */
  refresh: () => Promise<void>
}

export function useRechargeTimeframe(timeframe: RechargeTimeframe): UseRechargeTimeframeReturn {
  const store = useMissionStore()
  const { isLoading, error } = storeToRefs(store)
  const { fetchProgress } = useRechargeMissionData()
  const { subscribe, unsubscribe } = useMissionEcho(() => fetchProgress(timeframe))

  const progress = computed(() => store.progressFor(timeframe))
  const resetsAt = computed(() => progress.value?.resets_at ?? null)
  const serverTime = computed(() => progress.value?.server_time ?? null)

  const { hours, minutes, seconds } = useMissionCountdown(resetsAt, serverTime)

  onMounted(() => {
    fetchProgress(timeframe)
    subscribe()
  })

  onUnmounted(unsubscribe)

  return {
    progress,
    isLoading,
    error,
    hours,
    minutes,
    seconds,
    refresh: () => fetchProgress(timeframe),
  }
}

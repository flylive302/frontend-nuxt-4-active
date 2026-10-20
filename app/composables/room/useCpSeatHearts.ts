/**
 * useCpSeatHearts — which seat gaps get a CP heart, and where (CP event, ticket 12).
 *
 * GATE → EXECUTE → REACT:
 *  - trigger: debounced watch of the seated-occupant key (+ the viewer's own bind/break
 *    signal, + delayed re-checks after a binding gift lands in the room, + a slow 120 s
 *    timer while the tab is visible and ≥ 2 are seated)
 *  - GATE: CP enabled, ≥ 2 seated, occupant key changed since the last fetch
 *    (signal / slow-timer fetches skip the key check)
 *  - EXECUTE: ONE `cp/seat-partners` call, then the pure adjacency util
 *  - REACT: measure the two seats' rects relative to the overlay's wrapper
 *    (ResizeObserver + scroll re-measure, rAF-throttled)
 *
 * Also exposes the adjacent couples as user ids for the bind FX (useCpBindFx).
 *
 * Everything is torn down with the calling scope.
 */
import type { Ref } from 'vue'
import {
  useDocumentVisibility,
  useEventListener,
  useResizeObserver,
  watchDebounced,
} from '@vueuse/core'
import type { CpSeatPartnersResponse } from '~/types/cp'
import { useApi } from '~/composables/shared/useApi'
import {
  CP_BIND_REFETCH_DELAYS_MS,
  CP_SEAT_HEARTS_DEBOUNCE_MS,
  CP_SEAT_HEARTS_SLOW_REFETCH_MS,
  CP_SEAT_PARTNERS_MAX_USERS,
} from '~/constants/cp-event'
import { DEFAULT_SEAT_COUNT } from '~/constants/room'
import type { CpSeatedCouple } from '~/utils/cp-bind-fx'
import { findAdjacentCpSeats } from '~/utils/cp-seat-adjacency'
import { createLogger } from '~/utils/logger'

const log = createLogger('[CpSeatHearts]')

const MIN_SEATED = 2

export interface CpSeatHeart {
  readonly key: string
  /** Centre, px relative to the overlay container. */
  readonly x: number
  readonly y: number
}

type SeatPair = CpSeatPartnersResponse['pairs'][number]

export function useCpSeatHearts(container: Ref<HTMLElement | null>) {
  const { api } = useApi()
  const seatsStore = useRoomSeatsStore()
  const roomStore = useRoomStore()
  const bootstrapStore = useBootstrapStore()
  const cpStore = useCpStore()
  const visibility = useDocumentVisibility()

  const pairs = ref<readonly SeatPair[]>([])
  const hearts = ref<CpSeatHeart[]>([])

  const seatCount = computed(() => roomStore.currentRoom?.max_seats ?? DEFAULT_SEAT_COUNT)
  const seatUserIds = computed<(number | null)[]>(() =>
    Array.from({ length: seatCount.value }, (_, i) => seatsStore.seats[i]?.occupantId ?? null),
  )
  const seatedIds = computed(() => seatUserIds.value.filter((id): id is number => id !== null))
  const occupantKey = computed(() => `${seatCount.value}:${seatUserIds.value.join(',')}`)
  const adjacent = computed(() => findAdjacentCpSeats(seatUserIds.value, pairs.value))
  const couples = computed<CpSeatedCouple[]>(() =>
    adjacent.value.flatMap(({ left, right }) => {
      const leftUserId = seatUserIds.value[left]
      const rightUserId = seatUserIds.value[right]
      return leftUserId != null && rightUserId != null ? [{ leftUserId, rightUserId }] : []
    }),
  )
  const hasSeatedPairs = computed(() => pairs.value.length > 0)

  // ========================================
  // EXECUTE — fetch
  // ========================================

  const lastFetchedKey = ref<string | null>(null)
  /** `pairs` reflects the current occupants (trivially so with fewer than two seated). */
  const pairsSynced = computed(() => seatedIds.value.length < MIN_SEATED || lastFetchedKey.value === occupantKey.value)
  let inflight = false
  let rerun = false
  let rerunForce = false
  let disposed = false

  async function load(force: boolean): Promise<void> {
    // GATE
    if (disposed || !bootstrapStore.cpEnabled) return
    if (seatedIds.value.length < MIN_SEATED) {
      lastFetchedKey.value = null
      pairs.value = []
      return
    }
    const key = occupantKey.value
    if (!force && key === lastFetchedKey.value) return
    if (inflight) {
      rerun = true
      rerunForce ||= force
      return
    }
    inflight = true
    try {
      const userIds = [...new Set(seatedIds.value)].slice(0, CP_SEAT_PARTNERS_MAX_USERS)
      const response = await api<{ data: CpSeatPartnersResponse }>('/cp/seat-partners', {
        method: 'POST',
        body: { user_ids: userIds },
      })
      if (disposed) return
      pairs.value = response.data.pairs
      lastFetchedKey.value = key
    } catch (err) {
      log.warn('Failed to fetch cp/seat-partners', err)
    } finally {
      inflight = false
      if (rerun && !disposed) {
        const again = rerunForce
        rerun = false
        rerunForce = false
        void load(again)
      }
    }
  }

  watchDebounced(
    occupantKey,
    () => { void load(false) },
    { debounce: CP_SEAT_HEARTS_DEBOUNCE_MS, immediate: true },
  )

  // The viewer's own bind / break changes membership without any seat change.
  watchDebounced(
    () => cpStore.pairMembershipSignal,
    () => { void load(true) },
    { debounce: CP_SEAT_HEARTS_DEBOUNCE_MS },
  )

  // A binding gift may have just paired two other users. Re-check after the queued
  // ApplyCpGift has had time to commit; a newer gift restarts the schedule.
  let bindTimers: ReturnType<typeof setTimeout>[] = []
  function clearBindTimers(): void {
    for (const timer of bindTimers) clearTimeout(timer)
    bindTimers = []
  }
  watch(
    () => cpStore.roomBindingGiftSignal,
    () => {
      clearBindTimers()
      bindTimers = CP_BIND_REFETCH_DELAYS_MS.map((delay) => setTimeout(() => { void load(true) }, delay))
    },
  )

  const slowTimer = setInterval(() => {
    if (visibility.value === 'visible' && seatedIds.value.length >= MIN_SEATED) void load(true)
  }, CP_SEAT_HEARTS_SLOW_REFETCH_MS)

  // ========================================
  // REACT — positions
  // ========================================

  function seatElement(wrapper: HTMLElement, userId: number | null): HTMLElement | null {
    if (userId === null) return null
    return wrapper.querySelector<HTMLElement>(`[data-user-id="${userId}"]`)
  }

  function measure(): void {
    const el = container.value
    const wrapper = el?.parentElement
    if (!el || !wrapper || adjacent.value.length === 0) {
      hearts.value = []
      return
    }
    const origin = el.getBoundingClientRect()
    const next: CpSeatHeart[] = []
    for (const { left, right } of adjacent.value) {
      const leftEl = seatElement(wrapper, seatUserIds.value[left] ?? null)
      const rightEl = seatElement(wrapper, seatUserIds.value[right] ?? null)
      if (!leftEl || !rightEl) continue
      const leftRect = leftEl.getBoundingClientRect()
      const rightRect = rightEl.getBoundingClientRect()
      // Avatar block = the seat's first child; the heart sits on its vertical centre.
      const avatar = leftEl.firstElementChild?.getBoundingClientRect() ?? leftRect
      next.push({
        key: `${left}-${right}`,
        x: (leftRect.right + rightRect.left) / 2 - origin.left,
        y: avatar.top + avatar.height / 2 - origin.top,
      })
    }
    hearts.value = next
  }

  let frame: number | null = null
  function scheduleMeasure(): void {
    if (frame !== null || typeof requestAnimationFrame === 'undefined') return
    frame = requestAnimationFrame(() => {
      frame = null
      measure()
    })
  }

  watch(adjacent, () => { void nextTick(scheduleMeasure) }, { flush: 'post' })
  watch(container, () => scheduleMeasure(), { flush: 'post' })

  const wrapperRef = computed(() => container.value?.parentElement ?? null)
  useResizeObserver(wrapperRef, scheduleMeasure)
  // Seat grid scrolls inside the wrapper; scroll events do not bubble, so capture.
  useEventListener(wrapperRef, 'scroll', scheduleMeasure, { capture: true, passive: true })

  onScopeDispose(() => {
    disposed = true
    clearInterval(slowTimer)
    clearBindTimers()
    if (frame !== null && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(frame)
    frame = null
  })

  return { hearts: readonly(hearts), couples, pairsSynced, hasSeatedPairs }
}

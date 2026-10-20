// ========================================
// CP Event Store
// ========================================
// State + setters ONLY. API calls live in composables/cp. No persistence.
// ========================================

import { defineStore } from 'pinia'
import type { CpPairCard, CpProfileResponse, CpWeekMeta } from '~/types/cp'
import { excludeExistingPairs } from '~/utils/cp'

export const useCpStore = defineStore('cp', () => {
  // ========================================
  // State
  // ========================================

  const podium = ref<CpPairCard[]>([])
  const rows = ref<CpPairCard[]>([])
  const nextOffset = ref<number | null>(null)
  const myPair = ref<CpPairCard | null>(null)
  const week = ref<CpWeekMeta | null>(null)
  const hasLoaded = ref(false)
  const profilesBySignature = ref<Record<string, CpProfileResponse>>({})

  // Realtime signals (cp.events → composables). Counters, not payloads: the
  // socket payload is only a hint — watchers invalidate + refetch (debounced).
  /** Bumped on cp.pair.bound / cp.pair.updated / cp.pair.broken for one of the viewer's pairs. */
  const pairSignal = ref(0)
  /** Bumped on cp.pair.bound / cp.pair.broken only — seat hearts refetch on these, not on points updates. */
  const pairMembershipSignal = ref(0)
  /** Bumped on cp.week.closed (broadcast). */
  const weekClosedSignal = ref(0)
  /**
   * Bumped when a binding gift lands in the viewer's room — a pair may have just formed
   * between two other users, who alone get cp.pair.bound. Seat hearts re-check on it.
   */
  const roomBindingGiftSignal = ref(0)

  // ========================================
  // Computed
  // ========================================

  const weekKey = computed(() => week.value?.week_key ?? null)
  const closesAt = computed(() => week.value?.closes_at ?? null)
  const serverTime = computed(() => week.value?.server_time ?? null)
  const isEmpty = computed(() => hasLoaded.value && podium.value.length === 0 && rows.value.length === 0)

  // ========================================
  // Setters
  // ========================================

  /** Replaces the whole list (cp/list): podium + first page + paging cursor + week. */
  function setList(top: CpPairCard[], page: CpPairCard[], next: number | null, meta: CpWeekMeta): void {
    podium.value = top
    rows.value = excludeExistingPairs([], page)
    nextOffset.value = next
    week.value = meta
    hasLoaded.value = true
  }

  /**
   * Poll refresh: swaps in the fresh podium + head page but keeps any deeper
   * rows the viewer already scrolled to, so a poll never yanks the list.
   */
  function mergeHead(top: CpPairCard[], head: CpPairCard[], next: number | null, meta: CpWeekMeta): void {
    const uniqueHead = excludeExistingPairs([], head)
    const tail = excludeExistingPairs(uniqueHead, rows.value.slice(head.length))
    podium.value = top
    rows.value = [...uniqueHead, ...tail]
    if (tail.length === 0) nextOffset.value = next
    week.value = meta
    hasLoaded.value = true
  }

  /** Appends a later page, dropping pairs already shown. */
  function appendRows(page: CpPairCard[], next: number | null): void {
    rows.value = [...rows.value, ...excludeExistingPairs(rows.value, page)]
    nextOffset.value = next
  }

  function setMyPair(pair: CpPairCard | null): void {
    myPair.value = pair
  }

  function setWeek(meta: CpWeekMeta): void {
    week.value = meta
  }

  function setProfile(signature: string, data: CpProfileResponse): void {
    profilesBySignature.value = { ...profilesBySignature.value, [signature]: data }
  }

  function profileFor(signature: string): CpProfileResponse | null {
    return profilesBySignature.value[signature] ?? null
  }

  /** Drops list/me/week data (keeps profiles) — after a confirmed break so no stale pair can flash. */
  function resetEvent(): void {
    podium.value = []
    rows.value = []
    nextOffset.value = null
    myPair.value = null
    week.value = null
    hasLoaded.value = false
  }

  function bumpPairSignal(membershipChanged: boolean): void {
    pairSignal.value++
    if (membershipChanged) pairMembershipSignal.value++
  }

  function bumpWeekClosedSignal(): void {
    weekClosedSignal.value++
  }

  function bumpRoomBindingGiftSignal(): void {
    roomBindingGiftSignal.value++
  }

  function reset(): void {
    resetEvent()
    profilesBySignature.value = {}
  }

  return {
    podium, rows, nextOffset, myPair, week, hasLoaded, profilesBySignature,
    pairSignal, pairMembershipSignal, weekClosedSignal, roomBindingGiftSignal,
    weekKey, closesAt, serverTime, isEmpty,
    setList, mergeHead, appendRows, setMyPair, setWeek, setProfile, profileFor, resetEvent,
    bumpPairSignal, bumpWeekClosedSignal, bumpRoomBindingGiftSignal, reset,
  }
})

// ========================================
// Room Expand View Transition
// ========================================
//
// The tapped room card *is* the room page: the browser interpolates its box to
// full-screen on the way in, and back into the card on the way out. Geometry is
// the browser's job — all this composable owns is identity.
//
// Two things must survive the navigation:
//  1. WHICH card owns the shared name. Only the room being entered may carry it;
//     a second element with the same name aborts the whole transition. The id
//     outlives the entry so the room can still find its card to collapse into.
//  2. The background URL that card painted, so the room page has a decoded
//     bitmap the instant it is captured rather than an empty box.
// ========================================

import type { StyleValue } from 'vue'
import { ROOM_EXPAND_VIEW_TRANSITION_NAME } from '~/constants/view-transition'

interface RoomExpandState {
  /** Room whose card owns the shared element. Outlives entry so leave can reverse it. */
  roomId: number | null
  /** Exact background URL the owning card painted. Empty on a cold room-page load. */
  seedSrc: string
}

const EMPTY: RoomExpandState = { roomId: null, seedSrc: '' }

/**
 * Live card instances by unique instance key → roomId, in mount order. The
 * same room can be rendered by several cards at once (carousel + grid), but
 * the browser aborts the whole transition if two elements share the name —
 * so exactly ONE registered instance may carry it at a time.
 */
const cardRegistry = reactive(new Map<string, number>())

export function useRoomExpandTransition() {
  const state = useState<RoomExpandState>('room-expand-transition', () => ({ ...EMPTY }))
  /** Instance key of the tapped card — preferred owner while it stays mounted. */
  const claimKey = useState<string | null>('room-expand-claim', () => null)

  /** Cached URL for the room page's first frame, so the expanding card is never blank. */
  const seedSrc = computed(() => state.value.seedSrc)

  /** The room page root — the only element that can own the name on that page. */
  const roomExpandStyle: StyleValue = { viewTransitionName: ROOM_EXPAND_VIEW_TRANSITION_NAME }

  /**
   * Register a card instance for name arbitration. Call from the card's
   * setup; returns its instance key. Unregisters automatically on unmount.
   */
  function registerRoomCard(roomId: number): string {
    const key = useId()
    cardRegistry.set(key, roomId)
    onUnmounted(() => {
      cardRegistry.delete(key)
    })
    return key
  }

  /** Prefer the tapped instance; else the first mounted card of that room. */
  function ownerKeyForRoom(roomId: number): string | undefined {
    const claimed = claimKey.value
    if (claimed && cardRegistry.get(claimed) === roomId) return claimed
    for (const [key, id] of cardRegistry) {
      if (id === roomId) return key
    }
    return undefined
  }

  /** A room card — owns the name only if its room is active AND it won arbitration. */
  function roomExpandStyleForRoom(roomId: number, instanceKey: string): StyleValue | undefined {
    if (state.value.roomId !== roomId) return undefined
    return ownerKeyForRoom(roomId) === instanceKey ? roomExpandStyle : undefined
  }

  /** Mark `instanceKey` as the tapped card so the morph originates from it. */
  function claimRoomExpand(instanceKey: string): void {
    claimKey.value = instanceKey
  }

  /**
   * Hand the name to `roomId`'s card. Awaits a tick so Vue has written the
   * attribute before the router captures the outgoing snapshot.
   */
  async function beginRoomExpand(roomId: number, cardSeedSrc = ''): Promise<void> {
    state.value = { roomId, seedSrc: cardSeedSrc }
    await nextTick()
  }

  /** Revoke the name — entry was aborted, so no transition will follow. */
  function clearRoomExpand(): void {
    state.value = { ...EMPTY }
  }

  return { seedSrc, roomExpandStyle, roomExpandStyleForRoom, registerRoomCard, claimRoomExpand, beginRoomExpand, clearRoomExpand }
}

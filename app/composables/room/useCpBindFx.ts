/**
 * useCpBindFx — the full-screen "sat together" animation every viewer in the room
 * sees when two CP partners become seat neighbours (CP event). Plays every time a
 * couple sits together again; no cooldown.
 *
 * GATE → EXECUTE → REACT:
 *  - trigger: useCpSeatHearts' adjacent couples change
 *  - GATE: armed — the join snapshot is applied and the seat pairs are synced to it.
 *    Couples adjacent at that point are the baseline (a late joiner sees only the
 *    heart); a couple already adjacent never re-fires; minimized rooms skip it
 *  - EXECUTE: one personalized center-lane playback per newly adjacent couple
 *  - REACT: warm the SVGA once a CP pair is seated in the room
 *
 * Disarms on seat reset (leave / room switch) so the next room gets a fresh baseline.
 */
import type { Ref } from 'vue'
import * as giftAssetCache from '~/services/giftAssetCache'
import { resolveSvgaPlugin } from '~/composables/gift/useSvgaPlugin'
import {
  cpBindFxFills,
  cpBindFxGift,
  cpCoupleKey,
  newlySeatedCouples,
  type CpSeatedCouple,
} from '~/utils/cp-bind-fx'

export interface CpBindFxSource {
  readonly couples: Readonly<Ref<readonly CpSeatedCouple[]>>
  readonly pairsSynced: Readonly<Ref<boolean>>
  readonly hasSeatedPairs: Readonly<Ref<boolean>>
}

export function useCpBindFx(source: CpBindFxSource) {
  const giftStore = useGiftStore()
  const seatsStore = useRoomSeatsStore()
  const participantsStore = useRoomParticipantsStore()
  const roomStore = useRoomStore()

  let armed = false
  let adjacentKeys = new Set<string>()

  function keysOf(couples: readonly CpSeatedCouple[]): Set<string> {
    return new Set(couples.map(cpCoupleKey))
  }

  // ========================================
  // EXECUTE
  // ========================================

  function play(couple: CpSeatedCouple): void {
    if (roomStore.isMinimized) return
    const left = participantsStore.participants.get(couple.leftUserId)
    const right = participantsStore.participants.get(couple.rightUserId)
    giftStore.enqueuePlayback({
      gift: cpBindFxGift(),
      senderId: couple.leftUserId,
      senderName: left?.name ?? '',
      senderAvatar: left?.avatar ?? undefined,
      recipientIds: [couple.rightUserId],
      quantity: 1,
      svgaFills: cpBindFxFills(left, right),
    })
  }

  // ========================================
  // GATE — arm, diff, disarm
  // ========================================

  watch(
    [source.couples, source.pairsSynced, () => seatsStore.seatsHydrated],
    ([couples, synced, hydrated]) => {
      if (!hydrated) {
        armed = false
        adjacentKeys = new Set()
        return
      }
      if (!armed) {
        if (!synced) return
        armed = true
        adjacentKeys = keysOf(couples)
        return
      }
      const fresh = newlySeatedCouples(adjacentKeys, couples)
      adjacentKeys = keysOf(couples)
      for (const couple of fresh) play(couple)
    },
    { immediate: true },
  )

  // ========================================
  // REACT — warm the asset before the first play
  // ========================================

  watch(
    source.hasSeatedPairs,
    (seated) => {
      if (seated) void giftAssetCache.preloadGift(cpBindFxGift(), resolveSvgaPlugin())
    },
    { immediate: true },
  )
}

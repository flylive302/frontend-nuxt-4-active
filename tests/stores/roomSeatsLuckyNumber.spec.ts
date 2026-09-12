/**
 * Unit tests for roomSeats store — Lucky Number slice (lucky-number/01).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, ref } from 'vue'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('roomSeatsStore — Lucky Number', () => {
  it('resetSeats() clears round, reveal, cooldown, and disables the game', async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const store = useRoomSeatsStore()

    store.setLuckyNumberEnabled(true)
    store.startLuckyNumberRound('r1', Date.now() + 10000)
    store.setLuckyNumberReveal({ roundId: 'r1', drawn: 4, picks: {}, winners: [] }, 15000)

    store.resetSeats()

    expect(store.luckyNumberRound).toBeNull()
    expect(store.luckyNumberReveal).toBeNull()
    expect(store.luckyNumberCooldownUntil).toBe(0)
    expect(store.luckyNumberEnabled).toBe(false)
  })

  it("clearLuckyNumberReveal('other') leaves a reveal for 'r1' untouched; clearLuckyNumberReveal('r1') clears it", async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const store = useRoomSeatsStore()

    store.setLuckyNumberReveal({ roundId: 'r1', drawn: 4, picks: {}, winners: [] }, 15000)

    store.clearLuckyNumberReveal('other')
    expect(store.luckyNumberReveal).not.toBeNull()
    expect(store.luckyNumberReveal?.roundId).toBe('r1')

    store.clearLuckyNumberReveal('r1')
    expect(store.luckyNumberReveal).toBeNull()
  })

  it('startLuckyNumberRound resets an existing reveal to null', async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const store = useRoomSeatsStore()

    store.setLuckyNumberReveal({ roundId: 'r1', drawn: 4, picks: {}, winners: [] }, 15000)
    expect(store.luckyNumberReveal).not.toBeNull()

    store.startLuckyNumberRound('r2', Date.now() + 10000)

    expect(store.luckyNumberReveal).toBeNull()
  })

  describe('addLuckyNumberPick (lucky-number/02)', () => {
    it('ignores when there is no live round', async () => {
      const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
      const store = useRoomSeatsStore()

      store.addLuckyNumberPick('r1', 7)

      expect(store.luckyNumberPickedUserIds.size).toBe(0)
    })

    it('ignores a pick naming the wrong roundId', async () => {
      const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
      const store = useRoomSeatsStore()
      store.startLuckyNumberRound('r1', Date.now() + 10000)

      store.addLuckyNumberPick('other', 7)

      expect(store.luckyNumberPickedUserIds.size).toBe(0)
    })

    it('adds a userId and dedupes repeated picks for the same userId', async () => {
      const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
      const store = useRoomSeatsStore()
      store.startLuckyNumberRound('r1', Date.now() + 10000)

      store.addLuckyNumberPick('r1', 7)
      store.addLuckyNumberPick('r1', 7)
      store.addLuckyNumberPick('r1', 9)

      expect(store.luckyNumberPickedUserIds).toEqual(new Set([7, 9]))
    })

    it('startLuckyNumberRound clears the picked-user set', async () => {
      const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
      const store = useRoomSeatsStore()
      store.startLuckyNumberRound('r1', Date.now() + 10000)
      store.addLuckyNumberPick('r1', 7)
      expect(store.luckyNumberPickedUserIds.size).toBe(1)

      store.startLuckyNumberRound('r2', Date.now() + 10000)

      expect(store.luckyNumberPickedUserIds.size).toBe(0)
    })

    it('setLuckyNumberReveal clears the picked-user set and stores picks + winners', async () => {
      const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
      const store = useRoomSeatsStore()
      store.startLuckyNumberRound('r1', Date.now() + 10000)
      store.addLuckyNumberPick('r1', 7)

      store.setLuckyNumberReveal(
        { roundId: 'r1', drawn: 5, picks: { '7': 5 }, winners: ['7'] },
        15000,
      )

      expect(store.luckyNumberPickedUserIds.size).toBe(0)
      expect(store.luckyNumberReveal?.picks).toEqual({ '7': 5 })
      expect(store.luckyNumberReveal?.winners).toEqual(['7'])
    })

    it('resetSeats clears the picked-user set', async () => {
      const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
      const store = useRoomSeatsStore()
      store.startLuckyNumberRound('r1', Date.now() + 10000)
      store.addLuckyNumberPick('r1', 7)

      store.resetSeats()

      expect(store.luckyNumberPickedUserIds.size).toBe(0)
    })
  })

  describe('hydrateLuckyNumber (lucky-number/03 — late join/reconnect snapshot)', () => {
    it('sets the round and picked-user set from a live snapshot', async () => {
      const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
      const store = useRoomSeatsStore()
      const endsAt = Date.now() + 10000

      store.hydrateLuckyNumber({ roundId: 'r1', endsAt, pickedUserIds: [7, 9] })

      expect(store.luckyNumberRound).toEqual({ roundId: 'r1', endsAt })
      expect(store.luckyNumberPickedUserIds).toEqual(new Set([7, 9]))
      expect(store.luckyNumberReveal).toBeNull()
    })

    it('clears a stale reveal when hydrating', async () => {
      const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
      const store = useRoomSeatsStore()
      store.setLuckyNumberReveal({ roundId: 'old', drawn: 3, picks: {}, winners: [] }, 15000)

      store.hydrateLuckyNumber({ roundId: 'r1', endsAt: Date.now() + 10000, pickedUserIds: [] })

      expect(store.luckyNumberReveal).toBeNull()
    })

    it('no-ops for a snapshot whose endsAt has already passed', async () => {
      const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
      const store = useRoomSeatsStore()

      store.hydrateLuckyNumber({ roundId: 'r1', endsAt: Date.now() - 1, pickedUserIds: [7] })

      expect(store.luckyNumberRound).toBeNull()
      expect(store.luckyNumberPickedUserIds.size).toBe(0)
    })
  })

  describe('removeLuckyNumberPick (lucky-number/03 — seat vacate drops the pick badge)', () => {
    it('removes only the given userId', async () => {
      const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
      const store = useRoomSeatsStore()
      store.startLuckyNumberRound('r1', Date.now() + 10000)
      store.addLuckyNumberPick('r1', 7)
      store.addLuckyNumberPick('r1', 9)

      store.removeLuckyNumberPick(7)

      expect(store.luckyNumberPickedUserIds).toEqual(new Set([9]))
    })

    it('is a no-op when the userId has no pick', async () => {
      const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
      const store = useRoomSeatsStore()
      store.startLuckyNumberRound('r1', Date.now() + 10000)

      store.removeLuckyNumberPick(7)

      expect(store.luckyNumberPickedUserIds.size).toBe(0)
    })

    it('updateSeat reassignment drops the vacated occupant\'s pick', async () => {
      const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
      const store = useRoomSeatsStore()
      store.updateSeat(0, 7, false)
      store.startLuckyNumberRound('r1', Date.now() + 10000)
      store.addLuckyNumberPick('r1', 7)

      store.updateSeat(0, 8, false)

      expect(store.luckyNumberPickedUserIds.has(7)).toBe(false)
    })

    it('clearSeat drops the vacated occupant\'s pick', async () => {
      const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
      const store = useRoomSeatsStore()
      store.updateSeat(0, 7, false)
      store.startLuckyNumberRound('r1', Date.now() + 10000)
      store.addLuckyNumberPick('r1', 7)

      store.clearSeat(0)

      expect(store.luckyNumberPickedUserIds.has(7)).toBe(false)
    })

    it('clearParticipantFromSeat drops the vacated occupant\'s pick', async () => {
      const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
      const store = useRoomSeatsStore()
      store.updateSeat(0, 7, false)
      store.startLuckyNumberRound('r1', Date.now() + 10000)
      store.addLuckyNumberPick('r1', 7)

      store.clearParticipantFromSeat(7)

      expect(store.luckyNumberPickedUserIds.has(7)).toBe(false)
    })
  })

  describe('endLuckyNumberRoundWithoutResult (lucky-number/03 — result never arrived)', () => {
    it('clears the live round with the matching roundId, no reveal or cooldown', async () => {
      const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
      const store = useRoomSeatsStore()
      store.startLuckyNumberRound('r1', Date.now() + 10000)
      store.addLuckyNumberPick('r1', 7)

      store.endLuckyNumberRoundWithoutResult('r1')

      expect(store.luckyNumberRound).toBeNull()
      expect(store.luckyNumberReveal).toBeNull()
      expect(store.luckyNumberCooldownUntil).toBe(0)
      expect(store.luckyNumberPickedUserIds.size).toBe(0)
    })

    it('ignores a stale roundId, leaving the live round untouched', async () => {
      const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
      const store = useRoomSeatsStore()
      store.startLuckyNumberRound('r1', Date.now() + 10000)

      store.endLuckyNumberRoundWithoutResult('stale')

      expect(store.luckyNumberRound?.roundId).toBe('r1')
    })
  })

  it('hydrateLuckyNumber() never overwrites a fresher round or a reveal that arrived before the join ack', async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const store = useRoomSeatsStore()
    const now = Date.now()

    // A newer `started` already landed
    store.startLuckyNumberRound('r2', now + 9000)
    store.hydrateLuckyNumber({ roundId: 'r1', endsAt: now + 5000, pickedUserIds: [7] })
    expect(store.luckyNumberRound?.roundId).toBe('r2')
    expect(store.luckyNumberPickedUserIds.size).toBe(0)

    // `result` for the snapshot's own round already landed
    store.setLuckyNumberReveal({ roundId: 'r1', drawn: 3, picks: {}, winners: [] }, 15000)
    store.hydrateLuckyNumber({ roundId: 'r1', endsAt: now + 5000, pickedUserIds: [7] })
    expect(store.luckyNumberRound).toBeNull()
    expect(store.luckyNumberReveal?.roundId).toBe('r1')
  })

})

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
})

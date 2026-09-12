/**
 * Unit tests for useLuckyNumber (lucky-number/01).
 *
 * GATE-only composable: enabled + moderator + no live round + no cooldown →
 * emit 'luckyNumber:start'. secondsLeft/reveal derive from the store via a
 * local 1 Hz clock. Real Pinia stores are used (room/roomSeats); only the
 * socket and useRoomHierarchy are mocked/stubbed.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed, watch, nextTick } from 'vue'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('watch', watch)
vi.stubGlobal('onScopeDispose', vi.fn())

const mockSocket = { emit: vi.fn() }
vi.mock('../../../app/composables/room/useAudioSocket', () => ({
  useAudioSocket: () => ({ socket: ref(mockSocket) }),
}))

describe('useLuckyNumber', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  async function setup(canModerate = true) {
    const { useRoomStore } = await import('../../../app/stores/room')
    const { useRoomSeatsStore } = await import('../../../app/stores/roomSeats')
    const { useLuckyNumber } = await import('../../../app/composables/lucky/useLuckyNumber')

    const roomStore = useRoomStore()
    const seatsStore = useRoomSeatsStore()
    roomStore.currentRoom = { id: 42 } as never

    vi.stubGlobal('useRoomStore', () => roomStore)
    vi.stubGlobal('useRoomSeatsStore', () => seatsStore)
    vi.stubGlobal('useRoomHierarchy', () => ({ canModerate: ref(canModerate) }))

    return { roomStore, seatsStore, ...useLuckyNumber() }
  }

  it("emits 'luckyNumber:start' with { roomId: '42' } when enabled + moderator + no live round + no cooldown", async () => {
    const { seatsStore, startRound } = await setup(true)
    seatsStore.setLuckyNumberEnabled(true)

    startRound()

    expect(mockSocket.emit).toHaveBeenCalledWith('luckyNumber:start', { roomId: '42' })
  })

  it("GATE: no emit when disabled (startGateError === 'disabled')", async () => {
    const { seatsStore, startRound, startGateError } = await setup(true)
    seatsStore.setLuckyNumberEnabled(false)

    expect(startGateError.value).toBe('disabled')
    startRound()
    expect(mockSocket.emit).not.toHaveBeenCalled()
  })

  it("GATE: no emit when not moderator (startGateError === 'not-moderator')", async () => {
    const { seatsStore, startRound, startGateError } = await setup(false)
    seatsStore.setLuckyNumberEnabled(true)

    expect(startGateError.value).toBe('not-moderator')
    startRound()
    expect(mockSocket.emit).not.toHaveBeenCalled()
  })

  it("GATE: no emit while a round is live (startGateError === 'round-live')", async () => {
    const { seatsStore, startRound, startGateError } = await setup(true)
    seatsStore.setLuckyNumberEnabled(true)
    seatsStore.startLuckyNumberRound('r1', Date.now() + 10000)

    expect(startGateError.value).toBe('round-live')
    startRound()
    expect(mockSocket.emit).not.toHaveBeenCalled()
  })

  it("GATE: no emit during cooldown ('cooling-down'); clears after the cooldown elapses", async () => {
    const { seatsStore, startRound, startGateError } = await setup(true)
    seatsStore.setLuckyNumberEnabled(true)
    seatsStore.setLuckyNumberReveal(
      { roundId: 'r1', drawn: 5, picks: {}, winners: [] },
      15000,
    )
    await nextTick()

    expect(startGateError.value).toBe('cooling-down')
    startRound()
    expect(mockSocket.emit).not.toHaveBeenCalled()

    vi.advanceTimersByTime(15000)
    await nextTick()

    expect(startGateError.value).toBeNull()
    startRound()
    expect(mockSocket.emit).toHaveBeenCalledWith('luckyNumber:start', { roomId: '42' })
  })

  it('secondsLeft derives from endsAt and ticks down with the local clock', async () => {
    const { seatsStore, secondsLeft } = await setup(true)
    seatsStore.startLuckyNumberRound('r1', Date.now() + 10000)
    await nextTick()

    expect(secondsLeft.value).toBe(10)

    vi.advanceTimersByTime(3000)
    expect(secondsLeft.value).toBe(7)

    seatsStore.clearLuckyNumber()
    expect(secondsLeft.value).toBe(0)
  })

  it('canSeeStartButton is false when enabled but not moderator, and when moderator but not enabled', async () => {
    const notModerator = await setup(false)
    notModerator.seatsStore.setLuckyNumberEnabled(true)
    expect(notModerator.canSeeStartButton.value).toBe(false)

    const notEnabled = await setup(true)
    notEnabled.seatsStore.setLuckyNumberEnabled(false)
    expect(notEnabled.canSeeStartButton.value).toBe(false)
  })
})

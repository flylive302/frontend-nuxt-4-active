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
vi.stubGlobal('piniaPluginPersistedstate', {
  cookies: () => ({}),
  localStorage: () => ({}),
  sessionStorage: () => ({}),
})

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

  async function setup(canModerate = true, userId: number | undefined = 7) {
    const { useRoomStore } = await import('../../../app/stores/room')
    const { useRoomSeatsStore } = await import('../../../app/stores/roomSeats')
    const { useAuthStore } = await import('../../../app/stores/auth')
    const { useLuckyNumber } = await import('../../../app/composables/lucky/useLuckyNumber')

    const roomStore = useRoomStore()
    const seatsStore = useRoomSeatsStore()
    const authStore = useAuthStore()
    roomStore.currentRoom = { id: 42 } as never
    authStore.user = (userId === undefined ? null : { id: userId }) as never

    vi.stubGlobal('useRoomStore', () => roomStore)
    vi.stubGlobal('useRoomSeatsStore', () => seatsStore)
    vi.stubGlobal('useAuthStore', () => authStore)
    vi.stubGlobal('useRoomHierarchy', () => ({ canModerate: ref(canModerate) }))

    return { roomStore, seatsStore, authStore, ...useLuckyNumber() }
  }

  /** Seat userId 7 into seat 0 of the real seats store. */
  function seatUser(seatsStore: Awaited<ReturnType<typeof setup>>['seatsStore'], userId = 7) {
    seatsStore.updateSeat(0, userId, false)
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

  it('cooldownSecondsLeft counts down after a result and reaches 0 when the cooldown ends', async () => {
    const { seatsStore, cooldownSecondsLeft, isCoolingDown } = await setup(true)
    seatsStore.setLuckyNumberReveal({ roundId: 'r1', drawn: 4, picks: {}, winners: [] }, 15000)
    await nextTick()
    expect(cooldownSecondsLeft.value).toBe(15)
    await vi.advanceTimersByTimeAsync(5000)
    expect(cooldownSecondsLeft.value).toBe(10)
    await vi.advanceTimersByTimeAsync(10000)
    expect(cooldownSecondsLeft.value).toBe(0)
    expect(isCoolingDown.value).toBe(false)
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

  describe('pick (lucky-number/02)', () => {
    it("emits 'luckyNumber:pick' with { roomId, roundId, number } when seated + round live", async () => {
      const { seatsStore, pick } = await setup()
      seatUser(seatsStore)
      seatsStore.startLuckyNumberRound('r1', Date.now() + 10000)

      pick(5)

      expect(mockSocket.emit).toHaveBeenCalledWith('luckyNumber:pick', {
        roomId: '42',
        roundId: 'r1',
        number: 5,
      }, expect.any(Function))
    })

    it("GATE: no emit when not seated (pickGateError === 'not-seated')", async () => {
      const { seatsStore, pick, pickGateError } = await setup()
      seatsStore.startLuckyNumberRound('r1', Date.now() + 10000)

      expect(pickGateError.value).toBe('not-seated')
      pick(5)
      expect(mockSocket.emit).not.toHaveBeenCalled()
    })

    it("GATE: no emit when no round (pickGateError === 'no-round')", async () => {
      const { seatsStore, pick, pickGateError } = await setup()
      seatUser(seatsStore)

      expect(pickGateError.value).toBe('no-round')
      pick(5)
      expect(mockSocket.emit).not.toHaveBeenCalled()
    })

    it('GATE: out-of-range numbers (0, 10, 2.5) are refused without changing pickGateError', async () => {
      const { seatsStore, pick, pickGateError } = await setup()
      seatUser(seatsStore)
      seatsStore.startLuckyNumberRound('r1', Date.now() + 10000)

      for (const n of [0, 10, 2.5]) {
        pick(n)
        expect(pickGateError.value).toBeNull()
      }
      expect(mockSocket.emit).not.toHaveBeenCalled()
    })

    it('canPick is true only when seated AND round live', async () => {
      const { seatsStore, canPick } = await setup()
      expect(canPick.value).toBe(false)

      seatUser(seatsStore)
      expect(canPick.value).toBe(false)

      seatsStore.startLuckyNumberRound('r1', Date.now() + 10000)
      expect(canPick.value).toBe(true)

      seatsStore.clearLuckyNumber()
      expect(canPick.value).toBe(false)
    })

    it('myPick reflects the last tapped number and resets to null on a new round', async () => {
      const { seatsStore, pick, myPick } = await setup()
      seatUser(seatsStore)
      seatsStore.startLuckyNumberRound('r1', Date.now() + 10000)

      expect(myPick.value).toBeNull()
      pick(5)
      expect(myPick.value).toBe(5)

      seatsStore.startLuckyNumberRound('r2', Date.now() + 10000)
      expect(myPick.value).toBeNull()
    })

    it('drops myPick when the server ack refuses the pick', async () => {
      const { seatsStore, pick, myPick } = await setup()
      seatUser(seatsStore)
      seatsStore.startLuckyNumberRound('r1', Date.now() + 10000)

      pick(4)
      expect(myPick.value).toBe(4)

      const ack = mockSocket.emit.mock.calls[0]![2] as (r?: { success?: boolean }) => void
      ack({ success: false })
      expect(myPick.value).toBeNull()
    })

    it('coalesces rapid taps: first emits immediately, later taps in the window collapse to one trailing emit', async () => {
      const { seatsStore, pick } = await setup()
      seatUser(seatsStore)
      seatsStore.startLuckyNumberRound('r1', Date.now() + 10000)

      pick(3)
      expect(mockSocket.emit).toHaveBeenCalledTimes(1)
      expect(mockSocket.emit).toHaveBeenLastCalledWith('luckyNumber:pick', {
        roomId: '42',
        roundId: 'r1',
        number: 3,
      }, expect.any(Function))

      pick(4)
      pick(5)
      expect(mockSocket.emit).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(300)
      expect(mockSocket.emit).toHaveBeenCalledTimes(2)
      expect(mockSocket.emit).toHaveBeenLastCalledWith('luckyNumber:pick', {
        roomId: '42',
        roundId: 'r1',
        number: 5,
      }, expect.any(Function))

      // Once a full throttle window has elapsed since that last emit, a fresh tap emits immediately again.
      vi.advanceTimersByTime(300)
      pick(2)
      expect(mockSocket.emit).toHaveBeenCalledTimes(3)
      expect(mockSocket.emit).toHaveBeenLastCalledWith('luckyNumber:pick', {
        roomId: '42',
        roundId: 'r1',
        number: 2,
      }, expect.any(Function))
    })

    it('no local echo: seatsStore.luckyNumberPickedUserIds stays empty after pick', async () => {
      const { seatsStore, pick } = await setup()
      seatUser(seatsStore)
      seatsStore.startLuckyNumberRound('r1', Date.now() + 10000)

      pick(5)

      expect(seatsStore.luckyNumberPickedUserIds.size).toBe(0)
    })

    it('reveal.picks passes through from the store', async () => {
      const { seatsStore, reveal } = await setup()
      seatsStore.setLuckyNumberReveal(
        { roundId: 'r1', drawn: 5, picks: { '7': 5, '9': 2 }, winners: ['7'] },
        15000,
      )

      expect(reveal.value?.picks).toEqual({ '7': 5, '9': 2 })
    })
  })
})

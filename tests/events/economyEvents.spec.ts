/**
 * useEconomyEvents (app/events/economy.events.ts) — `balance.updated` routing
 * (gift-authority-tick-fanout ticket 13). A payload carrying `seq` must go
 * through the sequence-guarded `authStore.applyBalance`; one without `seq`
 * (legacy / capability absent) must keep using the unconditional
 * `authStore.updateBalance`, byte-identical to before.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

function createMockSocket() {
  const handlers = new Map<string, (payload: unknown) => void>()
  return {
    handlers,
    on: vi.fn((event: string, cb: (payload: unknown) => void) => {
      handlers.set(event, cb)
    }),
  }
}

const applyBalance = vi.fn()
const updateBalance = vi.fn()
const updateWealthXp = vi.fn()
const updateCharmXp = vi.fn()
const syncXpFromBalance = vi.fn()
const toastAdd = vi.fn()

vi.stubGlobal('useAuthStore', () => ({ applyBalance, updateBalance }))
vi.stubGlobal('useLevelActions', () => ({ updateWealthXp, updateCharmXp, syncXpFromBalance }))
vi.stubGlobal('useToast', () => ({ add: toastAdd }))

describe('useEconomyEvents — balance.updated', () => {
  let socket: ReturnType<typeof createMockSocket>

  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    const { useEconomyEvents } = await import('../../app/events/economy.events')
    socket = createMockSocket()
    useEconomyEvents()(socket as never)
  })

  /** Flush the frame coalescer's rAF/timeout-scheduled apply. */
  async function flushFrame() {
    await new Promise((resolve) => setTimeout(resolve, 20))
  }

  it('a payload WITH seq goes through the sequence-guarded setter, not the legacy one', async () => {
    const payload = { coins: '900', diamonds: '10', wealth_xp: '5', charm_xp: '2', seq: 7 }

    socket.handlers.get('balance.updated')!(payload)
    await flushFrame()

    expect(applyBalance).toHaveBeenCalledWith({
      coins: '900',
      diamonds: '10',
      wealth_xp: '5',
      charm_xp: '2',
      seq: 7,
    })
    expect(updateBalance).not.toHaveBeenCalled()
  })

  it('a payload WITHOUT seq stays on the legacy unconditional setter', async () => {
    const payload = { coins: '900', diamonds: '10', wealth_xp: '5', charm_xp: '2' }

    socket.handlers.get('balance.updated')!(payload)
    await flushFrame()

    expect(updateBalance).toHaveBeenCalledWith({
      coins: '900',
      diamonds: '10',
      wealth_xp: '5',
      charm_xp: '2',
    })
    expect(applyBalance).not.toHaveBeenCalled()
  })

  it('within one coalesce frame, a lower-seq payload arriving after a higher one does not displace it', async () => {
    const higher = { coins: '850', diamonds: '10', wealth_xp: '5', charm_xp: '2', seq: 6 }
    const lower = { coins: '900', diamonds: '10', wealth_xp: '5', charm_xp: '2', seq: 5 }

    socket.handlers.get('balance.updated')!(higher)
    socket.handlers.get('balance.updated')!(lower) // stale — must not win the frame
    await flushFrame()

    expect(applyBalance).toHaveBeenCalledTimes(1)
    expect(applyBalance).toHaveBeenCalledWith(expect.objectContaining({ coins: '850', seq: 6 }))
  })

  it('XP sync still runs on the seq path — level bars must not freeze', async () => {
    const payload = { coins: '900', diamonds: '10', wealth_xp: '5', charm_xp: '2', seq: 1 }

    socket.handlers.get('balance.updated')!(payload)
    await flushFrame()

    expect(updateWealthXp).toHaveBeenCalledWith(5)
    expect(updateCharmXp).toHaveBeenCalledWith(2)
    expect(syncXpFromBalance).toHaveBeenCalledWith('5', '2')
  })
})

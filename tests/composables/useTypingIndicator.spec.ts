/**
 * useTypingIndicator (dm-realtime-platform/04) — typing indicator transport
 * migrated from a Reverb whisper to an ephemeral MSAB socket relay.
 *
 * Public API is unchanged (isOtherTyping/sendTyping/listenForTyping/
 * stopListening); this test covers throttled emit, thread-open/close
 * signaling, and the indicator set/clear-after-timeout behavior.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readonly, ref } from 'vue'

vi.stubGlobal('readonly', readonly)
vi.stubGlobal('ref', ref)

// ── Mock useAudioSocket — the only transport dependency ───
function createMockSocket() {
  const handlers = new Map<string, (payload: unknown) => void>()
  return {
    connected: true,
    emit: vi.fn(),
    on: vi.fn((event: string, cb: (payload: unknown) => void) => {
      handlers.set(event, cb)
    }),
    off: vi.fn((event: string) => {
      handlers.delete(event)
    }),
    handlers,
  }
}

let mockSocket: ReturnType<typeof createMockSocket>
vi.mock('../../app/composables/room/useAudioSocket', () => ({
  useAudioSocket: () => ({ socket: ref(mockSocket) }),
}))

// ── Mock useInboxStore (Pinia auto-import) ────────────────
const store = {
  activeThreadId: null as string | null,
  threadById: vi.fn(),
}
vi.stubGlobal('useInboxStore', () => store)

describe('useTypingIndicator', () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockSocket = createMockSocket()
    store.activeThreadId = null
    store.threadById.mockReturnValue({ participant: { id: '7' } })
  })

  async function setup() {
    const { useTypingIndicator } = await import('../../app/composables/inbox/useTypingIndicator')
    return useTypingIndicator()
  }

  describe('sendTyping (throttled emit)', () => {
    it('emits dm:typing with threadId + peerUserId when composing', async () => {
      store.activeThreadId = '42'
      const { sendTyping } = await setup()

      sendTyping()

      expect(mockSocket.emit).toHaveBeenCalledWith('dm:typing', { threadId: '42', peerUserId: 7 })
    })

    it('GATE: does not emit when there is no active thread', async () => {
      store.activeThreadId = null
      const { sendTyping } = await setup()

      sendTyping()

      expect(mockSocket.emit).not.toHaveBeenCalled()
    })

    it('GATE: does not emit when the socket is not connected', async () => {
      store.activeThreadId = '42'
      mockSocket.connected = false
      const { sendTyping } = await setup()

      sendTyping()

      expect(mockSocket.emit).not.toHaveBeenCalled()
    })

    it('throttles rapid repeated calls to one emit per window', async () => {
      store.activeThreadId = '42'
      const { sendTyping } = await setup()

      sendTyping()
      sendTyping()
      sendTyping()

      expect(mockSocket.emit).toHaveBeenCalledTimes(1)
    })

    it('emits again after the throttle window elapses', async () => {
      store.activeThreadId = '42'
      const { sendTyping } = await setup()

      sendTyping()
      expect(mockSocket.emit).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(2001)
      sendTyping()

      expect(mockSocket.emit).toHaveBeenCalledTimes(2)
    })
  })

  describe('listenForTyping / stopListening (thread open/close + indicator lifecycle)', () => {
    it('emits dm:thread.opened and registers a dm:typing listener', async () => {
      const { listenForTyping } = await setup()

      listenForTyping('42')

      expect(mockSocket.emit).toHaveBeenCalledWith('dm:thread.opened', { threadId: '42' })
      expect(mockSocket.handlers.has('dm:typing')).toBe(true)
    })

    it('sets isOtherTyping on receipt and clears it after the timeout with no further signal', async () => {
      const { isOtherTyping, listenForTyping } = await setup()
      listenForTyping('42')

      mockSocket.handlers.get('dm:typing')!({ threadId: '42', userId: 7 })
      expect(isOtherTyping.value).toBe(true)

      vi.advanceTimersByTime(3001)
      expect(isOtherTyping.value).toBe(false)
    })

    it('ignores dm:typing signals for a different thread than the one currently listened to', async () => {
      const { isOtherTyping, listenForTyping } = await setup()
      listenForTyping('42')

      mockSocket.handlers.get('dm:typing')!({ threadId: 'other-thread', userId: 7 })

      expect(isOtherTyping.value).toBe(false)
    })

    it('ignores dm:typing signals whose userId is not the thread peer (spoof guard)', async () => {
      const { isOtherTyping, listenForTyping } = await setup()
      listenForTyping('42')

      mockSocket.handlers.get('dm:typing')!({ threadId: '42', userId: 999 })

      expect(isOtherTyping.value).toBe(false)
    })

    it('resets the auto-dismiss timer on repeated signals (stays true across the gap)', async () => {
      const { isOtherTyping, listenForTyping } = await setup()
      listenForTyping('42')

      mockSocket.handlers.get('dm:typing')!({ threadId: '42', userId: 7 })
      vi.advanceTimersByTime(2000)
      mockSocket.handlers.get('dm:typing')!({ threadId: '42', userId: 7 })
      vi.advanceTimersByTime(2000)

      expect(isOtherTyping.value).toBe(true)
    })

    it('stopListening emits dm:thread.closed, clears the indicator, and unregisters the listener', async () => {
      const { isOtherTyping, listenForTyping, stopListening } = await setup()
      listenForTyping('42')
      mockSocket.handlers.get('dm:typing')!({ threadId: '42', userId: 7 })
      expect(isOtherTyping.value).toBe(true)

      stopListening('42')

      expect(mockSocket.emit).toHaveBeenCalledWith('dm:thread.closed', { threadId: '42' })
      expect(isOtherTyping.value).toBe(false)
      expect(mockSocket.off).toHaveBeenCalledWith('dm:typing', expect.any(Function))
    })
  })
})

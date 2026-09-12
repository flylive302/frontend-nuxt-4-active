/**
 * room-page-runtime-audit 03 — `sendChatMessage` must tell the caller whether
 * anything was sent, so the composer can keep the draft during a reconnect.
 */
import { describe, it, expect, vi } from 'vitest'
import { shallowRef } from 'vue'
import { useRoomChat } from '~/composables/room/useRoomChat'
import type { AudioSocket } from '~/composables/room/useAudioSocket'

function fakeSocket(connected: boolean) {
  const emit = vi.fn()
  return { socket: { connected, emit } as unknown as AudioSocket, emit }
}

describe('useRoomChat.sendChatMessage', () => {
  it('null socket → false, nothing emitted', () => {
    const socket = shallowRef<AudioSocket | null>(null)
    const { sendChatMessage } = useRoomChat({ socket, getCurrentRoomId: () => 'room-1' })
    expect(sendChatMessage('hi')).toBe(false)
  })

  it('socket present but not connected (mid-reconnect) → false, nothing emitted', () => {
    const { socket, emit } = fakeSocket(false)
    const { sendChatMessage } = useRoomChat({ socket: shallowRef<AudioSocket | null>(socket), getCurrentRoomId: () => 'room-1' })
    expect(sendChatMessage('hi')).toBe(false)
    expect(emit).not.toHaveBeenCalled()
  })

  it('no current Room → false, nothing emitted', () => {
    const { socket, emit } = fakeSocket(true)
    const { sendChatMessage } = useRoomChat({ socket: shallowRef<AudioSocket | null>(socket), getCurrentRoomId: () => null })
    expect(sendChatMessage('hi')).toBe(false)
    expect(emit).not.toHaveBeenCalled()
  })

  it('connected + Room → emits chat:message and returns true', () => {
    const { socket, emit } = fakeSocket(true)
    const { sendChatMessage } = useRoomChat({ socket: shallowRef<AudioSocket | null>(socket), getCurrentRoomId: () => 'room-1' })
    expect(sendChatMessage('hi')).toBe(true)
    expect(emit).toHaveBeenCalledWith('chat:message', { roomId: 'room-1', content: 'hi', type: 'text' })
  })
})

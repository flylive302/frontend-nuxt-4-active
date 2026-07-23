/**
 * Unit tests for useSlideEvents — lucky-win chat announcement bubble
 * (lucky-burst-draw ticket 10). `slide:play`'s `lucky` block presence means
 * the win crossed the server-side slide-binding threshold by construction —
 * no client-side threshold check is exercised here.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed } from 'vue'
import { CHAT_MESSAGE_TYPE_LUCKY_WIN } from '../../app/constants/room'
import type { SlidePlayPayload } from '../../app/types/slide'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('piniaPluginPersistedstate', {
  cookies: () => ({}),
  localStorage: () => ({}),
  sessionStorage: () => ({}),
})

function createMockSocket() {
  const handlers = new Map<string, (payload: unknown) => void>()
  return {
    handlers,
    on: vi.fn((event: string, cb: (payload: unknown) => void) => {
      handlers.set(event, cb)
    }),
    off: vi.fn(),
  }
}

const BASE_PAYLOAD: SlidePlayPayload = {
  slideId: 1,
  svgaUrl: 'https://example.com/slide.svga',
  top: 100,
  height: 200,
  scope: 'room',
  priority: 1,
  replaceElements: {},
  texts: {},
  link: { type: 'profile', userId: 5 },
}

describe('useSlideEvents — lucky-win chat bubble', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('useSlidePlayback', () => ({ admitPayload: vi.fn() }))
  })

  async function setup(currentRoomId: number | undefined) {
    const { useSlideEvents } = await import('../../app/events/slide.events')
    const { useRoomStore } = await import('../../app/stores/room')
    const { useRoomAudioStore } = await import('../../app/stores/roomAudio')

    const roomStore = useRoomStore()
    if (currentRoomId !== undefined) {
      roomStore.setCurrentRoom({ id: currentRoomId } as never)
    }
    const audioStore = useRoomAudioStore()
    vi.stubGlobal('useRoomStore', () => roomStore)
    vi.stubGlobal('useRoomAudioStore', () => audioStore)

    const socket = createMockSocket()
    const registerSlideEvents = useSlideEvents()
    registerSlideEvents(socket as never)
    return { socket, audioStore }
  }

  it('lucky block + matching room → gold lucky-win bubble with exact copy', async () => {
    const { socket, audioStore } = await setup(1)

    socket.handlers.get('slide:play')?.({
      ...BASE_PAYLOAD,
      lucky: { winnerId: 5, winnerName: 'Sara', multiplier: 20, coinsWon: 5000, roomId: 1 },
    })

    expect(audioStore.messages).toHaveLength(1)
    expect(audioStore.messages[0]?.type).toBe(CHAT_MESSAGE_TYPE_LUCKY_WIN)
    expect(audioStore.messages[0]?.content).toBe('Sara got a Lucky win of 20x — won 5,000 coins')
  })

  it('lucky block + different room → bubble still shows (follows the slide, HITL 2026-07-23)', async () => {
    const { socket, audioStore } = await setup(2)

    socket.handlers.get('slide:play')?.({
      ...BASE_PAYLOAD,
      lucky: { winnerId: 5, winnerName: 'Sara', multiplier: 20, coinsWon: 5000, roomId: 1 },
    })

    expect(audioStore.messages).toHaveLength(1)
    expect(audioStore.messages[0]?.type).toBe(CHAT_MESSAGE_TYPE_LUCKY_WIN)
  })

  it('no lucky block (plain gift/entry slide) → no bubble', async () => {
    const { socket, audioStore } = await setup(1)

    socket.handlers.get('slide:play')?.(BASE_PAYLOAD)

    expect(audioStore.messages).toHaveLength(0)
  })

  it('formats a whole-number multiplier without trailing decimals (20 → "20x")', async () => {
    const { socket, audioStore } = await setup(1)

    socket.handlers.get('slide:play')?.({
      ...BASE_PAYLOAD,
      lucky: { winnerId: 5, winnerName: 'Sara', multiplier: 20.0, coinsWon: 100, roomId: 1 },
    })

    expect(audioStore.messages[0]?.content).toContain('20x —')
  })

  it('formats a fractional multiplier keeping the decimal (0.5 → "0.5x")', async () => {
    const { socket, audioStore } = await setup(1)

    socket.handlers.get('slide:play')?.({
      ...BASE_PAYLOAD,
      lucky: { winnerId: 5, winnerName: 'Sara', multiplier: 0.5, coinsWon: 50, roomId: 1 },
    })

    expect(audioStore.messages[0]?.content).toContain('0.5x —')
  })
})

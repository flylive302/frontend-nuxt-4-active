/**
 * room-page-runtime-audit 01 — the HLS↔WebRTC handoff is ONE watcher per app
 * process, not one per `useRoomAudio()` caller.
 *
 * Before the hoist, every caller of `useRoomAudio()` (10 files) owned its own
 * `watch` + its own `webrtcVolume` copy. One tier flip → N `broadcastHls.start()`
 * and a last-writer-wins volume restore. These specs lock the singleton.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ref, nextTick } from 'vue'
import {
  ensureTransportHandoff,
  __resetTransportHandoffForTests,
  type TransportHandoffDeps,
} from '~/composables/room/audio/useTransportHandoff'

function makeWorld() {
  const mode = ref<'interactive' | 'broadcast'>('interactive')
  const hlsUrl = ref<string | null>('https://cdn/room.m3u8')
  const speaker = ref(false)
  let webrtcVolume = 0.8
  const deps: TransportHandoffDeps = {
    getMode: () => mode.value,
    getHlsPlaybackUrl: () => hlsUrl.value,
    isSpeaker: () => speaker.value,
    setMediasoupVolume: vi.fn((v: number) => { webrtcVolume = v }),
    getMediasoupVolume: vi.fn(() => webrtcVolume),
    broadcastHls: {
      start: vi.fn(async () => {}),
      stop: vi.fn(),
      setVolume: vi.fn(),
    },
  }
  return { mode, hlsUrl, speaker, deps, webrtc: () => webrtcVolume }
}

describe('ensureTransportHandoff', () => {
  beforeEach(() => __resetTransportHandoffForTests())
  afterEach(() => __resetTransportHandoffForTests())

  it('two callers, one broadcast flip → broadcastHls.start called ONCE', async () => {
    const w = makeWorld()
    const h1 = ensureTransportHandoff(w.deps)
    const h2 = ensureTransportHandoff(w.deps)
    expect(h2).toBe(h1)

    w.mode.value = 'broadcast'
    await nextTick()

    expect(w.deps.broadcastHls.start).toHaveBeenCalledTimes(1)
    expect(w.deps.broadcastHls.start).toHaveBeenCalledWith('https://cdn/room.m3u8')
    expect(h1.activeTransport()).toBe('hls')
    // WebRTC tier silenced, HLS carries the Listener's volume.
    expect(w.deps.setMediasoupVolume).toHaveBeenLastCalledWith(0)
    expect(w.deps.broadcastHls.setVolume).toHaveBeenLastCalledWith(0.8)
  })

  it('volume set through ANY caller is the one restored on the way back', async () => {
    const w = makeWorld()
    const page = ensureTransportHandoff(w.deps)
    const child = ensureTransportHandoff(w.deps)

    // Listener lowers volume via the page's handle while on WebRTC.
    page.setVolume(0.3)
    expect(w.deps.setMediasoupVolume).toHaveBeenLastCalledWith(0.3)

    w.mode.value = 'broadcast'
    await nextTick()
    expect(w.deps.broadcastHls.setVolume).toHaveBeenLastCalledWith(0.3)

    // Changing volume while on HLS goes to the HLS element, via a different handle.
    child.setVolume(0.5)
    expect(w.deps.broadcastHls.setVolume).toHaveBeenLastCalledWith(0.5)

    w.mode.value = 'interactive'
    await nextTick()
    expect(w.deps.broadcastHls.stop).toHaveBeenCalledTimes(1)
    // Restore = the last chosen value, not the setup-time 0.8 and not 1.
    expect(w.deps.setMediasoupVolume).toHaveBeenLastCalledWith(0.5)
    expect(page.activeTransport()).toBe('webrtc')
  })

  it('a Speaker in a broadcast room stays on WebRTC; stepping down moves to HLS', async () => {
    const w = makeWorld()
    w.speaker.value = true
    w.mode.value = 'broadcast'
    const h = ensureTransportHandoff(w.deps)
    await nextTick()
    expect(w.deps.broadcastHls.start).not.toHaveBeenCalled()
    expect(h.activeTransport()).toBe('webrtc')

    w.speaker.value = false
    await nextTick()
    expect(w.deps.broadcastHls.start).toHaveBeenCalledTimes(1)
    expect(h.activeTransport()).toBe('hls')
  })

  it('same-tier re-fires do not stop/start the player (no churn)', async () => {
    const w = makeWorld()
    ensureTransportHandoff(w.deps)
    w.mode.value = 'broadcast'
    await nextTick()
    w.hlsUrl.value = 'https://cdn/room.m3u8' // unchanged value
    w.speaker.value = false // unchanged
    await nextTick()
    expect(w.deps.broadcastHls.start).toHaveBeenCalledTimes(1)
    expect(w.deps.broadcastHls.stop).not.toHaveBeenCalled()
  })
})

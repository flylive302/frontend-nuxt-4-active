// ========================================
// voicePlaybackEngine Tests (dm-messenger-v2/05)
// ========================================
// Engine tested in isolation via createVoicePlaybackEngine + a fake
// AudioLike backing (no real HTMLAudioElement / jsdom needed — vitest
// environment here is 'node'). Covers: exclusive playback, seek clamping,
// speed cycling + persistence across notes, ended reset.

import { describe, it, expect, beforeEach } from 'vitest'
import { createVoicePlaybackEngine, type AudioLike } from '~/services/voicePlaybackEngine'

class FakeAudio implements AudioLike {
  src = ''
  currentTime = 0
  duration = 60 // seconds
  playbackRate = 1
  played = false
  private listeners = new Map<string, Array<() => void>>()

  play(): Promise<void> {
    this.played = true
    return Promise.resolve()
  }

  pause(): void {
    this.played = false
  }

  addEventListener(type: string, listener: () => void): void {
    const list = this.listeners.get(type) ?? []
    list.push(listener)
    this.listeners.set(type, list)
  }

  emit(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) listener()
  }

  /** Test helper: simulate the browser reporting duration once metadata loads. */
  loadMetadata(durationSeconds: number): void {
    this.duration = durationSeconds
    this.emit('loadedmetadata')
  }

  /** Test helper: simulate a timeupdate tick at the given position. */
  tick(seconds: number): void {
    this.currentTime = seconds
    this.emit('timeupdate')
  }
}

describe('voicePlaybackEngine', () => {
  let audio: FakeAudio
  let engine: ReturnType<typeof createVoicePlaybackEngine>

  beforeEach(() => {
    audio = new FakeAudio()
    engine = createVoicePlaybackEngine(audio)
  })

  it('starts playback and sets the playing id', () => {
    engine.togglePlayback('msg-1', 'https://example.com/a.webm')
    expect(engine.playingMessageId.value).toBe('msg-1')
    expect(audio.src).toBe('https://example.com/a.webm')
    expect(audio.played).toBe(true)
  })

  it('exclusive playback: starting note B stops note A', () => {
    engine.togglePlayback('msg-a', 'https://example.com/a.webm')
    expect(engine.playingMessageId.value).toBe('msg-a')

    engine.togglePlayback('msg-b', 'https://example.com/b.webm')
    expect(engine.playingMessageId.value).toBe('msg-b')
    expect(audio.src).toBe('https://example.com/b.webm')
  })

  it('toggling the same playing id pauses it', () => {
    engine.togglePlayback('msg-1', 'https://example.com/a.webm')
    engine.togglePlayback('msg-1', 'https://example.com/a.webm')
    expect(engine.playingMessageId.value).toBeNull()
    expect(audio.played).toBe(false)
  })

  it('tracks position and duration via timeupdate/loadedmetadata', () => {
    engine.togglePlayback('msg-1', 'https://example.com/a.webm')
    audio.loadMetadata(30)
    audio.tick(5)
    expect(engine.durationMs.value).toBe(30_000)
    expect(engine.positionMs.value).toBe(5_000)
  })

  it('ended resets playing id and position', () => {
    engine.togglePlayback('msg-1', 'https://example.com/a.webm')
    audio.loadMetadata(30)
    audio.tick(10)
    audio.emit('ended')
    expect(engine.playingMessageId.value).toBeNull()
    expect(engine.positionMs.value).toBe(0)
  })

  it('seek clamps to [0, durationMs] and is a no-op when nothing is playing', () => {
    engine.seek(5_000)
    expect(engine.positionMs.value).toBe(0) // no-op: nothing playing

    engine.togglePlayback('msg-1', 'https://example.com/a.webm')
    audio.loadMetadata(20)

    engine.seek(-100)
    expect(engine.positionMs.value).toBe(0)
    expect(audio.currentTime).toBe(0)

    engine.seek(15_000)
    expect(engine.positionMs.value).toBe(15_000)
    expect(audio.currentTime).toBe(15)

    engine.seek(999_000)
    expect(engine.positionMs.value).toBe(20_000)
    expect(audio.currentTime).toBe(20)
  })

  it('setRate cycles 1 -> 1.5 -> 2 -> 1 and applies to the audio element', () => {
    expect(engine.playbackRate.value).toBe(1)
    engine.setRate()
    expect(engine.playbackRate.value).toBe(1.5)
    expect(audio.playbackRate).toBe(1.5)
    engine.setRate()
    expect(engine.playbackRate.value).toBe(2)
    engine.setRate()
    expect(engine.playbackRate.value).toBe(1)
  })

  it('rate persists across notes: set during note A still applies to note B', () => {
    engine.togglePlayback('msg-a', 'https://example.com/a.webm')
    engine.setRate()
    expect(engine.playbackRate.value).toBe(1.5)
    engine.togglePlayback('msg-a', 'https://example.com/a.webm') // pause A

    engine.togglePlayback('msg-b', 'https://example.com/b.webm')
    expect(engine.playbackRate.value).toBe(1.5)
    expect(audio.playbackRate).toBe(1.5)
  })

  it('is a no-op when audio backing is unavailable (SSR)', () => {
    const nullEngine = createVoicePlaybackEngine(null)
    expect(() => nullEngine.togglePlayback('msg-1', 'https://example.com/a.webm')).not.toThrow()
    expect(nullEngine.playingMessageId.value).toBeNull()
  })
})

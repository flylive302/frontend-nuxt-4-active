// ========================================
// DM Voice Playback Engine (dm-messenger-v2/04, polished 05)
// ========================================
// Single shared audio backing so two voice notes never play at once —
// starting a new note stops whichever was previously playing. Position,
// duration and playback rate are exposed as Vue refs (reactive-friendly,
// same pattern established in slice 04) for message-bubble.vue's waveform
// scrubber and speed toggle to derive from directly.

import { ref } from 'vue'
import { createLogger } from '~/utils/logger'
import { VOICE_PLAYBACK_RATES } from '~/constants/inbox'

const log = createLogger('[VoicePlaybackEngine]')

/** Minimal surface the engine needs from an audio element — lets tests inject a fake. */
export interface AudioLike {
  play: () => Promise<void> | void
  pause: () => void
  src: string
  currentTime: number
  duration: number
  playbackRate: number
  addEventListener: (type: string, listener: () => void) => void
}

export interface VoicePlaybackEngine {
  playingMessageId: ReturnType<typeof ref<string | null>>
  positionMs: ReturnType<typeof ref<number>>
  durationMs: ReturnType<typeof ref<number>>
  playbackRate: ReturnType<typeof ref<number>>
  togglePlayback: (id: string, url: string) => void
  stopPlayback: () => void
  seek: (ms: number) => void
  setRate: () => void
}

/** Builds an isolated engine instance around the given audio backing (or none, e.g. SSR). */
export function createVoicePlaybackEngine(audio: AudioLike | null): VoicePlaybackEngine {
  /** Message id of the note currently playing, or null if nothing is playing. */
  const playingMessageId = ref<string | null>(null)
  /** Current playback position of the active note, ms. Resets on stop/ended. */
  const positionMs = ref(0)
  /** Duration of the active note as reported by the audio element, ms (0 until known). */
  const durationMs = ref(0)
  /** Persists across notes for the session — set once, applied to every subsequent play. */
  const playbackRate = ref<number>(VOICE_PLAYBACK_RATES[0])

  if (audio) {
    audio.addEventListener('timeupdate', () => {
      positionMs.value = audio.currentTime * 1000
    })
    audio.addEventListener('loadedmetadata', () => {
      durationMs.value = Number.isFinite(audio.duration) ? audio.duration * 1000 : 0
    })
    audio.addEventListener('ended', () => {
      playingMessageId.value = null
      positionMs.value = 0
    })
  }

  /** Toggles playback for a given message id; starting a new one stops the previous. */
  function togglePlayback(id: string, url: string): void {
    if (!audio) return

    if (playingMessageId.value === id) {
      audio.pause()
      playingMessageId.value = null
      return
    }

    audio.src = url
    audio.currentTime = 0
    audio.playbackRate = playbackRate.value
    positionMs.value = 0
    durationMs.value = 0
    const playResult = audio.play()
    if (playResult && typeof (playResult as Promise<void>).catch === 'function') {
      (playResult as Promise<void>).catch(err => log.warn('Voice note playback failed', err))
    }
    playingMessageId.value = id
  }

  function stopPlayback(): void {
    if (!audio) return
    audio.pause()
    playingMessageId.value = null
    positionMs.value = 0
  }

  /** Seeks the active note to `ms`, clamped to [0, durationMs]. No-op if nothing is playing. */
  function seek(ms: number): void {
    if (!audio || !playingMessageId.value) return
    const clamped = Math.min(Math.max(ms, 0), durationMs.value || ms)
    audio.currentTime = clamped / 1000
    positionMs.value = clamped
  }

  /** Cycles 1x -> 1.5x -> 2x -> 1x. Rate persists for the session and applies to future notes too. */
  function setRate(): void {
    const currentIndex = VOICE_PLAYBACK_RATES.indexOf(playbackRate.value as (typeof VOICE_PLAYBACK_RATES)[number])
    const nextRate = VOICE_PLAYBACK_RATES[(currentIndex + 1) % VOICE_PLAYBACK_RATES.length]!
    playbackRate.value = nextRate
    if (audio) audio.playbackRate = nextRate
  }

  return { playingMessageId, positionMs, durationMs, playbackRate, togglePlayback, stopPlayback, seek, setRate }
}

const sharedEngine = createVoicePlaybackEngine(typeof Audio !== 'undefined' ? new Audio() : null)

export const playingMessageId = sharedEngine.playingMessageId
export const positionMs = sharedEngine.positionMs
export const durationMs = sharedEngine.durationMs
export const playbackRate = sharedEngine.playbackRate
export const togglePlayback = sharedEngine.togglePlayback
export const stopPlayback = sharedEngine.stopPlayback
export const seek = sharedEngine.seek
export const setRate = sharedEngine.setRate

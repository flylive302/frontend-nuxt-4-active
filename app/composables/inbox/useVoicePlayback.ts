// ========================================
// DM Voice Playback derivation (dm-messenger-v2/05)
// ========================================
// Subscribes to the shared voicePlaybackEngine and derives everything
// message-bubble.vue's voice row needs: static per-message waveform bars,
// playback progress, remaining time and the rate label. Component stays
// INTENT-only — all derivation lives here.

import { computed } from 'vue'
import {
  playingMessageId,
  positionMs,
  durationMs,
  playbackRate,
  togglePlayback,
  seek,
  setRate,
} from '~/services/voicePlaybackEngine'
import {
  VOICE_WAVEFORM_BAR_COUNT,
  VOICE_WAVEFORM_BAR_MIN_HEIGHT_PX,
  VOICE_WAVEFORM_BAR_MAX_HEIGHT_PX,
} from '~/constants/inbox'

/** Deterministic xorshift-ish PRNG seeded from the message id — same bars every render, no audio analysis. */
function seededBarHeights(seed: string): number[] {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  let state = hash || 1
  const bars: number[] = []
  for (let i = 0; i < VOICE_WAVEFORM_BAR_COUNT; i++) {
    state ^= state << 13
    state >>>= 0
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    const t = (state % 1000) / 1000
    bars.push(VOICE_WAVEFORM_BAR_MIN_HEIGHT_PX + t * (VOICE_WAVEFORM_BAR_MAX_HEIGHT_PX - VOICE_WAVEFORM_BAR_MIN_HEIGHT_PX))
  }
  return bars
}

export function useVoicePlayback(messageId: string, fallbackDurationMs: number) {
  const barHeights = seededBarHeights(messageId)

  const isPlaying = computed(() => playingMessageId.value === messageId)
  const effectiveDurationMs = computed(() => (isPlaying.value && (durationMs.value ?? 0) > 0) ? (durationMs.value ?? 0) : fallbackDurationMs)
  const currentPositionMs = computed(() => isPlaying.value ? (positionMs.value ?? 0) : 0)
  const progressRatio = computed(() => effectiveDurationMs.value > 0 ? Math.min(1, currentPositionMs.value / effectiveDurationMs.value) : 0)
  const remainingMs = computed(() => Math.max(0, effectiveDurationMs.value - currentPositionMs.value))
  const rateLabel = computed(() => `${playbackRate.value}×`)

  // INTENT -> EXECUTE: toggle this note's playback via the shared engine.
  function toggle(url: string): void {
    togglePlayback(messageId, url)
  }

  // INTENT -> EXECUTE: seek within the active note only; no-op while not playing.
  function seekToRatio(ratio: number): void {
    if (!isPlaying.value) return
    const clamped = Math.min(1, Math.max(0, ratio))
    seek(clamped * effectiveDurationMs.value)
  }

  function cycleRate(): void {
    setRate()
  }

  return {
    barHeights,
    isPlaying,
    progressRatio,
    currentPositionMs,
    remainingMs,
    rateLabel,
    toggle,
    seekToRatio,
    cycleRate,
  }
}

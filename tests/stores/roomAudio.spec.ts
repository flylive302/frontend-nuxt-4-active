import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, ref } from 'vue'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

beforeEach(() => {
  setActivePinia(createPinia())
})

// ============================================================
// mic-fgs-crash 02 — the pending mic re-claim's lifecycle.
//
// The flag is the observable contract between two layers: the rejoin path in
// `useRoomAudio` writes it when it declines to open the mic while hidden, and
// the resume path reads it to know what it owes. Its reset is what makes
// "leaving the Room drops any pending re-claim" true without a second code path.
// ============================================================
describe('roomAudioStore.pendingMicReclaim', () => {
  it('starts clear — a fresh session owes no re-claim', async () => {
    const { useRoomAudioStore } = await import('../../app/stores/roomAudio')
    const store = useRoomAudioStore()

    expect(store.pendingMicReclaim).toBe(false)
  })

  it('records a deferred re-claim and lets the drain settle it', async () => {
    const { useRoomAudioStore } = await import('../../app/stores/roomAudio')
    const store = useRoomAudioStore()

    store.setPendingMicReclaim(true)
    expect(store.pendingMicReclaim).toBe(true)

    store.setPendingMicReclaim(false)
    expect(store.pendingMicReclaim).toBe(false)
  })

  it('is cleared by the audio-state reset, so leaving a Room cannot leave a re-claim armed', async () => {
    const { useRoomAudioStore } = await import('../../app/stores/roomAudio')
    const store = useRoomAudioStore()

    store.setPendingMicReclaim(true)
    store.setProducing(true)

    // `leaveRoom()` calls exactly this — a pending re-claim must not survive it
    // and fire later in an unrelated Room.
    store.clearAudioState()

    expect(store.pendingMicReclaim).toBe(false)
    expect(store.audioState.isProducing).toBe(false)
  })
})

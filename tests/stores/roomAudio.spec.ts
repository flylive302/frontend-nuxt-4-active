import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, nextTick, ref, watch } from 'vue'

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

// ============================================================
// room-page-runtime-audit 02 — `appendSeq` is the "a message arrived" signal.
//
// `messages.length` is pinned at MAX_CHAT_MESSAGES once the buffer is full
// (splice+push in one sync call), so anything watching it goes deaf. The
// counter must keep moving by exactly +1 per append regardless of the cap.
// ============================================================
describe('roomAudioStore.appendSeq', () => {
  it('advances by one per append even after the buffer is capped at 500', async () => {
    const { useRoomAudioStore } = await import('../../app/stores/roomAudio')
    const { MAX_CHAT_MESSAGES } = await import('../../app/constants/room')
    const store = useRoomAudioStore()

    for (let i = 0; i < MAX_CHAT_MESSAGES + 1; i++) {
      store.addMessage({ id: `m-${i}`, userId: 1, content: '', type: 'text', timestamp: i })
    }

    expect(store.messages.length).toBe(MAX_CHAT_MESSAGES)
    expect(store.appendSeq).toBe(MAX_CHAT_MESSAGES + 1)
    // The newest message is still the array tail after the cap splice.
    expect(store.messages[store.messages.length - 1]?.id).toBe(`m-${MAX_CHAT_MESSAGES}`)
  })

  it('is NOT reset by clearMessages / clearAudioState (a reset would read as a negative delta)', async () => {
    const { useRoomAudioStore } = await import('../../app/stores/roomAudio')
    const store = useRoomAudioStore()

    store.addMessage({ id: 'a', userId: 1, content: '', type: 'text', timestamp: 0 })
    store.clearMessages()
    store.addMessage({ id: 'b', userId: 1, content: '', type: 'text', timestamp: 0 })
    store.clearAudioState()

    expect(store.messages).toEqual([])
    expect(store.appendSeq).toBe(2)
  })

  it('a watcher on appendSeq keeps firing past the cap, where a length watcher goes silent', async () => {
    const { useRoomAudioStore } = await import('../../app/stores/roomAudio')
    const { MAX_CHAT_MESSAGES } = await import('../../app/constants/room')
    const store = useRoomAudioStore()

    let seqFires = 0
    let lengthFires = 0
    watch(() => store.appendSeq, () => { seqFires++ })
    watch(() => store.messages.length, () => { lengthFires++ })

    for (let i = 0; i < MAX_CHAT_MESSAGES; i++) {
      store.addMessage({ id: `m-${i}`, userId: 1, content: '', type: 'text', timestamp: i })
    }
    await nextTick()
    const seqAtCap = seqFires
    const lengthAtCap = lengthFires

    // One more append at the cap: length is 500 → 500, seq is 500 → 501.
    store.addMessage({ id: 'over', userId: 1, content: '', type: 'text', timestamp: 0 })
    await nextTick()

    expect(lengthFires).toBe(lengthAtCap) // the old signal is dead here
    expect(seqFires).toBe(seqAtCap + 1) // the new one is not
  })
})

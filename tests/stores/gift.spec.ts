import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed } from 'vue'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

beforeEach(() => {
  setActivePinia(createPinia())
})

// ============================================================
// setLockedRecipient
// ============================================================
describe('useGiftStore.setLockedRecipient', () => {
  it('sets lockedRecipientId to the given id', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const store = useGiftStore()

    store.setLockedRecipient(42)

    expect(store.lockedRecipientId).toBe(42)
  })
})

// ============================================================
// clearLockedRecipient
// ============================================================
describe('useGiftStore.clearLockedRecipient', () => {
  it('resets lockedRecipientId to null', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const store = useGiftStore()

    store.setLockedRecipient(42)
    store.clearLockedRecipient()

    expect(store.lockedRecipientId).toBeNull()
  })
})

// ============================================================
// clearSelection
// ============================================================
describe('useGiftStore.clearSelection', () => {
  it('resets lockedRecipientId to null', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const store = useGiftStore()

    store.setLockedRecipient(42)
    store.clearSelection()

    expect(store.lockedRecipientId).toBeNull()
  })
})

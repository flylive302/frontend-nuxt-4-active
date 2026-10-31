// ========================================
// auth store — persist entries never share a storage key (account-bans 03)
// ========================================
// pinia-plugin-persistedstate defaults every entry's key to the store id. Two
// entries on the same storage with the same key overwrite each other: adding
// `blockInfo` without its own key silently stopped `user` from persisting.

import { describe, it, expect, vi } from 'vitest'
import { ref, computed } from 'vue'

type PersistEntry = { key?: string; pick?: string[]; storage: unknown }

const { captured } = vi.hoisted(() => ({
  captured: { id: '', persist: [] as PersistEntry[] },
}))

vi.mock('pinia', () => ({
  defineStore: (id: string, _setup: unknown, options: { persist: PersistEntry[] }) => {
    captured.id = id
    captured.persist = options.persist
    return () => ({})
  },
}))

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('piniaPluginPersistedstate', {
  cookies: () => 'cookies',
  localStorage: () => 'localStorage',
  sessionStorage: () => 'sessionStorage',
})

await import('~/stores/auth')

describe('auth store persist config', () => {
  it('every (storage, key) pair is unique', () => {
    const pairs = captured.persist.map((p) => `${String(p.storage)}::${p.key ?? captured.id}`)
    expect(new Set(pairs).size).toBe(pairs.length)
  })

  it('blockInfo is persisted (survives kill + relaunch) on durable storage', () => {
    const entry = captured.persist.find((p) => p.pick?.includes('blockInfo'))
    expect(entry?.storage).toBe('localStorage')
  })
})

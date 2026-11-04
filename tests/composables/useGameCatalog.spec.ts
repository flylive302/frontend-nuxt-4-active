// ========================================
// useGameCatalog — fetch once, cache, retry only on error
// ========================================
// /games shares ONE 20-per-minute limit with /games/launch and /games/close, so
// "how many times did we hit the endpoint" is the behaviour under test.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { setupNuxtMocks, cleanupNuxtMocks, createMockApi } from '../helpers/nuxtMocks'
import type { GameCatalogEntry } from '~/types/room/games'

vi.mock('~/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}))

const ROULETTE: GameCatalogEntry = { game_id: '10', name: 'Roulette', category: 'Casino', layout: 'half' }
const BIG_EATER: GameCatalogEntry = { game_id: '61', name: 'BigEater', category: 'Casino', layout: 'full' }

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

async function loadCatalog() {
  const api = vi.fn()
  setupNuxtMocks({ api: createMockApi({ api }) })

  const { useGameCatalog } = await import('~/composables/room/useGameCatalog')

  return { catalog: useGameCatalog(), api }
}

afterEach(() => {
  cleanupNuxtMocks()
  vi.restoreAllMocks()
})

describe('useGameCatalog — loading to ready', () => {
  it('starts idle and empty, and fetches nothing until asked', async () => {
    const { catalog, api } = await loadCatalog()

    expect(catalog.status.value).toBe('idle')
    expect(catalog.games.value).toEqual([])
    expect(api).not.toHaveBeenCalled()
  })

  it('goes loading → ready and exposes the games in server order', async () => {
    const { catalog, api } = await loadCatalog()
    const pending = deferred<{ data: GameCatalogEntry[] }>()
    api.mockReturnValue(pending.promise)

    const loading = catalog.load()
    expect(catalog.status.value).toBe('loading')

    pending.resolve({ data: [ROULETTE, BIG_EATER] })
    await loading

    expect(catalog.status.value).toBe('ready')
    expect(catalog.games.value).toEqual([ROULETTE, BIG_EATER])
    expect(api).toHaveBeenCalledWith('/games')
  })

  it('treats an empty list as ready, not as an error', async () => {
    const { catalog, api } = await loadCatalog()
    api.mockResolvedValue({ data: [] })

    await catalog.load()

    expect(catalog.status.value).toBe('ready')
    expect(catalog.games.value).toEqual([])
    expect(catalog.errorMessage.value).toBeNull()
  })
})

describe('useGameCatalog — cache', () => {
  it('fetches once across repeated loads', async () => {
    const { catalog, api } = await loadCatalog()
    api.mockResolvedValue({ data: [ROULETTE] })

    await catalog.load()
    await catalog.load()
    await catalog.load()

    expect(api).toHaveBeenCalledTimes(1)
    expect(catalog.games.value).toEqual([ROULETTE])
  })

  it('does not start a second request while one is in flight', async () => {
    const { catalog, api } = await loadCatalog()
    const pending = deferred<{ data: GameCatalogEntry[] }>()
    api.mockReturnValue(pending.promise)

    const first = catalog.load()
    const second = catalog.load()
    pending.resolve({ data: [ROULETTE] })
    await Promise.all([first, second])

    expect(api).toHaveBeenCalledTimes(1)
  })

  it('does not retry on its own after a failure — only retry() does', async () => {
    const { catalog, api } = await loadCatalog()
    api.mockRejectedValue(new Error('Network down'))

    await catalog.load()
    await catalog.load()

    expect(catalog.status.value).toBe('error')
    expect(api).toHaveBeenCalledTimes(1)
  })

  it('retry() does nothing unless the last attempt failed', async () => {
    const { catalog, api } = await loadCatalog()
    api.mockResolvedValue({ data: [ROULETTE] })

    await catalog.retry()
    expect(api).not.toHaveBeenCalled()

    await catalog.load()
    await catalog.retry()
    expect(api).toHaveBeenCalledTimes(1)
  })
})

describe('useGameCatalog — error and retry', () => {
  it('surfaces the error message and leaves the list empty', async () => {
    const { catalog, api } = await loadCatalog()
    api.mockRejectedValue(new Error('Network down'))

    await catalog.load()

    expect(catalog.status.value).toBe('error')
    expect(catalog.errorMessage.value).toBe('Network down')
    expect(catalog.games.value).toEqual([])
  })

  it('refetches on retry() and recovers to ready, clearing the error', async () => {
    const { catalog, api } = await loadCatalog()
    api.mockRejectedValueOnce(new Error('Network down'))
    api.mockResolvedValueOnce({ data: [ROULETTE] })

    await catalog.load()
    expect(catalog.status.value).toBe('error')

    await catalog.retry()

    expect(api).toHaveBeenCalledTimes(2)
    expect(catalog.status.value).toBe('ready')
    expect(catalog.errorMessage.value).toBeNull()
    expect(catalog.games.value).toEqual([ROULETTE])
  })

  it('can fail again on retry() and stay retryable', async () => {
    const { catalog, api } = await loadCatalog()
    api.mockRejectedValue(new Error('Still down'))

    await catalog.load()
    await catalog.retry()
    await catalog.retry()

    expect(api).toHaveBeenCalledTimes(3)
    expect(catalog.status.value).toBe('error')
  })

  it('treats a 200 that is not a list as an error rather than crashing the picker', async () => {
    const { catalog, api } = await loadCatalog()
    api.mockResolvedValue({ data: null })

    await catalog.load()

    expect(catalog.status.value).toBe('error')
    expect(catalog.games.value).toEqual([])
  })
})

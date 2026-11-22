import { beforeEach, describe, expect, it, vi } from 'vitest'

// The seam keeps one module-level mock instance, so every test loads a fresh copy of the module.
const hoisted = vi.hoisted(() => ({
  user: { value: null as { id: number, name: string, avatar: string | null } | null },
  createMock: vi.fn(),
}))

vi.mock('~/stores/auth', () => ({
  useAuthStore: () => ({ user: hoisted.user.value }),
}))
vi.mock('~/services/prettyIdMockApi', () => ({
  createPrettyIdMockApi: hoisted.createMock,
}))

function fakeBackend(tag: string) {
  return {
    api: { me: vi.fn(async () => tag), list: vi.fn(), search: vi.fn(), claim: vi.fn(), change: vi.fn(), auctions: vi.fn(), auction: vi.fn(), enter: vi.fn(), bid: vi.fn(), winners: vi.fn(), weekly: vi.fn() },
    controls: { state: vi.fn(() => tag), setLevel: vi.fn(), addCoins: vi.fn(), skipHours: vi.fn(), rivalBidsNow: vi.fn(() => 3), endAllAuctions: vi.fn(), toggleRace: vi.fn(), addChangeToken: vi.fn(() => true), reset: vi.fn() },
  }
}

async function loadSeam() {
  vi.resetModules()
  return import('~/composables/pretty-id/usePrettyIdApi')
}

describe('usePrettyIdApi seam', () => {
  beforeEach(() => {
    hoisted.createMock.mockReset()
    hoisted.createMock.mockImplementation((profile: { id: number }) => fakeBackend(`user-${profile.id}`))
    hoisted.user.value = { id: 5, name: 'Ana', avatar: 'https://cdn.test/a.png' }
  })

  it('does not build the mock until it is used', async () => {
    const { usePrettyIdApi, usePrettyIdMockControls } = await loadSeam()
    usePrettyIdApi()
    usePrettyIdMockControls()
    expect(hoisted.createMock).not.toHaveBeenCalled()
  })

  it('seeds the mock with the signed-in user', async () => {
    const { usePrettyIdApi } = await loadSeam()
    await usePrettyIdApi().me()
    expect(hoisted.createMock).toHaveBeenCalledWith({ id: 5, name: 'Ana', avatar_url: 'https://cdn.test/a.png' })
  })

  it('falls back to a generic profile when nobody is signed in', async () => {
    hoisted.user.value = null
    const { usePrettyIdApi } = await loadSeam()
    await usePrettyIdApi().me()
    expect(hoisted.createMock).toHaveBeenCalledWith({ id: 0, name: 'You', avatar_url: null })
  })

  it('serves api and controls from one shared instance', async () => {
    const { usePrettyIdApi, usePrettyIdMockControls } = await loadSeam()
    const api = usePrettyIdApi()
    const controls = usePrettyIdMockControls()
    await api.me()
    controls?.state()
    await usePrettyIdApi().me()
    expect(hoisted.createMock).toHaveBeenCalledTimes(1)
  })

  it('forwards arguments and return values to the instance', async () => {
    const { usePrettyIdApi, usePrettyIdMockControls } = await loadSeam()
    const api = usePrettyIdApi()
    const controls = usePrettyIdMockControls()
    await api.bid(7, 5_000)
    expect(controls?.rivalBidsNow()).toBe(3)
    expect(controls?.addChangeToken()).toBe(true)
    const backend = hoisted.createMock.mock.results[0]?.value as ReturnType<typeof fakeBackend>
    expect(backend.api.bid).toHaveBeenCalledWith(7, 5_000)
  })

  it('rebuilds the mock when the signed-in user changes, even for a reference taken earlier', async () => {
    const { usePrettyIdApi } = await loadSeam()
    const api = usePrettyIdApi()
    expect(await api.me()).toBe('user-5')

    hoisted.user.value = { id: 6, name: 'Bo', avatar: null }

    expect(await api.me()).toBe('user-6')
    expect(hoisted.createMock).toHaveBeenCalledTimes(2)
    expect(hoisted.createMock).toHaveBeenLastCalledWith({ id: 6, name: 'Bo', avatar_url: null })
  })
})

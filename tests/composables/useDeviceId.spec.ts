// ========================================
// useDeviceId Tests (account-bans 05)
// ========================================
// Native → Device.getId(), resolved once at boot; UUID fallback when getId()
// returns nothing, rejects or hangs; web keeps the stored UUID.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  useDeviceId,
  resolveNativeDeviceId,
  _resetDeviceIdCache,
} from '~/composables/shared/useDeviceId'

vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

const { mockIsNativePlatform, mockGetId } = vi.hoisted(() => ({
  mockIsNativePlatform: vi.fn(() => false),
  mockGetId: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: mockIsNativePlatform },
}))

vi.mock('@capacitor/device', () => ({
  Device: { getId: mockGetId },
}))

function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() { return data.size },
  }
}

describe('useDeviceId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _resetDeviceIdCache()
    vi.stubGlobal('localStorage', memoryStorage())
    mockIsNativePlatform.mockReturnValue(false)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('web: never calls Device.getId() and keeps one stored UUID', async () => {
    await resolveNativeDeviceId()

    const first = useDeviceId()
    expect(mockGetId).not.toHaveBeenCalled()
    expect(first).toMatch(/^[0-9a-f-]{36}$/)
    expect(useDeviceId()).toBe(first)
    expect(localStorage.getItem('flylive_device_id')).toBe(first)
  })

  it('native: sends the raw Device.getId() identifier once resolved', async () => {
    mockIsNativePlatform.mockReturnValue(true)
    mockGetId.mockResolvedValue({ identifier: 'a1b2c3d4e5f60718' })

    await resolveNativeDeviceId()

    expect(useDeviceId()).toBe('a1b2c3d4e5f60718')
  })

  it('native: falls back to the stored UUID when getId() returns an empty id', async () => {
    mockIsNativePlatform.mockReturnValue(true)
    mockGetId.mockResolvedValue({ identifier: '' })
    localStorage.setItem('flylive_device_id', 'stored-uuid')

    await resolveNativeDeviceId()

    expect(useDeviceId()).toBe('stored-uuid')
  })

  it('native: falls back to the stored UUID when getId() rejects', async () => {
    mockIsNativePlatform.mockReturnValue(true)
    mockGetId.mockRejectedValue(new Error('bridge down'))
    localStorage.setItem('flylive_device_id', 'stored-uuid')

    await expect(resolveNativeDeviceId()).resolves.toBeUndefined()
    expect(useDeviceId()).toBe('stored-uuid')
  })

  it('native: a getId() that hangs does not stall boot — resolves after the timeout on the UUID', async () => {
    vi.useFakeTimers()
    mockIsNativePlatform.mockReturnValue(true)
    mockGetId.mockReturnValue(new Promise(() => {})) // never settles
    localStorage.setItem('flylive_device_id', 'stored-uuid')

    const boot = resolveNativeDeviceId(1500)
    await vi.advanceTimersByTimeAsync(1500)
    await expect(boot).resolves.toBeUndefined()

    expect(useDeviceId()).toBe('stored-uuid')
  })

  it('native: a getId() that answers after the timeout still takes over for the rest of the session', async () => {
    vi.useFakeTimers()
    mockIsNativePlatform.mockReturnValue(true)
    let answer: (v: { identifier: string }) => void = () => {}
    mockGetId.mockReturnValue(new Promise((resolve) => { answer = resolve }))
    localStorage.setItem('flylive_device_id', 'stored-uuid')

    const boot = resolveNativeDeviceId(1500)
    await vi.advanceTimersByTimeAsync(1500)
    await boot
    expect(useDeviceId()).toBe('stored-uuid')

    answer({ identifier: 'late-native-id' })
    await vi.runAllTimersAsync()
    expect(useDeviceId()).toBe('late-native-id')
  })
})

describe('01.device-id plugin', () => {
  it('is awaited in order — never `parallel`, so no request can beat it', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const src = readFileSync(resolve(__dirname, '../../app/plugins/01.device-id.client.ts'), 'utf8')
    expect(src).toMatch(/await resolveNativeDeviceId\(\)/)
    expect(src).not.toMatch(/parallel\s*:\s*true/)
  })
})

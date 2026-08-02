// ========================================
// useRoomShare Composable Tests
// ========================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, readonly } from 'vue'
import { PLAY_STORE_URL } from '~/constants/share'

// ========================================
// Module mocks
// ========================================

const mockShare = vi.fn()

vi.mock('@capacitor/share', () => ({
  Share: { share: (...args: unknown[]) => mockShare(...args) },
}))

// ========================================
// Fixtures
// ========================================

const ROOM = { id: 42, name: 'Night Owls' }

let useRoomShare: typeof import('~/composables/room/useRoomShare')['useRoomShare']

describe('useRoomShare', () => {
  let mockToast: { add: ReturnType<typeof vi.fn> }
  let mockWriteText: ReturnType<typeof vi.fn>
  let currentRoom: { id: number; name: string } | null
  let originalNavigator: PropertyDescriptor | undefined

  beforeEach(async () => {
    originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
    currentRoom = ROOM
    mockToast = { add: vi.fn() }
    mockWriteText = vi.fn().mockResolvedValue(undefined)
    mockShare.mockReset()

    const g = globalThis as Record<string, unknown>
    g.ref = ref
    g.readonly = readonly
    g.useToast = () => mockToast
    g.useRoomStore = () => ({ get currentRoom() { return currentRoom } })
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText: mockWriteText } },
      configurable: true,
      writable: true,
    })

    const mod = await import('~/composables/room/useRoomShare')
    useRoomShare = mod.useRoomShare
  })

  afterEach(() => {
    for (const key of ['ref', 'readonly', 'useToast', 'useRoomStore']) {
      Reflect.deleteProperty(globalThis, key)
    }
    // Restore the real `navigator` — other suites read `navigator.userAgent`.
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator)
    else Reflect.deleteProperty(globalThis, 'navigator')
    vi.resetModules()
  })

  // ======================================================================
  // GATE
  // ======================================================================

  it('does nothing when there is no current room', async () => {
    currentRoom = null

    await useRoomShare().shareRoom()

    expect(mockShare).not.toHaveBeenCalled()
    expect(mockWriteText).not.toHaveBeenCalled()
  })

  // ======================================================================
  // EXECUTE — transport chain
  // ======================================================================

  it('uses the share sheet when available and stays silent on success', async () => {
    mockShare.mockResolvedValue({ activityType: 'com.whatsapp' })

    await useRoomShare().shareRoom()

    expect(mockShare).toHaveBeenCalledWith(
      expect.objectContaining({ url: PLAY_STORE_URL, text: expect.stringContaining('Room #42') }),
    )
    expect(mockWriteText).not.toHaveBeenCalled()
    expect(mockToast.add).not.toHaveBeenCalled()
  })

  it('falls back to the clipboard when the plugin is missing', async () => {
    mockShare.mockRejectedValue(new Error('"Share" plugin is not implemented on android'))

    await useRoomShare().shareRoom()

    expect(mockWriteText).toHaveBeenCalledWith(expect.stringContaining(PLAY_STORE_URL))
    expect(mockToast.add).toHaveBeenCalledWith(expect.objectContaining({ title: 'Link copied' }))
  })

  it('stays silent and does NOT copy when the user dismisses the sheet', async () => {
    const abort = new Error('Share canceled')
    mockShare.mockRejectedValue(abort)

    await useRoomShare().shareRoom()

    expect(mockWriteText).not.toHaveBeenCalled()
    expect(mockToast.add).not.toHaveBeenCalled()
  })

  it('warns when neither the sheet nor the clipboard works', async () => {
    mockShare.mockRejectedValue(new Error('not implemented'))
    mockWriteText.mockRejectedValue(new Error('denied'))

    await useRoomShare().shareRoom()

    expect(mockToast.add).toHaveBeenCalledWith(expect.objectContaining({ color: 'warning' }))
  })

  // ======================================================================
  // Re-entrancy
  // ======================================================================

  it('ignores a second click while a share is in flight', async () => {
    let release: () => void = () => {}
    mockShare.mockImplementation(() => new Promise<void>((resolve) => { release = resolve }))

    const { shareRoom } = useRoomShare()
    const first = shareRoom()
    await shareRoom()

    expect(mockShare).toHaveBeenCalledTimes(1)

    release()
    await first
  })
})

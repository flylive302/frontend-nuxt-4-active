/**
 * useChatMessageActions — shared context-menu/report-modal state for chat.
 * Node env, no Nuxt bridge: auto-imported globals are stubbed by hand.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref, computed, readonly } from 'vue'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('readonly', readonly)
const blockUser = vi.fn(async () => true)
vi.stubGlobal('useUserBlocking', () => ({ blockUser }))

const { useChatMessageActions, resetChatMessageActions } = await import('~/composables/room/useChatMessageActions')

const msg = { id: 'm1', userId: 42, content: 'hello', type: 'text', timestamp: 0 }

describe('useChatMessageActions', () => {
  // Runs first: target is module-level and never cleared once set.
  it('requestReport is a no-op with no target', () => {
    const a = useChatMessageActions()
    a.requestReport()
    expect(a.reportOpen.value).toBe(false)
  })

  beforeEach(() => {
    const a = useChatMessageActions()
    a.closeMenu()
    a.reportOpen.value = false
    blockUser.mockClear()
  })

  it('openMenuFor sets target + anchor and opens the menu', () => {
    const a = useChatMessageActions()
    a.openMenuFor(msg, { x: 10, y: 20 })
    expect(a.menuOpen.value).toBe(true)
    expect(a.target.value?.id).toBe('m1')
    expect(a.anchor.value).toEqual({ x: 10, y: 20 })
  })

  it('state is shared across callers (one menu for the panel)', () => {
    useChatMessageActions().openMenuFor(msg, { x: 1, y: 2 })
    expect(useChatMessageActions().target.value?.id).toBe('m1')
  })

  it('requestReport closes the menu and opens the modal with the message text', () => {
    const a = useChatMessageActions()
    a.openMenuFor(msg, { x: 0, y: 0 })
    a.requestReport()
    expect(a.menuOpen.value).toBe(false)
    expect(a.reportOpen.value).toBe(true)
    expect(a.reportDescription.value).toBe('Room chat message: hello')
  })

  it('blockTarget delegates to useUserBlocking with the target user id', async () => {
    const a = useChatMessageActions()
    a.openMenuFor(msg, { x: 0, y: 0 })
    await expect(a.blockTarget()).resolves.toBe(true)
    expect(blockUser).toHaveBeenCalledWith(42)
    expect(a.menuOpen.value).toBe(false)
  })

  it('menu exposes exactly Report and Block', () => {
    const labels = useChatMessageActions().menuItems.value[0]!.map((i) => i.label)
    expect(labels).toEqual(['Report message', 'Block user'])
  })

  it('resetChatMessageActions clears target, anchor, menu and report (room-scope teardown)', () => {
    const a = useChatMessageActions()
    a.openMenuFor(msg, { x: 5, y: 6 })
    a.requestReport()
    expect(a.reportOpen.value).toBe(true)

    resetChatMessageActions()

    expect(a.target.value).toBeNull()
    expect(a.anchor.value).toEqual({ x: 0, y: 0 })
    expect(a.menuOpen.value).toBe(false)
    expect(a.reportOpen.value).toBe(false)
    expect(a.reportDescription.value).toBe('')
  })
})

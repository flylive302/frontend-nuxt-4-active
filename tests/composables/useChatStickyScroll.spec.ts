/**
 * Unit tests for useChatStickyScroll (room chat sticky-bottom scroll pin/unpin
 * state machine — issue 12).
 *
 * Covers:
 *  - starts pinned + initial mount scrolls to bottom
 *  - new messages while pinned → scrollToBottom called, no pill
 *  - scroll up beyond threshold → unpinned
 *  - new messages while unpinned → NO scrollToBottom + pill/unseen count set
 *  - scroll back near bottom → re-pinned + pill cleared
 *  - pill tap → scrollToBottom + repin + pill cleared
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed } from 'vue'
import { useChatStickyScroll, type StickyScrollTarget } from '~/composables/room/useChatStickyScroll'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

/** Fake scroller target — mutate scrollTop/scrollHeight/clientHeight directly in tests. */
function createFakeElement(overrides: Partial<StickyScrollTarget> = {}): StickyScrollTarget {
  return {
    scrollTop: 0,
    scrollHeight: 1000,
    clientHeight: 400,
    ...overrides,
  }
}

describe('useChatStickyScroll', () => {
  let el: StickyScrollTarget
  let scrollToBottomMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // distance from bottom = 0 by default (scrolled to bottom)
    el = createFakeElement({ scrollTop: 600 })
    scrollToBottomMock = vi.fn()
  })

  function setup() {
    return useChatStickyScroll({
      getScrollElement: () => el,
      scrollToBottom: scrollToBottomMock,
    })
  }

  it('starts pinned', () => {
    const { isPinned } = setup()
    expect(isPinned.value).toBe(true)
  })

  it('scrollToBottomAndPin scrolls to bottom and stays pinned (mount/room-enter)', () => {
    const { isPinned, scrollToBottomAndPin } = setup()
    scrollToBottomAndPin()
    expect(scrollToBottomMock).toHaveBeenCalledTimes(1)
    expect(isPinned.value).toBe(true)
  })

  it('new messages while pinned scroll to bottom, no pill', () => {
    const { hasNewMessages, onNewMessages } = setup()
    onNewMessages(1)
    expect(scrollToBottomMock).toHaveBeenCalledTimes(1)
    expect(hasNewMessages.value).toBe(false)
  })

  it('scrolling up beyond the threshold unpins', () => {
    const { isPinned, onScroll } = setup()
    // far from bottom: scrollHeight - scrollTop - clientHeight = 1000 - 0 - 400 = 600 > threshold
    el.scrollTop = 0
    onScroll()
    expect(isPinned.value).toBe(false)
  })

  it('new messages while unpinned do NOT scroll and increment unseen/pill', () => {
    const { isPinned, hasNewMessages, unseenCount, onScroll, onNewMessages } = setup()
    el.scrollTop = 0
    onScroll()
    expect(isPinned.value).toBe(false)

    onNewMessages(2)
    expect(scrollToBottomMock).not.toHaveBeenCalled()
    expect(hasNewMessages.value).toBe(true)
    expect(unseenCount.value).toBe(2)
  })

  it('scrolling back within the threshold re-pins and clears the pill', () => {
    const { isPinned, hasNewMessages, onScroll, onNewMessages } = setup()
    el.scrollTop = 0
    onScroll()
    onNewMessages(3)
    expect(hasNewMessages.value).toBe(true)

    // back near bottom: distance <= threshold (80)
    el.scrollTop = 590 // 1000 - 590 - 400 = 10
    onScroll()

    expect(isPinned.value).toBe(true)
    expect(hasNewMessages.value).toBe(false)
  })

  it('pill tap scrolls to bottom, re-pins, and clears the pill', () => {
    const { isPinned, hasNewMessages, unseenCount, onScroll, onNewMessages, onPillClick } = setup()
    el.scrollTop = 0
    onScroll()
    onNewMessages(5)
    expect(hasNewMessages.value).toBe(true)

    onPillClick()

    expect(scrollToBottomMock).toHaveBeenCalledTimes(1)
    expect(isPinned.value).toBe(true)
    expect(hasNewMessages.value).toBe(false)
    expect(unseenCount.value).toBe(0)
  })
})

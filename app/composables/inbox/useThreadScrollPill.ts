// ========================================
// Thread Scroll Pill (dm-messenger-v2/07)
// ========================================
// Local, ephemeral UI state for the DM thread scroll view: whether the user
// has scrolled away from the bottom, and how many new messages arrived
// while scrolled up. Not persisted, not shared — lives per mounted thread
// panel instance. GATE/EXECUTE/REACT:
//
// GATE:    isNearBottom() — pure distance check against the scroll element.
// EXECUTE: scrollToBottom() mutates scroll position; onScroll() updates the
//          local `isScrolledUp` flag from the GATE check.
// REACT:   a `messages.length` watcher increments `newMessageCount` when a
//          message arrives while scrolled up, or auto-scrolls + clears the
//          count when the thread is already at the bottom / the message is
//          own.

import { SCROLL_TO_BOTTOM_THRESHOLD_PX } from '~/constants/inbox'
import type { ThreadMessage } from '~/types/inbox'

export function useThreadScrollPill(scrollEl: Ref<HTMLElement | null>, messages: Ref<ThreadMessage[]> | ComputedRef<ThreadMessage[]>) {
  const isScrolledUp = ref(false)
  const newMessageCount = ref(0)

  // ── GATE ──────────────────────────────────────────────
  function isNearBottom(el: HTMLElement): boolean {
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    return distance <= SCROLL_TO_BOTTOM_THRESHOLD_PX
  }

  // ── EXECUTE ───────────────────────────────────────────
  function scrollToBottom(smooth = false): void {
    nextTick(() => {
      if (!scrollEl.value) return
      scrollEl.value.scrollTo({ top: scrollEl.value.scrollHeight, behavior: smooth ? 'smooth' : 'instant' })
    })
  }

  function onScroll(): void {
    const el = scrollEl.value
    if (!el) return
    isScrolledUp.value = !isNearBottom(el)
    if (!isScrolledUp.value) newMessageCount.value = 0
  }

  function jumpToBottom(): void {
    scrollToBottom(true)
    isScrolledUp.value = false
    newMessageCount.value = 0
  }

  // ── REACT ─────────────────────────────────────────────
  watch(() => messages.value.length, (len, prevLen) => {
    if (len <= (prevLen ?? 0)) return

    const el = scrollEl.value
    const lastMessage = messages.value[messages.value.length - 1]
    const atBottom = !el || isNearBottom(el)

    if (atBottom || lastMessage?.isOwn) {
      scrollToBottom(true)
      newMessageCount.value = 0
      isScrolledUp.value = false
      return
    }

    newMessageCount.value += 1
  })

  return { isScrolledUp, newMessageCount, scrollToBottom, onScroll, jumpToBottom }
}

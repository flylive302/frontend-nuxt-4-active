/**
 * useScrolledFromTop
 *
 * Reports whether the document has scrolled away from the very top, without a
 * scroll listener. `sentinel` is an element that sits at the top of the
 * document and scrolls with it; once it has fully left the viewport the page
 * counts as scrolled. The sentinel's height therefore *is* the scroll
 * threshold — size it in the template, not here.
 *
 * IntersectionObserver only calls back when the sentinel crosses the viewport
 * edge, so nothing runs per scroll frame — the flag flips exactly twice per
 * top→scrolled→top round-trip. Default observer options on purpose
 * (viewport root, zero margin, zero threshold): any margin would shift the
 * flip point away from the sentinel's height.
 *
 * Starts `false` (at top). A scroll position restored before mount settles on
 * the observer's first callback, one frame later.
 */
import { readonly, ref, type Ref } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'

export interface UseScrolledFromTop {
  /** True once the sentinel has fully scrolled out of the viewport. */
  isScrolled: Readonly<Ref<boolean>>
}

/**
 * @param sentinel Element pinned to the top of the document (a template ref).
 */
export function useScrolledFromTop(
  sentinel: Ref<HTMLElement | null | undefined>,
): UseScrolledFromTop {
  const isScrolled = ref(false)

  useIntersectionObserver(sentinel, ([entry]) => {
    if (!entry) return
    isScrolled.value = !entry.isIntersecting
  })

  return { isScrolled: readonly(isScrolled) }
}

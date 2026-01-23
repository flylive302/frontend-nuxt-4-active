/**
 * Composable to detect if text content overflows its container.
 * Useful for conditionally applying marquee animations or truncation.
 *
 * @param elementRef - Template ref to the container element
 * @param debounceMs - Debounce delay for resize checks (default: 100ms)
 * @returns Reactive boolean indicating overflow state
 *
 * @example
 * ```vue
 * <script setup>
 * const textRef = ref<HTMLElement | null>(null)
 * const isOverflowing = useTextOverflow(textRef)
 * </script>
 *
 * <template>
 *   <h3 ref="textRef" :class="{ 'marquee-container': isOverflowing }">
 *     <span :class="{ 'marquee-text': isOverflowing }">{{ text }}</span>
 *   </h3>
 * </template>
 * ```
 */
export function useTextOverflow(
  elementRef: Ref<HTMLElement | null>,
  debounceMs = 100
): Readonly<Ref<boolean>> {
  const isOverflowing = ref(false)

  /**
   * Check if the element's content overflows its visible area.
   */
  function checkOverflow(): void {
    if (elementRef.value) {
      isOverflowing.value = elementRef.value.scrollWidth > elementRef.value.clientWidth
    }
  }

  onMounted(() => {
    checkOverflow()

    if (elementRef.value) {
      const debouncedCheck = useDebounceFn(checkOverflow, debounceMs)
      const observer = new ResizeObserver(debouncedCheck)
      observer.observe(elementRef.value)

      onUnmounted(() => observer.disconnect())
    }
  })

  // Re-check when element ref changes
  watch(elementRef, () => nextTick(checkOverflow))

  return readonly(isOverflowing)
}

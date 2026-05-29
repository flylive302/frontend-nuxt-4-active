export function useTextOverflow(
  elementRef: Ref<HTMLElement | null>,
  debounceMs = 100
): { isOverflowing: Readonly<Ref<boolean>>; overflowOffset: Readonly<Ref<number>> } {
  const isOverflowing = ref(false)
  const overflowOffset = ref(0)

  function checkOverflow(): void {
    if (elementRef.value) {
      const delta = elementRef.value.scrollWidth - elementRef.value.clientWidth
      isOverflowing.value = delta > 0
      overflowOffset.value = delta > 0 ? -delta : 0
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

  watch(elementRef, () => nextTick(checkOverflow))

  return {
    isOverflowing: readonly(isOverflowing),
    overflowOffset: readonly(overflowOffset),
  }
}

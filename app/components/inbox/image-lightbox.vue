<script setup lang="ts">
// Full-screen DM image viewer (dm-messenger-v2/03): dark backdrop,
// pinch-zoom + double-tap zoom, one-finger pan when zoomed, swipe-down or
// tap/close-button to dismiss. Body scroll lock + gesture math live in
// useImageLightbox; this component is INTENT-only — bind events, render.
//
// Ownership: this component owns the single useImageLightbox() instance.
// The parent (thread-panel) never touches open/scale/translate directly —
// it calls the exposed `open(url)` method (e.g. from `@open-image` on
// InboxMessageBubble), keeping the ephemeral gesture state local here.
import type { Vec2 } from '~/utils/image-zoom-math'

const {
  isOpen,
  imageUrl,
  scale,
  translateX,
  translateY,
  open,
  close,
  setDimensions,
  onPinchStart,
  onPinchMove,
  onPinchEnd,
  onTap,
  onPanStart,
  onPanMove,
  onPanEnd,
  onSwipeStart,
  onSwipeMove,
  onSwipeEnd,
} = useImageLightbox()

const viewportEl = ref<HTMLElement | null>(null)
const imgEl = ref<HTMLImageElement | null>(null)
const swipeOffsetY = ref(0)
const isSwiping = ref(false)

function viewportOrigin(): Vec2 {
  const rect = viewportEl.value?.getBoundingClientRect()
  return { x: rect?.left ?? 0, y: rect?.top ?? 0 }
}

function measure(): void {
  if (!viewportEl.value || !imgEl.value) return
  setDimensions(
    { width: imgEl.value.naturalWidth || imgEl.value.clientWidth, height: imgEl.value.naturalHeight || imgEl.value.clientHeight },
    { width: viewportEl.value.clientWidth, height: viewportEl.value.clientHeight },
  )
}

// ── Touch gesture wiring ───────────────────────────────
function touchPoint(t: Touch): Vec2 {
  return { x: t.clientX, y: t.clientY }
}

function onTouchStart(e: TouchEvent): void {
  if (e.touches.length === 2) {
    onPinchStart(touchPoint(e.touches[0]!), touchPoint(e.touches[1]!))
    return
  }
  if (e.touches.length === 1) {
    const point = touchPoint(e.touches[0]!)
    onPanStart(point)
    onSwipeStart(point)
    onTap(point, viewportOrigin())
  }
}

function onTouchMove(e: TouchEvent): void {
  if (e.touches.length === 2) {
    e.preventDefault()
    onPinchMove(touchPoint(e.touches[0]!), touchPoint(e.touches[1]!), viewportOrigin())
    return
  }
  if (e.touches.length === 1) {
    const point = touchPoint(e.touches[0]!)
    if (scale.value > 1) {
      onPanMove(point)
      return
    }
    const swipe = onSwipeMove(point)
    isSwiping.value = swipe.dragging
    swipeOffsetY.value = swipe.offsetY
  }
}

function onTouchEnd(e: TouchEvent): void {
  onPinchEnd()
  onPanEnd()
  if (e.changedTouches.length > 0) {
    const point = touchPoint(e.changedTouches[0]!)
    onSwipeEnd(point) // closes internally via the composable when past threshold
  }
  isSwiping.value = false
  swipeOffsetY.value = 0
}

watch(isOpen, (nowOpen) => {
  if (nowOpen) nextTick(measure)
})

function onBackdropClick(): void {
  close()
}

defineExpose({ open })
</script>

<template>
  <Teleport to="body">
    <Transition name="lightbox-fade">
      <div
        v-if="isOpen && imageUrl"
        class="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center safe-area"
        :style="{ opacity: isSwiping ? Math.max(0.3, 1 - swipeOffsetY / 400) : 1 }"
        @click.self="onBackdropClick"
      >
        <!-- Close button -->
        <button
          type="button"
          class="absolute top-3 right-3 z-10 size-10 rounded-full bg-black/40 flex items-center justify-center text-white active:scale-95 transition-transform safe-area-top"
          aria-label="Close"
          @click="close"
        >
          <UIcon name="i-lucide-x" class="size-6" />
        </button>

        <!-- Gesture viewport -->
        <div
          ref="viewportEl"
          class="relative w-full h-full flex items-center justify-center overflow-hidden touch-none"
          @touchstart.passive="onTouchStart"
          @touchmove="onTouchMove"
          @touchend.passive="onTouchEnd"
          @touchcancel.passive="onTouchEnd"
        >
          <img
            ref="imgEl"
            :src="imageUrl"
            draggable="false"
            class="max-w-full max-h-full object-contain select-none"
            :style="{
              transform: `translate(${translateX}px, ${translateY + swipeOffsetY}px) scale(${scale})`,
              transition: isSwiping ? 'none' : 'transform 0.1s ease-out',
            }"
            alt="Full-size image"
            @load="measure"
          >
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.lightbox-fade-enter-active,
.lightbox-fade-leave-active {
  transition: opacity 0.2s ease;
}
.lightbox-fade-enter-from,
.lightbox-fade-leave-to {
  opacity: 0;
}
</style>

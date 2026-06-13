<script setup lang="ts">
/**
 * Global slide overlay layer (app shell). Renders one SvgaPlayer per active
 * slide, positioned by its `top` px. Fixed + pass-through so it never blocks the
 * UI underneath; only a clickable slide captures pointer events (handled in the
 * item). Mounted in the global shell so app-scope slides reach users in no room.
 *
 * Replaces the room-scoped slide-broadcast / lucky announcement paths from
 * slice 2 onward; in slice 1 it coexists with them (gift path only).
 */
const {
  activeSlides,
  onComplete,
  handleSlideClick,
  showPasswordPrompt,
  pendingRoom,
  onPasswordSuccess,
} = useSlideOverlay()
</script>

<template>
  <div class="slide-overlay-layer">
    <div
      v-for="slide in activeSlides"
      :key="slide.instanceId"
      class="slide-overlay-slot"
      :style="{ top: `${slide.top}px` }"
    >
      <SlideOverlayItem
        :slide="slide"
        @complete="onComplete(slide.instanceId)"
        @click="handleSlideClick(slide)"
      />
    </div>

    <RoomPasswordPromptModal
      v-if="showPasswordPrompt && pendingRoom"
      v-model:open="showPasswordPrompt"
      :room="pendingRoom"
      @success="onPasswordSuccess"
    />
  </div>
</template>

<style scoped>
.slide-overlay-layer {
  position: fixed;
  inset: 0;
  z-index: 60;
  pointer-events: none;
}

.slide-overlay-slot {
  position: absolute;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
}
</style>

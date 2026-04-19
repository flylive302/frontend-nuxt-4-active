<script setup lang="ts">
// ========================================
// Room Card
// ========================================
//
// Displays a room in the room grid.
// Password-protected rooms show a prompt before entering.
// ========================================

import type { Room } from '~/types/room/room'

defineOptions({
  inheritAttrs: false
})

// ========================================
// Props
// ========================================

const props = defineProps<{
  room: Room
}>()

// ========================================
// Dependencies
// ========================================

const { enterRoom, showPasswordPrompt, pendingRoom, entering: _entering, onPasswordSuccess } = useRoomEntry()

// ========================================
// Computed
// ========================================

/** Live badge label */
const badgeDisplay = computed(() => {
  if (!props.room.is_live) return null
  return `Live / ${props.room.participant_count}`
})

// ========================================
// Navigation
// ========================================

/**
 * Handle room card click.
 * Delegates to useRoomEntry for password-protected room handling.
 */
function handleRoomClick(): void {
  enterRoom(props.room)
}
</script>

<template>
  <article v-bind="$attrs" class="relative rounded-3xl squircle overflow-hidden" @click="handleRoomClick">
    <figure class="h-full w-full">
      <NuxtImg
        :src="props.room.background ?? '/AppImages/dummy-card/bg-fl.png'"
        :alt="props.room.name ?? undefined"
        :width="384"
        class="h-auto w-full object-cover"
        format="webp"
        densities="x1 x2"
        loading="lazy"
      />
      <figcaption class="sr-only">{{ props.room.name }}</figcaption>
    </figure>

    <!-- SVG mask definition — responsive via objectBoundingBox (0–1 coords) -->
    <svg width="0" height="0" class="absolute">
      <defs>
        <mask id="squircle-mask" maskContentUnits="objectBoundingBox">
          <!-- Full area visible -->
          <rect width="1" height="1" fill="white"/>
          <!-- Cutout: inset ~3% each side, top 72% punched out -->
          <rect
            x="0.04"
            y="0.03"
            width="0.92"
            height="0.85"
            rx="0.06"
            ry="0.06"
            fill="black"
          />
        </mask>
      </defs>
    </svg>

    <!-- Overlay content -->
    <aside class="absolute inset-0 px-4 pb-1 flex items-end backdrop-blur-xl" style="mask: url(#squircle-mask);">

      <div class="flex items-center gap-1">
        <!-- Live dot -->
        <span v-if="badgeDisplay" class="relative inline-flex">
          <span class="absolute inline-block size-2 rounded-full bg-success animate-ping"/>
          <span class="relative inline-block size-2 rounded-full bg-success"/>
        </span>

        <!-- Text -->
        <p class="text-md truncate font-bold">
          {{ props.room.name }} - {{ badgeDisplay }}
        </p>
      </div>
    </aside>

    <!-- Password lock indicator (top-right) -->
    <div v-if="props.room.is_password_protected" class="absolute top-2 right-2">
      <UIcon name="i-lucide-lock" class="size-4 text-warning drop-shadow-lg" />
    </div>
  </article>

  <!-- Password Prompt Modal -->
  <RoomPasswordPromptModal
    v-if="showPasswordPrompt && pendingRoom"
    v-model:open="showPasswordPrompt"
    :room="pendingRoom"
    @success="onPasswordSuccess"
  />
</template>
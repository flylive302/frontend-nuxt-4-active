<script setup lang="ts">
// ========================================
// Room Card
// ========================================
//
// Displays a room in the room grid.
// Password-protected rooms show a prompt before entering.
// ========================================

import type { Room } from '~/types/room/room'
import { ASSETS } from '~/constants/assets'

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
        :src="props.room.background ?? ASSETS.ROOM_BG_PLACEHOLDER"
        :alt="props.room.name ?? undefined"
        :width="384"
        class="h-auto w-full object-cover"
        format="webp"
        densities="x1 x2"
        loading="lazy"
      />
      <figcaption class="sr-only">{{ props.room.name }}</figcaption>
    </figure>

    <!-- Overlay content -->
    <aside class="absolute inset-0 p-2 flex items-end">

      <div class="backdrop-blur-sm shadow-md rounded-t-xl rounded-b-3xl p-2 w-full flex items-end justify-between">
        <div class="flex items-center gap-1">
          <NuxtImg
              :src="props.room.logo ?? ASSETS.AVATAR_PLACEHOLDER"
              alt="Live"
              width="12"
              height="12"
              class="size-6 object-cover rounded-full ring-2 ring-primary"
          />

          <!-- Text -->
          <p class="text-sm font-bold max-w-24 leading-none">
            {{ props.room.name }}
          </p>
        </div>

        <div class="flex items-center gap-1">
          <!-- Live dot -->
          <span v-if="badgeDisplay" class="relative inline-flex mr-1">
            <span class="absolute inline-block size-2 rounded-full bg-success animate-ping"/>
            <span class="relative inline-block size-2 rounded-full bg-success"/>
          </span>
          <UIcon name="i-fluent-people-team-20-filled" />
          <p class="font-bold text-lg text-white">{{props.room.participant_count}}</p>
        </div>
      </div>

    </aside>

    <!-- Password lock indicator (top-right) -->
    <div v-if="props.room.is_password_protected" class="absolute top-0 right-0 bg-primary size-8 flex-middle rounded-bl-lg shadow-lg">
      <UIcon name="i-lucide-lock" class="size-4 text-white drop-shadow-lg" />
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
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

const roomStore = useRoomStore()
const authStore = useAuthStore()

// ========================================
// Computed
// ========================================

/** Live badge label */
const badgeDisplay = computed(() => {
  if (!props.room.is_live) return null
  return `Live / ${props.room.participant_count}`
})

/** Whether the current user owns this room */
const isOwner = computed(() => authStore.user?.id === props.room.owner_id)

// ========================================
// Password Prompt State
// ========================================

const showPasswordPrompt = ref(false)
const entering = ref(false)

const { api } = useApi()

// ========================================
// Navigation
// ========================================

/**
 * Handle room card click.
 * For password-protected rooms (non-owner): attempt passwordless join first.
 * If backend says 403 → room is truly locked → show password prompt.
 * This handles stale `is_password_protected` data when room was made public.
 */
async function handleRoomClick(): Promise<void> {
  if (entering.value) return

  // Owners always enter directly
  if (isOwner.value) {
    enterRoom()
    return
  }

  // If room appears password-protected, verify with backend first
  if (props.room.is_password_protected) {
    entering.value = true
    try {
      // Try joining without password — backend grants access if room is now public
      await api(`/rooms/${props.room.id}/join`, { method: 'POST', body: {} })
      // Access granted (room is actually public now)
      enterRoom()
    } catch {
      // 403 = still password-protected → show prompt
      showPasswordPrompt.value = true
    } finally {
      entering.value = false
    }
    return
  }

  enterRoom()
}

/**
 * Navigate to the room page.
 */
function enterRoom(): void {
  roomStore.setCurrentRoom(props.room)
  navigateTo(`/room/${props.room.id}`)
}
</script>

<template>
  <article v-bind="$attrs" class="relative h-72 w-full rounded-3xl squircle overflow-hidden" @click="handleRoomClick">
    <figure class="h-full w-full">
      <NuxtImg
          :src="props.room.background ?? 'https://ik.imagekit.io/flylive/room/5.gif'"
          :alt="props.room.name ?? undefined"
          class="h-auto w-full object-cover"
          :width="384"
          format="webp"
          densities="x1 x2"
          sizes="50vw"
          loading="lazy"
      />
      <figcaption class="sr-only">{{ props.room.name }}</figcaption>
    </figure>

    <!-- SVG mask definition — sibling of aside, inside article -->
    <svg width="0" height="0" class="absolute">
      <defs>
        <mask id="squircle-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="350px" height="350px">
          <rect width="250px" height="350px" fill="white"/>
          <rect
              x="8px"
              y="8px"
              width="220px"
              height="250px"
              rx="24"
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
    v-if="showPasswordPrompt"
    v-model:open="showPasswordPrompt"
    :room="props.room"
    @success="enterRoom"
  />
</template>
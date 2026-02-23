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
  <article v-bind="$attrs" class="relative overflow-hidden aspect-9/16 h-72 w-full rounded-3xl" @click="handleRoomClick">
    <figure class="h-full w-full">
      <NuxtImg
          :src="props.room.background ?? 'https://ik.imagekit.io/flylive/siteAssets/rooms/eagle3.webp'"
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

    <!-- Overlay content -->
    <aside class="pointer-events-none absolute inset-0 p-3 flex items-end">
      <template v-if="badgeDisplay">
        <BgGlass
            frost-blur-radius="blur(4px)"
            rounded="rounded-full"
            class="flex items-center gap-1 px-1 w-fit rounded-full border border-white/60"
        >
          <!-- Live dot -->
          <span class="relative inline-flex">
            <span class="absolute inline-block size-2 rounded-full bg-success animate-ping"/>
            <span class="relative inline-block size-2 rounded-full bg-success"/>
          </span>

          <!-- Text -->
          <p class="text-sm font-semibold truncate">
            {{ props.room.name }} - {{ badgeDisplay }}
          </p>
        </BgGlass>
      </template>
      <!-- Show room name only if not live -->
      <template v-else>
        <BgGlass
            frost-blur-radius="blur(4px)"
            rounded="rounded-full"
            class="flex items-center gap-1 px-2 w-fit rounded-full border border-white/60"
        >
          <!-- Lock icon for password-protected rooms -->
          <UIcon v-if="props.room.is_password_protected" name="i-lucide-lock" class="size-3 text-warning" />
          <p class="text-sm font-semibold truncate">
            {{ props.room.name }}
          </p>
        </BgGlass>
      </template>
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

<script setup lang="ts">
// ========================================
// Room Block List Drawer (owner/admin)
// ========================================
//
// INTENT-only: lists currently-blocked users with remaining block time and
// an Unblock action per row. Logic lives in useRoomBlocking (optimistic row
// removal + toasts on unblock).

import { formatBlockRemaining } from '~/utils/date'

// ========================================
// Props / State
// ========================================

const props = defineProps<{
  roomId: number
}>()

const open = defineModel<boolean>('open', { default: false })

// ========================================
// Composables
// ========================================

const { blockedUsers, loading, fetchBlockedUsers, unblockUser } = useRoomBlocking()

// ========================================
// Handlers
// ========================================

async function handleUnblock(userId: number): Promise<void> {
  await unblockUser(props.roomId, userId)
}

// ========================================
// Watchers
// ========================================

watch(
  [open, () => props.roomId],
  ([isOpen, roomId]) => {
    if (isOpen && roomId) {
      fetchBlockedUsers(roomId)
    }
  },
  { immediate: true },
)
</script>

<template>
  <UDrawer
    v-model:open="open"
    title="Blocked Users"
    description="Users currently blocked from this room."
    style="--ui-primary: var(--room-theme, var(--color-primary)); --ui-color-primary-500: var(--room-theme, var(--color-primary-500));"
  >
    <template #content>
      <div class="px-3 mt-3 flex flex-col gap-2 pb-4 max-h-[80vh] overflow-y-auto">
        <div v-if="loading" class="flex justify-center py-8">
          <UIcon name="i-lucide-loader-2" class="animate-spin size-8" />
        </div>

        <div
          v-else-if="blockedUsers.length === 0"
          class="text-center py-8 text-muted"
        >
          No blocked users
        </div>

        <MinimalUserList
          v-for="block in blockedUsers"
          v-else
          :key="block.id"
          :user="block.user"
        >
          <template #actions>
            <div class="flex items-center justify-between px-2 py-1.5 bg-muted/20">
              <span class="text-xs text-muted">
                {{ formatBlockRemaining(block.banned_until) }}
              </span>
              <UButton
                icon="i-lucide-unlock"
                color="success"
                variant="soft"
                size="xs"
                @click="handleUnblock(block.user.id)"
              >
                Unblock
              </UButton>
            </div>
          </template>
        </MinimalUserList>

        <UButton
          color="neutral"
          variant="subtle"
          icon="i-lucide-x"
          class="justify-center mt-4 w-full"
          @click="() => { open = false }"
        >
          Close
        </UButton>
      </div>
    </template>
  </UDrawer>
</template>

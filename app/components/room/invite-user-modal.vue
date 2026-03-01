<script setup lang="ts">
// ========================================
// Invite User Modal
// ========================================
//
// Modal with user search for sending room invitations.
// Uses UserSearchDrawer for reusable search UI.
// ========================================

import type { MinimalUser } from '~/types/user/bootstrap'

// ========================================
// Props
// ========================================

const props = defineProps<{
  roomId: number
}>()

// ========================================
// State
// ========================================

const open = defineModel<boolean>('open', { default: false })
const inviting = ref(false)

// ========================================
// Composables
// ========================================

const { sendInvitation } = useRoomInvitations()

// ========================================
// Handlers
// ========================================

/**
 * Send a room invitation to the selected user.
 * @param user - The user to invite
 */
async function handleInvite(user: MinimalUser): Promise<void> {
  inviting.value = true
  try {
    const result = await sendInvitation(props.roomId, { user_id: user.id })
    if (result) {
      open.value = false
    }
  } finally {
    inviting.value = false
  }
}
</script>

<template>
  <UserSearchDrawer
    v-model:open="open"
    title="Invite User"
    description="Search and invite users to join your room."
  >
    <template #actions="{ user }">
      <div class="flex items-center min-h-full px-2">
        <UButton
          icon="i-lucide-send"
          color="primary"
          variant="soft"
          size="sm"
          :loading="inviting"
          @click="handleInvite(user)"
        >
          Invite
        </UButton>
      </div>
    </template>
  </UserSearchDrawer>
</template>

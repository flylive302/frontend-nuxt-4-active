<script setup lang="ts">
// ========================================
// Room Membership Action Component
// ========================================
//
// Smart state-aware button that shows the appropriate action
// based on the user's current membership state:
// - Non-member → "Request to Join"
// - Pending Request → "Cancel Request"
// - Has Invitation → Accept / Decline
// - Member → "Leave Room"
// ========================================

import type { RoomMembershipState } from '~/types/room'

// ========================================
// Props
// ========================================

const props = defineProps<{
  roomId: number
  state: RoomMembershipState
  invitationId?: number
  disabled?: boolean
}>()

// ========================================
// Emits
// ========================================

const emit = defineEmits<{
  stateChanged: []
}>()

// ========================================
// Composables
// ========================================

const { requestToJoin, cancelJoinRequest } = useRoomJoinRequests()
const { acceptInvitation, declineInvitation } = useRoomInvitations()

// ========================================
// State
// ========================================

const loading = ref(false)

// ========================================
// Handlers
// ========================================

async function handleRequestToJoin() {
  loading.value = true
  try {
    const result = await requestToJoin(props.roomId)
    if (result) emit('stateChanged')
  } finally {
    loading.value = false
  }
}

async function handleCancelRequest() {
  loading.value = true
  try {
    const success = await cancelJoinRequest(props.roomId)
    if (success) emit('stateChanged')
  } finally {
    loading.value = false
  }
}

async function handleAcceptInvitation() {
  if (!props.invitationId) return
  loading.value = true
  try {
    const success = await acceptInvitation(props.invitationId)
    if (success) emit('stateChanged')
  } finally {
    loading.value = false
  }
}

async function handleDeclineInvitation() {
  if (!props.invitationId) return
  loading.value = true
  try {
    const success = await declineInvitation(props.invitationId)
    if (success) emit('stateChanged')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex gap-2">
    <!-- Non-member: Request to Join -->
    <UButton
      v-if="state === 'none'"
      icon="i-lucide-user-plus"
      color="primary"
      variant="soft"
      :loading="loading"
      :disabled="disabled"
      @click="handleRequestToJoin"
    >
      Request to Join
    </UButton>

    <!-- Pending Request: Cancel -->
    <UButton
      v-else-if="state === 'pending_request'"
      icon="i-lucide-x"
      color="warning"
      variant="soft"
      :loading="loading"
      :disabled="disabled"
      @click="handleCancelRequest"
    >
      Cancel Request
    </UButton>

    <!-- Has Invitation: Accept / Decline -->
    <template v-else-if="state === 'has_invitation'">
      <UButton
        icon="i-lucide-check"
        color="success"
        variant="soft"
        :loading="loading"
        :disabled="disabled"
        @click="handleAcceptInvitation"
      >
        Accept
      </UButton>
      <UButton
        icon="i-lucide-x"
        color="error"
        variant="soft"
        :loading="loading"
        :disabled="disabled"
        @click="handleDeclineInvitation"
      >
        Decline
      </UButton>
    </template>

    <!-- Member: Leave Room (handled by header.vue) -->
    <!-- Not shown here - the header already has leave functionality -->

    <!-- Blocked: Show message -->
    <UBadge
      v-else-if="state === 'blocked'"
      color="error"
      variant="subtle"
      icon="i-lucide-ban"
    >
      Blocked
    </UBadge>
  </div>
</template>

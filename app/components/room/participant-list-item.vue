<!-- ~/components/room/participant-list-item.vue -->
<!-- Single participant item in room user list with invite functionality -->
<script setup lang="ts">
import type { RoomParticipant } from '~/types/audio'

defineOptions({ name: 'ParticipantListItem' })

// ========================================
// Props & Emits
// ========================================
defineProps<{
  participant: RoomParticipant
  inviteModeSeat: number | null
  isRoomOwner: boolean
  isInviting: boolean
}>()

const emit = defineEmits<{
  (e: 'invite', userId: number): void
}>()
</script>

<template>
  <div
    class="flex gap-1 bg-gradient-to-bl to-neutral-950 border-2 border-neutral-700 rounded-lg shadow-md shadow-neutral-900 overflow-hidden"
  >
    <UserAvatar :img="participant.avatar" animated class="w-13" />
    <div class="flex flex-col justify-center min-h-full px-2 flex-grow">
      <h3 class="text-sm font-bold leading-tight">
        {{ participant.name }}
        <UBadge v-if="participant.isSpeaker" size="xs" color="primary" class="ml-1">Speaker</UBadge>
      </h3>
      <div class="flex items-center gap-1 mt-1">
        <span class="text-xs text-gray-400">ID: {{ participant.id }}</span>
      </div>
    </div>
    <!-- Invite to Seat button - Owner only, for non-speakers -->
    <!-- Show ONLY if in invite mode -->
    <UButton
      v-if="inviteModeSeat !== null && !participant.isSpeaker && isRoomOwner"
      size="xs"
      color="primary"
      variant="soft"
      icon="i-lucide-user-plus"
      :loading="isInviting"
      class="mr-2 self-center"
      @click.stop="emit('invite', participant.id)"
    >
      Invite to Seat {{ inviteModeSeat + 1 }}
    </UButton>
  </div>
</template>

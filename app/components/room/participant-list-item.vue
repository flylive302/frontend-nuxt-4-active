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
  <NuxtLink :to="`/profile/${participant.signature}`"
    class="flex gap-1 bg-linear-to-bl to-neutral-950 border-2 border-neutral-700 rounded-lg shadow-md shadow-neutral-900 overflow-hidden relative"
  >
    <UserAvatar :img="participant.avatar" animated class="w-13" />
    <div class="flex justify-center items-center gap-1">
      <h3 class="text-sm font-bold leading-tight">
        {{ participant.name }}
      </h3>
      <UBadge color="secondary" icon="i-lucide-mars-stroke" size="xs" class="w-fit text-white py-0 rounded-md">
        {{ getAge(participant.date_of_birth) }}
      </UBadge>
      <ProfileBadge :txt="participant.signature" :show-badge="false" />
    </div>  
    <UBadge v-if="participant.isSpeaker" size="sm" color="primary" variant="soft" class="absolute top-0 right-0">Speaker</UBadge>
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
  </NuxtLink>
</template>

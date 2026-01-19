<!-- ~/components/room/participant-list-item.vue -->
<script setup lang="ts">
import type { RoomParticipant } from '~/types/audio'

defineOptions({ name: 'ParticipantListItem' })
const { myMembership } = useRoomMembers();
const roomStore = useRoomStore();
const log = createLogger('[ParticipantListItem]');

// ========================================
// Props & Emits
// ========================================
const props = defineProps<{
  participant: RoomParticipant
  inviteModeSeat: number | null
  isRoomOwner: boolean
  isInviting: boolean
}>()

const emit = defineEmits<{
  (e: 'invite', userId: number): void
}>()

/** Current user can manage members (owner or admin) */
const canManageMembers = computed(() => {
  // Owner can always manage
  if (props.isRoomOwner) return true
  // Admin members can also manage
  if (myMembership.value?.role === 'admin') return true
  return false
})
</script>

<template>
  <div
    class="flex gap-1 bg-linear-to-bl to-neutral-950 border-2 border-neutral-700 rounded-lg shadow-md shadow-neutral-900 overflow-hidden relative"
  >
    <div 
      @click="async () => {
        try {
          roomStore.minimizeRoom();
          navigateTo(`/profile/${participant.signature}`);
        } catch (error) {
          log.error('Failed to navigate to profile:', error);
        }
      }"
    >
      <UserAvatar :img="participant.avatar" animated class="w-13" />
    </div>
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
      v-if="inviteModeSeat !== null && !participant.isSpeaker && canManageMembers"
      size="xs"
      color="primary"
      variant="subtle"
      :loading="isInviting"
      class="mr-2 self-center"
      @click.stop="emit('invite', participant.id)"
    >
      Invite to {{ inviteModeSeat + 1 }}
    </UButton>
  </div>
</template>

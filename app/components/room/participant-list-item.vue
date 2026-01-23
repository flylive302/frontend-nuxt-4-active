<!-- ~/components/room/participant-list-item.vue -->
<script setup lang="ts">
import type { RoomParticipant } from '~/types/audio'
import MinimalUserList from "~/components/common/minimal-user-list.vue";

defineOptions({ name: 'ParticipantListItem' })
const { myMembership } = useRoomMembers();

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
  return myMembership.value?.role === 'admin';
})
</script>

<template>
  <MinimalUserList :user="participant">
    <template #default>
      <UBadge v-if="participant.isSpeaker" size="sm" color="primary" variant="soft" class="absolute top-0 right-0">Speaker</UBadge>
    </template>

    <template v-if="inviteModeSeat !== null && !participant.isSpeaker && canManageMembers" #actions>
      <UButton
          color="primary"
          variant="soft"
          :loading="isInviting"
          class="rounded-0 w-full justify-center"
          @click.stop="emit('invite', participant.id)"
      >
        Invite to Seat {{ inviteModeSeat + 1 }}
      </UButton>
    </template>
  </MinimalUserList>
</template>

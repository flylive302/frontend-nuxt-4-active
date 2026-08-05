<script setup lang="ts">
// ========================================
// Members Tab
// ========================================
// Member list + invite button + kick/promote/demote actions (owner/admin
// only). INTENT-only: binds to useRoomMembers / useRoomMemberManagement.

import { useInfiniteScroll } from "@vueuse/core";
import type { RoomMember } from "~/types/room/room";
import type { BlockDurationValue } from "~/constants/room";
import KickDurationPopover from "~/components/room/kick-duration-popover.vue";

// ========================================
// Props
// ========================================

const props = defineProps<{
  roomId: number;
  open: boolean;
  canManageMembers: boolean;
  kickMember: (roomId: number, member: RoomMember, duration: BlockDurationValue) => Promise<void>;
  promoteMember: (roomId: number, member: RoomMember) => Promise<void>;
  demoteMember: (roomId: number, member: RoomMember) => Promise<void>;
}>();

// ========================================
// State
// ========================================

const showInviteModal = ref(false);
const membersListRef = ref<HTMLElement | null>(null);

// ========================================
// Composables
// ========================================

const { members, loading: membersLoading, fetchMembers } = useRoomMembers();

/** Rank rules — who this viewer may kick, and whether they may hand out admin. */
const { canRemove, canManageAdmins } = useRoomHierarchy();

// Load next page as the members list scrolls near its end
// (fetchMembers gates on hasMore/loading internally).
useInfiniteScroll(
  membersListRef,
  async () => {
    if (props.open && props.roomId) await fetchMembers(props.roomId);
  },
  { distance: 200 },
);

// ========================================
// Handlers
// ========================================

async function handleKickMember(member: RoomMember, duration: BlockDurationValue) {
  await props.kickMember(props.roomId, member, duration);
}

async function handlePromoteMember(member: RoomMember) {
  await props.promoteMember(props.roomId, member);
}

async function handleDemoteMember(member: RoomMember) {
  await props.demoteMember(props.roomId, member);
}

/**
 * Generate dropdown menu items for a member. Kick/block is handled by the
 * separate KickDurationPopover trigger (unified kick path, ADR 0017) — not a
 * dropdown item, since it requires a duration choice, not a single select.
 */
function getMemberActions(member: RoomMember) {
  return [
    [
      member.role === "admin"
        ? {
            label: "Demote to Member",
            icon: "i-lucide-arrow-down",
            onSelect: () => handleDemoteMember(member),
          }
        : {
            label: "Promote to Admin",
            icon: "i-lucide-arrow-up",
            onSelect: () => handlePromoteMember(member),
          },
    ],
  ];
}
</script>

<template>
  <div class="space-y-2">
    <UButton
      v-if="canManageMembers"
      icon="i-lucide-user-plus"
      color="primary"
      variant="soft"
      class="w-full justify-center mb-2"
      @click="showInviteModal = true"
    >
      Invite User
    </UButton>
    <RoomInviteUserModal v-model:open="showInviteModal" :room-id="roomId" />
    <div v-if="membersLoading && members.items.length === 0" class="flex justify-center py-8">
      <UIcon name="i-lucide-loader-2" class="animate-spin size-8" />
    </div>
    <div
      v-else-if="members.items.length === 0"
      class="text-center py-8 text-muted"
    >
      No members yet
    </div>
    <div v-else ref="membersListRef" class="space-y-2 max-h-[55vh] overflow-y-auto">
      <div
        v-for="member in members.items"
        :key="member.id"
        class="flex items-center gap-3 p-2 rounded-lg bg-elevated/30 hover:bg-elevated/50 transition"
      >
        <LazyUserAvatar :img="member.user?.avatar" class="size-10" />
        <div class="flex-1 min-w-0">
          <p class="font-medium truncate">{{ member.user?.name }}</p>
          <p class="text-xs text-muted">{{ member.role }}</p>
        </div>
        <UBadge
          v-if="member.role === 'owner'"
          color="warning"
          size="xs"
          icon="i-lucide-crown"
        >
          Owner
        </UBadge>
        <UBadge
          v-else-if="member.role === 'admin'"
          color="info"
          size="xs"
          icon="i-lucide-shield"
        >
          Admin
        </UBadge>

        <!-- Kick — unified kick path (ADR 0017): duration popup, no duration-less kick.
             Rank-gated: an admin sees no kick button on the owner or on a peer admin. -->
        <KickDurationPopover
          v-if="canManageMembers && canRemove(member.user_id)"
          @select="(duration: BlockDurationValue) => handleKickMember(member, duration)"
        >
          <UButton
            icon="i-lucide-log-out"
            color="error"
            variant="ghost"
            size="xs"
            @click.stop
          />
        </KickDurationPopover>

        <!-- Role management (promote/demote) — owner only. An admin who could
             promote would be able to out-number the owner in their own room,
             and the API refuses it, so the control is not offered. -->
        <UDropdownMenu
          v-if="canManageAdmins && member.role !== 'owner'"
          :items="getMemberActions(member)"
          style="--ui-primary: var(--room-theme, var(--color-primary)); --ui-color-primary-500: var(--room-theme, var(--color-primary-500));"
        >
          <UButton
            icon="i-lucide-more-vertical"
            color="neutral"
            variant="ghost"
            size="xs"
            @click.stop
          />
        </UDropdownMenu>
      </div>
      <div v-if="membersLoading" class="flex justify-center py-3">
        <UIcon name="i-lucide-loader-2" class="animate-spin size-5" />
      </div>
    </div>
  </div>
</template>

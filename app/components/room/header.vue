<script setup lang="ts">
import type { LevelConfig } from '~/types/bootstrap';
import { createLogger } from '~/utils/logger';

const log = createLogger('[RoomHeader]');

// ========================================
// Stores
// ========================================

const roomStore = useRoomStore();
const bootstrapStore = useBootstrapStore();
const { leaveRoom } = useRoomAudio();

// ========================================
// State
// ========================================

const open = ref(false);
const settingsOpen = ref(false);

// ========================================
// Computed - Room Data
// ========================================

const thisRoom = computed(() => roomStore.currentRoom);
const loading = computed(() => !bootstrapStore.isReady);

// ========================================
// Computed - Level Configuration
// ========================================

/** Room level config from bootstrap store */
const levelConfig = computed<LevelConfig[]>(() => 
  bootstrapStore.config?.room_levels ?? []
);

/** Current room level */
const currentLevel = computed(() => 
  thisRoom.value?.current_level ?? 0
);

/** Next level number */
const nextLevel = computed(() => 
  currentLevel.value + 1
);

/** Current room XP (parsed from string) */
const currentXP = computed(() => {
  const xpString = thisRoom.value?.room_xp ?? '0';
  return parseFloat(xpString) || 0;
});

/** Formatted current XP for display */
const formattedCurrentXP = computed(() => 
  currentXP.value.toLocaleString()
);

/** XP remaining to reach next level */
const xpRemaining = computed(() => {
  const nextLevelConfig = levelConfig.value.find(l => l.level === nextLevel.value);
  if (!nextLevelConfig) return 0;
  
  const remaining = nextLevelConfig.required_xp - currentXP.value;
  return Math.max(0, remaining);
});

/** Formatted XP remaining for display */
const formattedXpRemaining = computed(() => 
  xpRemaining.value.toLocaleString()
);

/** Progress percentage toward next level */
const progressValue = computed(() => {
  const currentLevelConfig = levelConfig.value.find(l => l.level === currentLevel.value);
  const nextLevelConfig = levelConfig.value.find(l => l.level === nextLevel.value);
  
  if (!currentLevelConfig || !nextLevelConfig) return 0;
  
  const currentThreshold = currentLevelConfig.required_xp;
  const nextThreshold = nextLevelConfig.required_xp;
  const xpInLevel = currentXP.value - currentThreshold;
  const xpNeeded = nextThreshold - currentThreshold;
  
  if (xpNeeded <= 0) return 100;
  return Math.min(100, (xpInLevel / xpNeeded) * 100);
});

/** Current level badge from config's badge_id */
const currentBadge = computed(() => {
  const currentLevelConfig = levelConfig.value.find(l => l.level === currentLevel.value);
  if (!currentLevelConfig?.badge_id) return null;
  
  return bootstrapStore.badgeMap.get(currentLevelConfig.badge_id) ?? null;
});

/** Level status object for template conditional */
const levelStatus = computed(() => {
  if (!thisRoom.value) return null;
  return {
    current_level: currentLevel.value,
    current_xp: currentXP.value,
    xp_remaining: xpRemaining.value,
    progress_percentage: progressValue.value,
  };
});

// ========================================
// Membership State (for non-members)
// ========================================

const authStore = useAuthStore();
const { myJoinRequests } = useRoomJoinRequests();
const { receivedInvitations, fetchReceivedInvitations } = useRoomInvitations();

// Fetch invitations on mount to check if user has pending invitations
onMounted(() => {
  fetchReceivedInvitations(true);
});

/** Current user's membership state for this room */
const membershipState = computed(() => {
  if (!thisRoom.value) return 'none';
  
  const roomId = thisRoom.value.id;
  
  // Owner is always a member
  if (roomStore.isRoomOwner) return 'member';
  
  // Check if we have a pending join request for this room
  // Note: items may have room_id or room.id depending on API response
  const pendingRequest = myJoinRequests.value.items.find(
    (r) => r && (r.room_id === roomId || r.room?.id === roomId) && r.status === 'pending'
  );
  if (pendingRequest) return 'pending_request';
  
  // Check if we have a pending invitation for this room
  // RoomInvitationResource returns room.id, not room_id
  const pendingInvite = receivedInvitations.value.items.find(
    (inv) => inv && (inv.room?.id === roomId) && inv.status === 'pending'
  );
  if (pendingInvite) return 'has_invitation';
  
  // For now, treat everyone as non-member (can request to join)
  return 'none';
});

/** Get invitation ID if user has a pending invitation */
const pendingInvitationId = computed(() => {
  if (!thisRoom.value) return undefined;
  const roomId = thisRoom.value.id;
  const pendingInvite = receivedInvitations.value.items.find(
    (inv) => inv && (inv.room?.id === roomId) && inv.status === 'pending'
  );
  return pendingInvite?.id;
});

/** Should show membership action (non-owner, non-members) */
const showMembershipAction = computed(() => {
  return membershipState.value !== 'member' && !roomStore.isRoomOwner;
});

// ========================================
// Handlers
// ========================================

/**
 * Handle opening the leave drawer
 * Blurs the trigger button first to avoid "Blocked aria-hidden" warning
 * caused by the drawer trying to hide the focused element's container
 */
const openLeaveDrawer = (event: Event) => {
  const target = event.currentTarget as HTMLElement | null;
  target?.blur();
  open.value = true;
};
</script>

<template>

  <header class="flex justify-between items-center">

    <!-- Left Section -->
    <div class="rounded-md flex items-center bg-primary/10 border border-primary-700 gap-1 backdrop-blur-xl">
      <UDrawer
          title="Room Information Drawer"
          description="Room Information and Level Status."
      >
        <div class="w-10">
          <UserAvatar :animated="true" :img="thisRoom?.logo" />
          <p class="text-xs text-center">LvL. {{ thisRoom?.current_level != null ? thisRoom.current_level : 0 }}</p>
        </div>

        <template #content>
          <div class="px-3">
            <SectionTitle class="mb-3">Room Details</SectionTitle>
            <div class="px-2 pt-3 pb-12 bg-neutral-800 rounded-t-lg inset-shadow-sm inset-shadow-neutral-800 gap-4">
              <RoomDetails />

              <div class="flex items-center justify-between">
                <SectionTitle class="mt-1">Levels</SectionTitle>
                <ProfileBadge 
                  :badge-src="currentBadge?.image_url ?? '/badges/profile-1.webp'"
                  :txt="thisRoom?.current_level ?? 0" 
                />
              </div>
              <!-- Progress Bar -->
              <UProgress :model-value="progressValue" color="primary" class="mt-2" />
              <div class="flex justify-between items-center">
                <p class="text-md font-bold">LvL: {{ currentLevel }}</p>
                <p class="text-md font-bold">LvL: {{ nextLevel }}</p>
              </div>

              <!-- XP Info Box -->
              <p
                v-if="!loading && levelStatus"
                class="text-base font-bold bg-neutral-950 rounded-md px-2 py-1 leading-tight text-shadow-md inset-shadow-sm"
              >
                You have <span class="text-primary">{{ formattedCurrentXP }} (XP)</span>
                You Need <span class="text-primary">{{ formattedXpRemaining }} (XP)</span>
                Experience Points more to reach Level {{ nextLevel }}
              </p>
              <div v-else-if="loading" class="h-12 bg-muted rounded-md animate-pulse" />
            
              <!-- Room Actions -->
            </div>
          </div>
        </template>
      </UDrawer>

      <div>
        <div class="flex items-center justify-between gap-2 pr-1">
          <div>
            <h1 class="text-sm font-bold leading-tight">{{ thisRoom?.name }}</h1>
            <ProfileBadge :txt="thisRoom?.owner?.signature" :show-badge="false" />
          </div>  
          <UButton icon="i-lucide-bookmark" variant="subtle" class="shadow-md shadow-primary-950/50" size="sm" />
        </div>

        <div class="flex items-center gap-1 mt-1">
          <p class="text-xs">Show badges here</p>
        </div>
      </div>
    </div>

    <!-- Right Section -->
    <div class="flex items-center ml-auto gap-2">
      <!-- Settings Button (visible to all users - role-based actions inside drawer) -->
      <UButton
          icon="i-lucide-settings"
          size="xl"
          class="rounded-full cursor-pointer shadow-lg shadow-primary-950/50 border border-primary-600 backdrop-blur-xs"
          variant="soft"
          @click="settingsOpen = true"
      />

      <UButton
          icon="i-lucide-share-2"
          size="xl"
          class="rounded-full cursor-pointer shadow-lg shadow-primary-950/50 border border-primary-600 backdrop-blur-xs"
          variant="soft"
      />

      <UDrawer
          v-model:open="open"
          title="Close Or Minimize Room"
          description="Close Or Minimize Room to go back to the room page"
      >
        <UButton
            icon="i-lucide-x"
            size="xl"
            class="rounded-full border border-primary-600 cursor-pointer shadow-lg shadow-primary-950/50 backdrop-blur-xs"
            variant="subtle"
            @click="openLeaveDrawer"
        />

        <template #content>
          <div class="px-3 mt-2">
            <div class="p-4 bg-neutral-800 rounded-t-lg inset-shadow-sm inset-shadow-neutral-800 flex items-center justify-between gap-4">
              <UButton
                  icon="i-lucide-minimize" color="secondary" size="xl" variant="subtle"
                  class="w-full justify-center"
                  @click="roomStore.minimizeRoom();open = false"
              >
                Minimize
              </UButton>

              <UButton
                  icon="i-lucide-door-open"
                  class="w-full justify-center"
                  size="xl" variant="subtle"
                  @click="async () => {
                    try {
                      leaveRoom();
                      roomStore.leaveRoom();
                      open = false;
                    } catch (error) {
                      log.error('Failed to leave room:', error);
                    }
                  }"
                >
                Leave
              </UButton>
            </div>
          </div>
        </template>
      </UDrawer>
    </div>
  </header>

  <!-- Settings Drawer (Owner/Admin only) -->
  <RoomSettingsDrawer v-model:open="settingsOpen" />

</template>
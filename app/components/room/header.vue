<script setup lang="ts">
import type { LevelConfig } from '~/types/user/bootstrap';
import { createLogger } from '~/utils/logger';

const log = createLogger('[RoomHeader]');

// ========================================
// Stores
// ========================================

const roomStore = useRoomStore();
const bootstrapStore = useBootstrapStore();
const { isRoomOwner } = useRoomPermissions();
const { leaveRoom } = useRoomAudio();

// ========================================
// State
// ========================================

const open = ref(false);
const showMembersPanel = ref(false);

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
// Membership (for Members Button)
// ========================================

const { myMembership, fetchMyMembership } = useRoomMembers();

onMounted(() => fetchMyMembership());

/** Whether current user can manage members (owner or admin) */
const canManageMembers = computed(() => {
  if (isRoomOwner.value) return true;
  const membership = myMembership.value;
  if (membership?.room_id === thisRoom.value?.id && membership?.role === 'admin') return true;
  return false;
});

// ========================================
// Handlers
// ========================================

/**
 * Handle opening the leave drawer.
 * Blurs the trigger button first to avoid "Blocked aria-hidden" warning
 * caused by the drawer trying to hide the focused element's container.
 * Also prefetches the target navigation route for instant transition.
 */
const openLeaveDrawer = (event: Event) => {
  const target = event.currentTarget as HTMLElement | null;
  target?.blur();
  open.value = true;
  // Prefetch the route we'll navigate to on minimize
  preloadRouteComponents(roomStore.previousRoute ?? '/');
};

// ========================================
// Settings Drawer State
// ========================================
const settingsOpen = ref(false);
</script>

<template>

  <header class="flex justify-between items-center">

    <!-- Left Section -->
    <div class="rounded-md flex items-center bg-primary/10 gap-1 backdrop-blur-xl">
      <!-- Level Drawer -->
      <UDrawer
          title="Room Information Drawer"
          description="Room Information and Level Status."
          style="--ui-primary: var(--room-theme, var(--color-primary)); --ui-color-primary-500: var(--room-theme, var(--color-primary-500));"
      >
        <div class="w-10">
          <UserAvatar :animated="true" :img="thisRoom?.logo" :frame-asset-url="thisRoom?.owner?.frame ?? undefined" />
          <p class="text-xs text-center">LvL. {{ thisRoom?.current_level != null ? thisRoom.current_level : 0 }}</p>
        </div>

        <template #content>
          <div class="px-3">
            <div class="flex justify-between items-baseline w-full py-2">
              <SectionTitle>Room Details</SectionTitle>

              <!-- Room Settings (cog icon, above volume) -->
              <UButton
                  icon="i-lucide-settings"
                  size="md"
                  variant="subtle"
                  @click="settingsOpen = true"
              >
                Room Settings
              </UButton>
            </div>



            <div class="px-2 pt-3 pb-12 bg-neutral-800 rounded-t-lg inset-shadow-sm inset-shadow-neutral-800 gap-4">
              <RoomDetails />

              <div class="flex items-center justify-between">
                <SectionTitle class="mt-1">Levels</SectionTitle>
                <ProfileBadge 
                  :badge-src="currentBadge?.image_url ?? 'https://ik.imagekit.io/flylive/badges/profile-1.webp'"
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
      <!-- Members Button (Owner/Admin only) -->
      <UButton
        v-if="canManageMembers"
        icon="i-lucide-users"
        size="xl"
        class="rounded-full cursor-pointer shadow-lg shadow-primary/50 ring ring-primary backdrop-blur-xs"
        variant="soft"
        @click="showMembersPanel = true"
      />

      <UButton
        icon="i-lucide-share-2"
        size="xl"
        class="rounded-full cursor-pointer shadow-lg shadow-primary/50 ring ring-primary backdrop-blur-xs"
        variant="soft"
      />

      <UDrawer
        v-model:open="open"
        title="Close Or Minimize Room"
        description="Close Or Minimize Room to go back to the room page"
        style="--ui-primary: var(--room-theme, var(--color-primary)); --ui-color-primary-500: var(--room-theme, var(--color-primary-500));"
      >
        <UButton
          icon="i-lucide-x"
          size="xl"
          class="rounded-full cursor-pointer shadow-lg shadow-primary/50 ring ring-primary backdrop-blur-xs"
          variant="soft"
          @click="openLeaveDrawer"
        />

        <template #content>
          <div class="px-3 mt-2">
            <div class="p-4 bg-neutral-800 rounded-t-lg inset-shadow-sm inset-shadow-neutral-800 flex items-center justify-between gap-4">
              <UButton
                icon="i-lucide-minimize" color="secondary" size="xl" variant="subtle"
                class="w-full justify-center"
                @click="() => { const target = roomStore.previousRoute && !roomStore.previousRoute.startsWith('/room/') ? roomStore.previousRoute : '/'; roomStore.minimizeRoom(); open = false; navigateTo(target); }"
              >
                Minimize
              </UButton>

              <UButton
                  icon="i-lucide-door-open"
                  class="w-full justify-center"
                  size="xl" variant="subtle"
                  @click="async () => {
                    try {
                      const target = roomStore.previousRoute && !roomStore.previousRoute.startsWith('/room/') ? roomStore.previousRoute : '/';
                      leaveRoom();
                      roomStore.leaveRoom();
                      open = false;
                      navigateTo(target, { replace: true });
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
  <!-- Settings Drawer (inside root to avoid aria-hidden issues) -->
  <LazyRoomSettingsDrawer v-model:open="settingsOpen" />
  <!-- Members Panel (Owner/Admin only) -->
  <RoomMembersPanel v-if="canManageMembers" v-model:open="showMembersPanel" :room-id="thisRoom?.id ?? 0" style="--ui-primary: var(--room-theme, var(--color-primary)); --ui-color-primary-500: var(--room-theme, var(--color-primary-500));" />

</template>
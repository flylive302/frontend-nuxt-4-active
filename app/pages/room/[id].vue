<script setup lang="ts">
/**
 * Room Page — Full-screen room UI
 *
 * Pure presentation page. Room lifecycle (join/leave/reconnect) is managed
 * by useRoomLifecycle composable in app.vue. State comes from Pinia store.
 */

import auth from '~/middleware/auth';

definePageMeta({
  layout: false,
  middleware: auth
});

const roomStore = useRoomStore();
const { isLocalMuted, toggleLocalMute, isProducing, setVolume } = useRoomAudio();
const { isLuckyComboActive, luckyCombo, endLuckyCombo } = useGiftSending();
const {
  floatingMultipliers,
  roomAnnouncement,
  isRoomAnnouncementVisible,
  dismissRoomAnnouncement,
  appAnnouncement,
  isAppAnnouncementVisible,
  dismissAppAnnouncement,
} = useLuckyGift();

/** Handle lucky combo button click */
async function onLuckyCombo() {
  await luckyCombo();
}

// ========================================
// Route Guard — redirect home if no room in store
// ========================================


watch(
  () => roomStore.currentRoom,
  (room) => {
    if (!room) {
      const target = roomStore.previousRoute && !roomStore.previousRoute.startsWith('/room/') ? roomStore.previousRoute : '/';
      navigateTo(target, { replace: true });
    }
  },
  { immediate: true },
);

// ========================================
// Body Scroll Lock
// ========================================
onMounted(() => {
  document.body.removeAttribute('style');
  document.body.classList.remove('unlock-body');
  document.body.classList.add('lock-body');
});

onUnmounted(() => {
  setTimeout(() => {
    document.body.removeAttribute('style');
    document.body.classList.remove('lock-body');
    document.body.classList.add('unlock-body');
  }, 100);
});



// ========================================
// Settings Drawer State
// ========================================
const settingsOpen = ref(false);

// ========================================
// Volume Control State
// ========================================
const VOLUME_STORAGE_KEY = 'flylive:room:volume';
const savedVolume = typeof localStorage !== 'undefined'
  ? parseFloat(localStorage.getItem(VOLUME_STORAGE_KEY) ?? '0.8')
  : 0.8;
const volume = ref(savedVolume);
const isMuted = ref(false);
const volumePopoverOpen = ref(false);

/**
 * Handle volume slider change.
 */
function onVolumeChange(value: number | undefined): void {
  const vol = value ?? 0.8;
  volume.value = vol;
  isMuted.value = vol === 0;
  setVolume(vol);

  // Persist to localStorage
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(VOLUME_STORAGE_KEY, String(vol));
  }
}

/**
 * Toggle mute/unmute.
 */
function toggleMute(): void {
  if (isMuted.value) {
    // Unmute — restore previous volume
    const restored = savedVolume > 0 ? savedVolume : 0.5;
    volume.value = restored;
    isMuted.value = false;
    setVolume(restored);
  } else {
    // Mute
    isMuted.value = true;
    setVolume(0);
  }
}

/**
 * Volume icon based on current state.
 */
const volumeIcon = computed(() => {
  if (isMuted.value || volume.value === 0) return 'i-lucide-volume-x';
  if (volume.value < 0.5) return 'i-lucide-volume-1';
  return 'i-lucide-volume-2';
});

// Apply saved volume on mount
onMounted(() => {
  setVolume(volume.value);
});

// ========================================
// Global Theme Variable Injection (for Room scope only)
// ========================================
const roomThemeVar = useCssVar('--room-theme', typeof document !== 'undefined' ? document.documentElement : null);

watchEffect(() => {
  if (roomStore.currentRoom?.primary_color) {
    roomThemeVar.value = roomStore.currentRoom.primary_color;
  } else {
    roomThemeVar.value = ''; // Reset when no custom color
  }
});

onUnmounted(() => {
  roomThemeVar.value = ''; // Clean up when leaving room
});
</script>

<template>
  <div 
    class="absolute inset-0 z-50 p-1 pb-6 max-h-screen bg-elevated"
    :style="roomThemeVar ? { '--ui-primary': 'var(--room-theme)', '--ui-color-primary-500': 'var(--room-theme)', '--ui-color-primary-600': 'var(--room-theme)' } : {}"
  >
    <template v-if="roomStore.currentRoom">
      <!-- Background Image (prefer background field, fallback to logo) -->
      <div class="absolute inset-0 z-0 tint-500">
        <NuxtImg
          :src="roomStore.currentRoom?.background ?? 'https://ik.imagekit.io/flylive/room/5.gif'"
          class="bg-fixed object-cover size-full"
          format="webp"
          sizes="100vw"
          loading="eager"
        />
      </div>

      <!-- Content -->
      <div class="relative z-10 h-full flex flex-col">

        <!-- Lucky Gift Animations -->
        <LuckyMultiplierFloat :floaters="floatingMultipliers" />

        <RoomHeader />

        <RoomInfo />

        <!-- Audio Player: draggable floating panel, only rendered for the active music controller -->
        <RoomAudioPlayer />

        <!-- Seats Grid -->
        <main class="grid grid-cols-5 gap-x-2">
          <RoomSeat v-for="i in (roomStore.currentRoom?.max_seats ?? 15)" :key="i" :seat-id="i" />
        </main>

        <LuckyRoomAnnouncement
          v-if="roomAnnouncement"
          :announcement="roomAnnouncement"
          :visible="isRoomAnnouncementVisible"
          @dismiss="dismissRoomAnnouncement"
        />

        <LuckyAppAnnouncement
          v-if="appAnnouncement"
          :announcement="appAnnouncement"
          :visible="isAppAnnouncementVisible"
          @dismiss="dismissAppAnnouncement"
        />

        <LazyRoomSeatDrawer title="Room Seat Drawer" description="Room Seat Description" />

        <!-- Bottom Section: Chat + Controls -->
        <div class="flex grow gap-1 mt-1 min-h-0 pl-2">
          <!-- Chat Panel -->
          <div class="size-full flex flex-col inset-shadow-2xs">
            <RoomChatPanel />
          </div>

          <!-- Side Controls & Gifting -->
          <div class="flex flex-col items-center gap-3 justify-end">

            <!-- Room Settings (cog icon, above volume) -->
            <UButton
              icon="i-lucide-settings"
              size="md"
              variant="subtle"
              @click="settingsOpen = true"
            />

            <!-- Volume Control with Popover -->
            <UPopover v-model:open="volumePopoverOpen" :ui="{ content: 'p-2' }" style="--ui-primary: var(--room-theme, var(--color-primary)); --ui-color-primary-500: var(--room-theme, var(--color-primary-500));">
              <UButton
                :icon="volumeIcon"
                size="md"
                variant="subtle"
                @click.right.prevent="toggleMute"
              />

              <template #content>
                <div class="flex flex-col items-center gap-2 py-2 w-8">
                  <USlider
                    :model-value="isMuted ? 0 : volume"
                    :min="0"
                    :max="1"
                    :step="0.05"
                    orientation="vertical"
                    class="h-24"
                    @update:model-value="onVolumeChange"
                  />
                  <UButton
                    :icon="volumeIcon"
                    size="xs"
                    variant="ghost"
                    @click="toggleMute"
                  />
                </div>
              </template>
            </UPopover>

            <!-- Mic Mute/Unmute - only show when producing audio -->
            <UButton
              v-if="isProducing"
              size="md"
              :icon="isLocalMuted ? 'i-lucide-mic-off' : 'i-lucide-mic'"
              :variant="isLocalMuted ? 'solid' : 'subtle'"
              :color="isLocalMuted ? 'error' : 'primary'"
              @click="() => { toggleLocalMute() }"
            />
            <UButton v-else icon="i-lucide-mic" size="md" variant="soft" disabled />

            <LazyRoomGiftDrawer />
          </div>

        </div>

      </div>

      <!-- Gift Playback Modal (full-screen, outside content area) -->
      <LazyRoomGiftPlaybackModal />

      <!-- Lucky Gift Fly Animation (thumbnail: sender → center → receiver) -->
      <LuckyGiftFly />

      <!-- Lucky Gift Combo Button (visible after sending a lucky gift) -->
      <RoomGiftComboButton
        v-if="isLuckyComboActive"
        @click="onLuckyCombo"
        @timeout="endLuckyCombo"
      />

      <!-- Settings Drawer (inside root to avoid aria-hidden issues) -->
      <LazyRoomSettingsDrawer v-model:open="settingsOpen" />
    </template>
  </div>
</template>


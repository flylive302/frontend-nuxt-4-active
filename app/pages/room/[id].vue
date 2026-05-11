<script setup lang="ts">
import { ASSETS } from '~/constants/assets'
import { withImageKitTransform } from '~/utils/imagekit'
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

const roomBackgroundDisplaySrc = computed(() =>
  withImageKitTransform(
    roomStore.currentRoom?.background ?? ASSETS.ROOM_BG_PLACEHOLDER,
    { w: 960, q: 75 },
  ),
)
const { isLocalMuted, toggleLocalMute, isProducing, setVolume } = useRoomAudio();

const {
  floatingMultipliers,
  roomAnnouncement,
  isRoomAnnouncementVisible,
  dismissRoomAnnouncement,
  appAnnouncement,
  isAppAnnouncementVisible,
  dismissAppAnnouncement,
} = useLuckyGift();



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


// Reactive — updates live as the value changes
const roomColor = computed(() => roomStore.currentRoom?.primary_color ?? '#000000')
useThemeColor(roomColor)

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
const lastNonZeroVolume = ref(savedVolume > 0 ? savedVolume : 0.8);

/**
 * Handle volume slider change.
 */
function onVolumeChange(value: number | undefined): void {
  const vol = value ?? 0.8;
  volume.value = vol;
  isMuted.value = vol === 0;
  if (vol > 0) {
    lastNonZeroVolume.value = vol;
  }
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
    // Unmute — restore last known non-zero volume.
    const restored = lastNonZeroVolume.value > 0 ? lastNonZeroVolume.value : 0.5;
    volume.value = restored;
    isMuted.value = false;
    setVolume(restored);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(VOLUME_STORAGE_KEY, String(restored));
    }
  } else {
    // Mute
    isMuted.value = true;
    if (volume.value > 0) {
      lastNonZeroVolume.value = volume.value;
    }
    volume.value = 0;
    setVolume(0);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(VOLUME_STORAGE_KEY, '0');
    }
  }
}

/**
 * Volume icon based on the current state.
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
    class="absolute inset-0 z-50 p-1 pb-6 safe-area-top max-h-screen max-w-screen overflow-hidden bg-elevated"
    :style="roomThemeVar ? { '--ui-primary': 'var(--room-theme)', '--ui-color-primary-500': 'var(--room-theme)', '--ui-color-primary-600': 'var(--room-theme)' } : {}"
  >
    <template v-if="roomStore.currentRoom">
      <!-- Background Image (prefer background field, fallback to logo) -->
      <div class="absolute inset-0 z-0 tint-500">
        <NuxtImg
          :src="roomBackgroundDisplaySrc"
          sizes="100vw"
          class="bg-fixed object-cover size-full"
          format="webp"
          loading="eager"
        />
      </div>

      <!-- Content -->
      <div class="relative z-10 h-full flex flex-col mt-2">

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

        <LazyRoomSeatDrawer />

        <!-- Bottom Section: Chat + Controls -->
        <div class="flex grow gap-1 mt-1 min-h-0 pl-2">
          <!-- Chat Panel -->
          <div class="size-full flex flex-col inset-shadow-2xs">
            <RoomChatPanel />
          </div>

          <!-- Side Controls & Gifting -->
          <div class="flex flex-col items-center gap-3 justify-end">

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


    </template>
  </div>
</template>


<script setup lang="ts">
import { DEFAULT_SEAT_COUNT } from '~/constants/room'
/**
 * Room Page — Full-screen room UI
 *
 * Pure presentation page. Room lifecycle (join/leave/reconnect) is managed
 * by useRoomLifecycle composable in app.vue. State comes from Pinia store.
 */

import auth from '~/middleware/auth';

definePageMeta({
  layout: false,
  middleware: [auth, 'room-block'],
  // Transitions are global (nuxt.config `app.viewTransition: true`). The room-card
  // morph is activated per-nav by room-transition.global.ts, which also suppresses
  // the generic root slide for this nav — see main.css.
});

const roomStore = useRoomStore();

const { roomExpandStyle } = useRoomExpandTransition();
const { src: roomBackgroundDisplaySrc } = useRoomBackground(() => roomStore.currentRoom?.background);
const { isLocalMuted, toggleLocalMute, isProducing, setVolume } = useRoomAudio();

const { floatingMultipliers } = useLuckyGift();



// ========================================
// Route Guard — rehydrate on cold mount, redirect only on a genuine leave
// ========================================

const route = useRoute();
const { rehydrateFromRoute, rehydrating } = useRoomRehydration();

/**
 * A full reload nulls `currentRoom` (it is in-memory only), which is
 * indistinguishable from a genuine leave by store state alone. Attempt a
 * marker-authorised rehydrate before treating an empty store as "the user left"
 * — that conflation is what silently ejected reloading users.
 */
function leaveRoomPage(): void {
  const target = roomStore.previousRoute && !roomStore.previousRoute.startsWith('/room/') ? roomStore.previousRoute : '/';
  navigateTo(target, { replace: true });
}

watch(
  () => roomStore.currentRoom,
  async (room) => {
    if (room) return;
    // Already recovering — don't race the rehydrate with a redirect.
    if (rehydrating.value) return;

    const roomId = Number(route.params.id);
    if (Number.isFinite(roomId) && await rehydrateFromRoute(roomId)) return;

    leaveRoomPage();
  },
  { immediate: true },
);

// ========================================
// Body Scroll Lock
// ========================================
onMounted(() => {
  // Being on the room page means the room is open, never minimized
  if (roomStore.isMinimized) roomStore.maximizeRoom();

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
const settingsOpen = ref(false);
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
  <!-- `roomExpandStyle` names this element as the room card's counterpart: the
       card's box is interpolated into this one on entry, and back out on leave. -->
  <div
    class="absolute inset-0 z-50 p-1 safe-area-top safe-area-bottom max-h-screen max-w-screen overflow-hidden bg-elevated"
    :style="[roomExpandStyle, roomThemeVar ? { '--ui-primary': 'var(--room-theme)', '--ui-color-primary-500': 'var(--room-theme)', '--ui-color-primary-600': 'var(--room-theme)' } : {}]"
  >
    <template v-if="roomStore.currentRoom">
      <!-- Background Image — first frame of the reveal, seeded from the card's cached bitmap -->
      <div class="absolute inset-0 z-0 tint-500">
        <img
          :src="roomBackgroundDisplaySrc"
          alt=""
          class="bg-fixed object-cover size-full"
          loading="eager"
          fetchpriority="high"
          decoding="async"
        >
      </div>

      <!-- Content — settles in over the background so lazily-mounted panels
           (drawers, chat, seats) never snap into place on top of it. -->
      <div class="room-content relative z-10 h-full flex flex-col mt-2">

        <!-- Lucky Gift Animations -->
        <LuckyMultiplierFloat :floaters="floatingMultipliers" />

        <RoomHeader />

        <RoomInfo />

        <!-- Audio Player: draggable floating panel, only rendered for the active music controller -->
        <RoomAudioPlayer />

        <!-- Seats Grid -->
        <div class="scrollbar-hide max-h-[45vh] min-h-[45vh] overflow-scroll scrollbox rounded-xl mb-1">
          <main class="grid grid-cols-5 gap-x-2">
            <RoomSeat v-for="i in (roomStore.currentRoom?.max_seats ?? DEFAULT_SEAT_COUNT)" :key="i" :seat-id="i" />
          </main>
        </div>

        <LazyRoomSeatDrawer />
        <LazyRoomChatDrawer />

        <!-- Bottom Section: Chat + Controls -->
        <div class="flex grow gap-1 mt-1 min-h-0 pl-2">
          <!-- Chat Panel -->
          <div class="size-full flex flex-col">
            <RoomChatPanel />

            <div class="flex gap-3 py-2 mb-2">
              <!-- Volume Control with Popover -->
              <UPopover v-model:open="volumePopoverOpen" :ui="{content: 'bg-transparent backdrop-blur-xl ring-0'}">
                <UButton
                    :icon="volumeIcon"
                    size="md"
                    variant="subtle"
                    class="backdrop-blur-lg text-primary"
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
                        class="h-24 text-primary"
                        @update:model-value="onVolumeChange"
                    />
                    <UButton
                        :icon="volumeIcon"
                        size="xs"
                        variant="ghost"
                        class="text-primary"
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
                  :class="isLocalMuted ? 'text-white' : 'text-primary'"
                  class="backdrop-blur-lg"
                  @click="() => { toggleLocalMute() }"
              />
              <UButton v-else icon="i-lucide-mic" size="md" class="text-primary" variant="soft" disabled />

              <!-- Reaction Drawer trigger (ADR 0015) -->
              <LazyRoomReactionDrawer />

              <!-- Room Settings Button -->
              <UButton
                  icon="i-lucide-settings"
                  size="md"
                  variant="subtle"
                  class="backdrop-blur-lg text-primary"
                  @click="() => { settingsOpen = true }"
              />

              <!-- Users Inbox Model View -->
              <LazyRoomInboxDrawer />
            </div>
          </div>

          <!-- Side Controls & Gifting -->
          <div class="flex flex-col items-center gap-3 justify-end pb-3">

            <LazyRoomGiftDrawer />
          </div>

        </div>

      </div>

      <!-- Settings Drawer -->
      <LazyRoomSettingsDrawer v-model:open="settingsOpen" />

      <!-- Gift Playback Modal (full-screen, outside content area) -->
      <LazyRoomGiftPlaybackModal />

      <!-- Entry/gift/lucky slide banners now render through the global
           SlideOverlayLayer (app shell); the room-scoped RoomSlideBroadcast was
           retired in the unified-slide-overlay fold-in (ADR 0009). -->

      <!-- Lucky Gift Fly Animation (thumbnail: sender → center → receiver) -->
      <LuckyGiftFly />


    </template>

    <!-- Rehydrating after a reload — hold the page rather than redirecting, so a
         slow rejoin reads as work in progress instead of a freeze or an eject. -->
    <div v-else-if="rehydrating" class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3">
      <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-primary" />
      <p class="text-sm text-muted">Rejoining the room…</p>
    </div>
  </div>
</template>


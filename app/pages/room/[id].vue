<script setup lang="ts">
/**
 * Room Page — Full-screen room UI
 *
 * Pure presentation page. Room lifecycle (join/leave/reconnect) is managed
 * by useRoomLifecycle composable in app.vue. State comes from Pinia store.
 */
import { ASSET_PRELOAD_DELAY_MS } from '~/constants/room';
import auth from '~/middleware/auth';

definePageMeta({
  layout: false,
  middleware: auth
});

const roomStore = useRoomStore();
const { isLocalMuted, toggleLocalMute, isProducing } = useRoomAudio();

// ========================================
// Route Guard — redirect home if no room in store
// ========================================
const route = useRoute();
const roomId = computed(() => route.params.id as string);

watch(
  () => roomStore.currentRoom,
  (room) => {
    if (!room) {
      navigateTo('/', { replace: true });
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
// Asset Preloading (Opportunistic)
// ========================================
const { startIdlePreload } = useAssetPreloader();
onMounted(() => {
  // Delay to allow initial render to complete
  setTimeout(startIdlePreload, ASSET_PRELOAD_DELAY_MS);
});
</script>

<template>
  <div
    v-if="roomStore.currentRoom"
    class="absolute inset-0 z-50 p-1 pb-6 max-h-screen bg-elevated"
  >
    <!-- Background Image -->
    <div class="absolute inset-0 z-0 tint-500">
      <NuxtImg
        :src="roomStore.currentRoom?.logo ?? 'https://ik.imagekit.io/flylive/siteAssets/rooms/eagle3.webp'"
        class="bg-fixed object-cover size-full"
        format="webp"
        sizes="100vw"
        loading="eager"
      />
    </div>

    <!-- Content -->
    <div class="relative z-10 h-full flex flex-col">

      <RoomHeader />

      <RoomInfo />

      <!-- Seats Grid -->
      <main class="grid grid-cols-5 gap-x-2">
        <RoomSeat v-for="i in 15" :key="i" :seat-id="i" />
      </main>

      <LazyRoomSeatDrawer title="Room Seat Drawer" description="Room Seat Description" />

      <!-- Bottom Section: Chat + Controls -->
      <div class="flex grow gap-1 mt-1 min-h-0 pl-2">
        <!-- Chat Panel -->
        <div class="size-full flex flex-col inset-shadow-2xs">
          <RoomChatPanel />
        </div>

        <!-- Side Controls & Gifting -->
        <div class="flex flex-col items-center gap-3 justify-end">
          <LazyRoomGiftDrawer />
          <!-- Volume Control (placeholder for future) -->
          <UButton icon="i-lucide-volume-2" size="md" variant="subtle" />
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
        </div>

      </div>

    </div>

    <!-- Gift Playback Modal (full-screen, outside content area) -->
    <LazyRoomGiftPlaybackModal />

  </div>
</template>

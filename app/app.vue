<script setup lang="ts">
import { defineAsyncComponent } from 'vue'

// Lazy-load minimized room button — only loaded when user joins a room
const RoomMinimized = defineAsyncComponent(() => import('~/components/room/minimized.client.vue'))

const roomStore = useRoomStore()

// ========================================
// Persistent Room Lifecycle (join/leave/reconnect)
// ========================================
// Watchers survive across all route changes — audio stays connected
useRoomLifecycle()

// ========================================
// Screen Wake Lock (prevents screen timeout while app is active)
// ========================================
const { init: initWakeLock } = useWakeLock()
initWakeLock()

// ========================================
// Auto-Fetch Bootstrap & Start Asset Downloads
// ========================================
// Watch for conditions where we need to fetch bootstrap data or start downloads.
// This handles the post-login flow where the cookie is now available.

const authStore = useAuthStore()
const bootstrapStore = useBootstrapStore()
const levelsStore = useLevelsStore()
const { fetchBootstrap } = useBootstrapInit()
const { startAssetDownload } = useBootstrapAssets()
const assetStore = useAssetStore()

// Track if we're currently fetching to avoid duplicate calls
const isFetchingBootstrap = ref(false)

watch(
  [
    () => authStore.isAuthenticated,
    () => bootstrapStore.isReady,
    () => bootstrapStore.phase,
    () => bootstrapStore.giftCatalog.length,
    () => assetStore.phase,
  ],
  async ([isAuth, isReady, phase, giftCount, currentAssetPhase]) => {
    // Scenario 1: User is authenticated but bootstrap data not loaded
    // This happens after login when navigation completes
    if (isAuth && !isReady && phase === 'idle' && !isFetchingBootstrap.value) {
      isFetchingBootstrap.value = true
      try {
        const data = await fetchBootstrap()

        // Seed dependent stores — mirrors bootstrap.client.ts plugin logic
        if (data) {
          if (data.user) {
            authStore.setUser(data.user)
          }
          if (data.user_data?.levels) {
            levelsStore.setLevels(data.user_data.levels.wealth, data.user_data.levels.charm)
          }
        }
      } finally {
        isFetchingBootstrap.value = false
      }
      return
    }

    // Scenario 2: Bootstrap ready, gifts available, start downloading
    if (isAuth && isReady && giftCount > 0 && currentAssetPhase === 'idle') {
      startAssetDownload()
    }
  },
  { immediate: true }
)
</script>

<template>
  <UApp>
    <!-- Full Screen Loader (during bootstrap) -->
    <PreloaderFullScreenLoader />

    <NuxtRouteAnnouncer />
    <NuxtLoadingIndicator />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>

    <!-- Minimized Room Button (floating, only when room is active & minimized) -->
    <RoomMinimized v-if="roomStore.currentRoom && roomStore.isMinimized" />

    <!-- PWA Components -->

    <!-- Download Progress Bar (top of screen during asset download) -->
    <SystemDownloadProgressBar 
      :progress="assetStore.progress"
      :visible="assetStore.phase === 'downloading'"
    />



    <!-- Storage Permission Banner (auto-shows on first visit) -->
    <SystemStoragePermissionBanner />

    <!-- PWA Install Prompt (auto-shows when browser fires before install prompt) -->
    <SystemPwaInstallPrompt />

    <!-- Update Available Toast (auto-shows when new SW version is ready) -->
    <SystemUpdateAvailableToast />

    <!-- Achievement Modals (triggered by socket events) -->
    <EventsBadgeEarnedModal />
    <EventsLevelUpModal />
    <EventsIncomeTargetModal />
  </UApp>
</template>
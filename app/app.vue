<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { BODY_UNLOCK_DELAY_MS } from '~/constants/room'
import * as assetDownloader from '~/services/assetDownloader'

// Lazy-load room components - only loaded when user joins a room
const RoomShell = defineAsyncComponent(() => import('~/components/room/shell.vue'))
const RoomMinimized = defineAsyncComponent(() => import('~/components/room/minimized.client.vue'))

const roomStore = useRoomStore()
const bootstrapStore = useBootstrapStore()

// ========================================
// Room Body Scroll Lock
// ========================================

const toggleBodyScroll = () => {
  // If room is open (currentRoom exists and NOT minimized), lock body.
  const isShellVisible = roomStore.currentRoom && !roomStore.isMinimized;

  if (isShellVisible) {
    document.body.removeAttribute('style');
    document.body.classList.remove('unlock-body');
    document.body.classList.add('lock-body');
  } else {
    setTimeout(() => {
      document.body.removeAttribute('style');
      document.body.classList.remove('lock-body');
      document.body.classList.add('unlock-body');
    }, BODY_UNLOCK_DELAY_MS);
  }
}
// Run on component mount and whenever state changes
watch(
    [() => roomStore.isMinimized, () => roomStore.currentRoom], 
    toggleBodyScroll,
    { immediate: true }
)

// ========================================
// Cellular Consent Modal State
// ========================================

const showCellularConsent = ref(false)
const pendingDownloadSize = ref(0)

onMounted(() => {
  // Listen for cellular consent requests from asset downloader
  assetDownloader.onNeedConsent((sizeBytes) => {
    pendingDownloadSize.value = sizeBytes
    showCellularConsent.value = true
  })
})

function handleCellularConsent(granted: boolean): void {
  assetDownloader.setCellularConsent(granted)
  showCellularConsent.value = false
}

// ========================================
// Auto-Fetch Bootstrap & Start Asset Downloads
// ========================================
// Watch for conditions where we need to fetch bootstrap data or start downloads.
// This handles the post-login flow where the cookie is now available.

const authStore = useAuthStore()

// Track if we're currently fetching to avoid duplicate calls
const isFetchingBootstrap = ref(false)

watch(
  [
    () => authStore.isAuthenticated,
    () => bootstrapStore.isReady,
    () => bootstrapStore.phase,
    () => bootstrapStore.giftCatalog.length,
    () => bootstrapStore.assetPhase,
  ],
  async ([isAuth, isReady, phase, giftCount, assetPhase]) => {
    // Scenario 1: User is authenticated but bootstrap data not loaded
    // This happens after login when navigation completes
    if (isAuth && !isReady && phase === 'idle' && !isFetchingBootstrap.value) {
      isFetchingBootstrap.value = true
      try {
        await bootstrapStore.fetchBootstrap()
      } finally {
        isFetchingBootstrap.value = false
      }
      return
    }

    // Scenario 2: Bootstrap ready, gifts available, start downloading
    if (isAuth && isReady && giftCount > 0 && assetPhase === 'idle') {
      bootstrapStore.startAssetDownload()
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

    <RoomShell 
      v-if="roomStore.currentRoom"
      :class="!roomStore.isMinimized ? 'show-room-shell' : 'hide-room-shell'"
      :inert="roomStore.isMinimized"
    />

    <RoomMinimized 
      v-if="roomStore.currentRoom"
      :class="roomStore.isMinimized ? 'show-room-shell' : 'hide-room-shell'"
      :inert="!roomStore.isMinimized"
    />

    <!-- PWA Components -->

    <!-- Download Progress Bar (top of screen during asset download) -->
    <SystemDownloadProgressBar 
      :progress="bootstrapStore.assetProgress"
      :visible="bootstrapStore.assetPhase === 'downloading'"
    />

    <!-- Cellular Data Consent Modal -->
    <SystemCellularConsentModal
      v-model="showCellularConsent"
      :size-bytes="pendingDownloadSize"
      @consent="handleCellularConsent"
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
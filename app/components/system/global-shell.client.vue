<script lang="ts" setup>
import { defineAsyncComponent } from 'vue'

const roomStore = useRoomStore()
const authStore = useAuthStore()
const route = useRoute()
const assetStore = useAssetStore()
const { progress, phase, showDownloadGate } = storeToRefs(assetStore)

const RoomMinimized = defineAsyncComponent(() => import('~/components/room/minimized.client.vue'))

// Show the mini-player off the room route when either a live room is minimized,
// or a minimized-room snapshot survived a cold start (tap to rejoin).
const showMiniPlayer = computed(() =>
  authStore.isAuthenticated
  && !route.path.startsWith('/room/')
  && (
    (!!roomStore.currentRoom && roomStore.isMinimized)
    || (!roomStore.currentRoom && !!roomStore.minimizedRoom)
  ),
)

useRoomLifecycle()

const { init: initWakeLock } = useWakeLock()
initWakeLock()

const { init: initMediaSession } = useMediaSession()
initMediaSession()
</script>

<template>
  <div>
    <RoomMinimized v-if="showMiniPlayer" />

    <SystemDownloadScreen v-if="showDownloadGate" />

    <SystemDownloadProgressBar
      :progress="progress"
      :visible="phase === 'downloading' && !showDownloadGate"
    />

    <SystemStoragePermissionBanner />

    <SystemOtaUpdateToast />

    <SlideOverlayLayer />
  </div>
</template>

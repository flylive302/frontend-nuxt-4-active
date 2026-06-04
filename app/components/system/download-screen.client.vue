<script setup lang="ts">
// ========================================
// Asset Download Screen
// ========================================
// Full-screen gate shown before home when critical assets are not confirmed cached.
// States: downloading → retry → continue-anyway → complete (auto-navigate).

const { displayState, retryDownload, continueAnyway } = useAssetDownloadScreen()
const assetStore = useAssetStore()
const { criticalSucceeded, criticalTotal } = storeToRefs(assetStore)

const isRetrying = ref(false)

async function handleRetry(): Promise<void> {
  isRetrying.value = true
  await retryDownload()
  isRetrying.value = false
}
</script>

<template>
  <div class="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-neutral-950 px-8">
    <!-- Ambient background glows -->
    <div class="pointer-events-none absolute inset-0 overflow-hidden">
      <div class="bg-primary/15 absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full blur-3xl animate-pulse" />
      <div
        class="bg-secondary/10 absolute -bottom-12 -left-12 size-56 rounded-full blur-3xl animate-pulse"
        style="animation-delay: 1.2s"
      />
    </div>

    <div class="relative flex w-full max-w-xs flex-col items-center gap-8 text-center">

      <!-- ── Downloading ─────────────────────────── -->
      <template v-if="displayState === 'downloading'">
        <div class="relative size-24">
          <!-- Track ring -->
          <div class="absolute inset-0 rounded-full border-4 border-neutral-800" />
          <!-- Spinning progress ring -->
          <div
            class="border-primary absolute inset-0 animate-spin rounded-full border-4 border-t-transparent border-r-transparent border-b-transparent"
            style="animation-duration: 1.2s"
          />
          <!-- Center icon -->
          <div class="absolute inset-3 flex items-center justify-center rounded-full bg-neutral-900">
            <UIcon name="i-lucide-download" class="text-primary size-6" />
          </div>
        </div>

        <div class="space-y-2">
          <p class="text-lg font-semibold text-white">Preparing FlyLive</p>
          <p class="text-sm text-neutral-400">
            Downloading assets
            <span class="text-neutral-300">{{ criticalSucceeded }}&nbsp;/&nbsp;{{ criticalTotal }}</span>
          </p>
        </div>
      </template>

      <!-- ── Retry ────────────────────────────────── -->
      <template v-else-if="displayState === 'retry'">
        <div class="flex size-24 items-center justify-center rounded-full bg-red-500/10">
          <UIcon name="i-lucide-wifi-off" class="size-10 text-red-400" />
        </div>

        <div class="space-y-2">
          <p class="text-lg font-semibold text-white">Download failed</p>
          <p class="text-sm text-neutral-400">
            Some assets couldn't be downloaded. Check your connection and try again.
          </p>
        </div>

        <UButton
          label="Retry"
          icon="i-lucide-refresh-cw"
          size="lg"
          class="w-full"
          :loading="isRetrying"
          @click="handleRetry"
        />
      </template>

      <!-- ── Continue anyway ───────────────────────── -->
      <template v-else-if="displayState === 'continue-anyway'">
        <div class="flex size-24 items-center justify-center rounded-full bg-yellow-500/10">
          <UIcon name="i-lucide-triangle-alert" class="size-10 text-yellow-400" />
        </div>

        <div class="space-y-2">
          <p class="text-lg font-semibold text-white">Still having trouble</p>
          <p class="text-sm text-neutral-400">
            Some assets failed to download. You may see missing visuals in rooms.
          </p>
        </div>

        <UButton
          label="Continue anyway"
          icon="i-lucide-arrow-right"
          variant="soft"
          size="lg"
          class="w-full"
          @click="continueAnyway"
        />
      </template>

      <!-- ── Complete (brief flash before auto-navigation) ─── -->
      <template v-else-if="displayState === 'complete'">
        <div class="flex size-24 items-center justify-center rounded-full bg-success/10">
          <UIcon name="i-lucide-circle-check" class="text-success size-10" />
        </div>
        <p class="text-lg font-semibold text-white">Ready!</p>
      </template>

    </div>
  </div>
</template>

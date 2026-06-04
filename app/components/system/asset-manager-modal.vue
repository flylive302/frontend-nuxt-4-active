<script setup lang="ts">
// ========================================
// Asset Manager Modal
// ========================================

// ========================================
// Composables / Stores
// ========================================

const { startAssetDownload, retryFailedAssets } = useBootstrapAssets()
const assetStore = useAssetStore()
const bootstrapStore = useBootstrapStore()

// ========================================
// Props & Emits
// ========================================

interface Props {
  /** Whether the modal is visible */
  modelValue: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

// ========================================
// State
// ========================================

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

// ========================================
// Computed
// ========================================

/**
 * Icon based on current download status.
 */
const statusIcon = computed(() => {
  if (assetStore.isDownloading) return 'i-lucide-loader-2'
  if (assetStore.isComplete) return 'i-lucide-check-circle'
  if (assetStore.isPartial) return 'i-lucide-alert-circle'
  return 'i-lucide-download'
})

/**
 * Icon color based on status.
 */
const statusIconColor = computed(() => {
  if (assetStore.isDownloading) return 'text-primary'
  if (assetStore.isComplete) return 'text-success'
  if (assetStore.isPartial) return 'text-warning'
  return 'text-neutral-400'
})

/**
 * Status title text.
 */
const statusTitle = computed(() => {
  if (assetStore.isDownloading) return 'Downloading Assets...'
  if (assetStore.isComplete) return 'All Assets Downloaded'
  if (assetStore.isPartial) return 'Download Partially Complete'
  if (assetStore.phase === 'error') return 'Download Error'
  return 'Asset Status'
})

/**
 * Status description text.
 */
const statusDescription = computed(() => {
  if (assetStore.isDownloading) {
    return `Downloading ${assetStore.completedCount} of ${assetStore.totalCount} assets (${assetStore.downloadPercent}%)`
  }
  if (assetStore.isComplete) {
    return 'All animation assets are cached and ready. No need for re-downloading.'
  }
  if (assetStore.isPartial) {
    const n = assetStore.failedTotal
    return `${n} asset${n === 1 ? '' : 's'} failed to download. Tap below to retry.`
  }
  if (assetStore.phase === 'error') {
    return assetStore.error ?? 'An error occurred during download.'
  }
  if (assetStore.phase === 'idle' && assetStore.totalCount === 0) {
    return 'No assets to download.'
  }
  return 'Tap below to start downloading assets.'
})

/**
 * Whether to show the progress bar.
 */
const showProgress = computed(() => assetStore.isDownloading)

/**
 * Whether to show the start download button.
 */
const showStartButton = computed(() => {
  return assetStore.phase === 'idle' && bootstrapStore.giftCatalog.length > 0
})

/**
 * Whether to show the retry failed assets button.
 */
const showRetryButton = computed(() => assetStore.failedTotal > 0 && !assetStore.isDownloading)

// ========================================
// Actions
// ========================================

function handleClose(): void {
  isOpen.value = false
}

function handleStartDownload(): void {
  startAssetDownload()
}

function handleRetry(): void {
  retryFailedAssets()
}
</script>

<template>
  <UModal v-model:open="isOpen">
    <template #content>
      <div class="rounded-xl bg-neutral-900 p-6">
        <!-- Header -->
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center gap-3">
            <div
              class="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-800"
            >
              <UIcon
                :name="statusIcon"
                :class="['h-6 w-6', statusIconColor, assetStore.isDownloading ? 'animate-spin' : '']"
              />
            </div>
            <div>
              <h3 class="text-lg font-semibold text-white">
                {{ statusTitle }}
              </h3>
              <p class="text-sm text-neutral-400">
                <template v-if="assetStore.failedTotal > 0">
                  {{ assetStore.completedCount }} succeeded / {{ assetStore.failedTotal }} failed / {{ assetStore.totalCount }} total
                </template>
                <template v-else>
                  {{ assetStore.completedCount }} / {{ assetStore.totalCount }} assets
                </template>
              </p>
            </div>
          </div>
          <UButton
            variant="ghost"
            color="neutral"
            icon="i-lucide-x"
            size="sm"
            @click="handleClose"
          />
        </div>

        <!-- Progress Bar -->
        <div v-if="showProgress" class="mb-4">
          <div class="h-2 w-full overflow-hidden rounded-full bg-neutral-800">
            <div
              class="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-300 ease-out"
              :style="{ width: `${assetStore.downloadPercent}%` }"
            />
          </div>
          <p class="mt-2 text-xs text-center text-neutral-500">
            {{ assetStore.downloadPercent }}% complete
          </p>
        </div>

        <!-- Description -->
        <p class="text-sm text-neutral-400 mb-4">
          {{ statusDescription }}
        </p>

        <!-- Actions -->
        <div class="flex flex-col gap-2">
          <UButton
            v-if="showRetryButton"
            block
            color="warning"
            icon="i-lucide-refresh-cw"
            @click="handleRetry"
          >
            Retry failed assets
          </UButton>

          <UButton
            v-if="showStartButton"
            block
            color="primary"
            icon="i-lucide-download"
            @click="handleStartDownload"
          >
            Start Download
          </UButton>

          <UButton
            block
            variant="outline"
            color="neutral"
            @click="handleClose"
          >
            {{ assetStore.isComplete ? 'Done' : 'Close' }}
          </UButton>
        </div>

        <!-- Note -->
        <p class="mt-4 text-xs text-center text-neutral-500">
          Assets are cached for offline use and faster loading.
        </p>
      </div>
    </template>
  </UModal>
</template>

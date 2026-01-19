<script setup lang="ts">
// ========================================
// Asset Manager Modal
// ========================================

// ========================================
// Composables / Stores
// ========================================

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
  if (bootstrapStore.isDownloading) return 'i-lucide-loader-2'
  if (bootstrapStore.isDownloadComplete) return 'i-lucide-check-circle'
  return 'i-lucide-download'
})

/**
 * Icon color based on status.
 */
const statusIconColor = computed(() => {
  if (bootstrapStore.isDownloading) return 'text-primary'
  if (bootstrapStore.isDownloadComplete) return 'text-success'
  return 'text-neutral-400'
})

/**
 * Status title text.
 */
const statusTitle = computed(() => {
  if (bootstrapStore.isDownloading) return 'Downloading Assets...'
  if (bootstrapStore.isDownloadComplete) return 'All Assets Downloaded'
  if (bootstrapStore.assetPhase === 'error') return 'Download Error'
  return 'Asset Status'
})

/**
 * Status description text.
 */
const statusDescription = computed(() => {
  if (bootstrapStore.isDownloading) {
    return `Downloading ${bootstrapStore.cachedAssetCount} of ${bootstrapStore.totalAssetCount} assets (${bootstrapStore.downloadPercent}%)`
  }
  if (bootstrapStore.isDownloadComplete) {
    return 'All animation assets are cached and ready. No need for re-downloading.'
  }
  if (bootstrapStore.assetPhase === 'error') {
    return bootstrapStore.assetError ?? 'An error occurred during download.'
  }
  if (bootstrapStore.assetPhase === 'idle' && bootstrapStore.totalAssetCount === 0) {
    return 'No assets to download.'
  }
  return 'Tap below to start downloading assets.'
})

/**
 * Whether to show the progress bar.
 */
const showProgress = computed(() => bootstrapStore.isDownloading)

/**
 * Whether to show the start download button.
 */
const showStartButton = computed(() => {
  return bootstrapStore.assetPhase === 'idle' && bootstrapStore.giftCatalog.length > 0
})

// ========================================
// Actions
// ========================================

function handleClose(): void {
  isOpen.value = false
}

function handleStartDownload(): void {
  bootstrapStore.startAssetDownload()
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
                :class="['h-6 w-6', statusIconColor, bootstrapStore.isDownloading ? 'animate-spin' : '']" 
              />
            </div>
            <div>
              <h3 class="text-lg font-semibold text-white">
                {{ statusTitle }}
              </h3>
              <p class="text-sm text-neutral-400">
                {{ bootstrapStore.cachedAssetCount }} / {{ bootstrapStore.totalAssetCount }} assets
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
              :style="{ width: `${bootstrapStore.downloadPercent}%` }"
            />
          </div>
          <p class="mt-2 text-xs text-center text-neutral-500">
            {{ bootstrapStore.downloadPercent }}% complete
          </p>
        </div>

        <!-- Description -->
        <p class="text-sm text-neutral-400 mb-4">
          {{ statusDescription }}
        </p>

        <!-- Actions -->
        <div class="flex flex-col gap-2">
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
            {{ bootstrapStore.isDownloadComplete ? 'Done' : 'Close' }}
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

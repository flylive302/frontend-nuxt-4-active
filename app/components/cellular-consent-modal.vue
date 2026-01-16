<script setup lang="ts">
// ========================================
// Cellular Consent Modal
// ========================================

const bootstrapStore = useBootstrapStore()
const { trackCellularConsentGiven, trackCellularConsentDenied } = useTelemetry()

// ========================================
// Props
// ========================================

interface Props {
  /** Estimated download size in bytes */
  sizeBytes: number
  /** Whether the modal is visible */
  modelValue: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'consent': [granted: boolean]
}>()

// ========================================
// Computed
// ========================================

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

/**
 * Format bytes to human-readable size.
 */
const formattedSize = computed(() => {
  const bytes = props.sizeBytes
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
})

// ========================================
// Actions
// ========================================

function handleDownloadNow(): void {
  bootstrapStore.setCellularConsent(true)
  trackCellularConsentGiven()
  emit('consent', true)
  isOpen.value = false
}

function handleWaitForWifi(): void {
  bootstrapStore.setCellularConsent(false)
  trackCellularConsentDenied()
  emit('consent', false)
  isOpen.value = false
}
</script>

<template>
  <UModal v-model:open="isOpen">
    <template #content>
      <div class="rounded-xl bg-neutral-900 p-6 text-center">
        <!-- Icon -->
        <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-warning/10">
          <UIcon name="i-heroicons-signal" class="h-8 w-8 text-warning" />
        </div>

        <!-- Title -->
        <h3 class="mb-2 text-lg font-semibold text-white">
          Download on Mobile Data?
        </h3>

        <!-- Description -->
        <p class="mb-6 text-sm text-neutral-400">
          FlyLive needs to download
          <span class="font-medium text-white">{{ formattedSize }}</span>
          of animation assets. This will use your mobile data.
        </p>

        <!-- Actions -->
        <div class="flex flex-col gap-3">
          <UButton
            block
            color="primary"
            @click="handleDownloadNow"
          >
            Download Now
          </UButton>

          <UButton
            block
            variant="outline"
            color="neutral"
            @click="handleWaitForWifi"
          >
            Wait for WiFi
          </UButton>
        </div>

        <!-- Note -->
        <p class="mt-4 text-xs text-neutral-500">
          You can change this later in Settings
        </p>
      </div>
    </template>
  </UModal>
</template>

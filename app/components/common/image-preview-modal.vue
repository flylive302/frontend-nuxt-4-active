<script setup lang="ts">
// ========================================
// Image Preview Modal (shared)
// ========================================
// Fullscreen dismissable preview for a single image (avatar / cover).
// Tapping anywhere on the backdrop or the close button dismisses it.
// When `editable` is set (profile owner only), a change button opens the
// same crop flow used across the app (LazyImageUploadModal) and emits the
// cropped File for the parent to upload.

import type { Component } from 'vue'
import { defineAsyncComponent } from 'vue'
import { buildCroppedFile, isValidMimeType } from '~/utils/image-file'

const CircleStencil = defineAsyncComponent(async () =>
  (await import('vue-advanced-cropper')).CircleStencil as unknown as Component
)
const RectangleStencil = defineAsyncComponent(async () =>
  (await import('vue-advanced-cropper')).RectangleStencil as unknown as Component
)

// ========================================
// Constants
// ========================================

const OUTPUT_FORMAT = 'image/jpeg' as const
const OUTPUT_QUALITY = 0.9 as const
const ACCEPTED_TYPES = 'image/*' as const

interface VariantConfig {
  aspectRatio: number
  maxSizeMb: number
  buttonLabel: string
  circleStencil: boolean
}

const VARIANT_CONFIG: Record<'avatar' | 'cover', VariantConfig> = {
  avatar: { aspectRatio: 1, maxSizeMb: 3, buttonLabel: 'Change Profile Picture', circleStencil: true },
  cover: { aspectRatio: 45 / 32, maxSizeMb: 5, buttonLabel: 'Change Cover Image', circleStencil: false },
}

// ========================================
// Props & Emits
// ========================================

defineOptions({ name: 'ImagePreviewModal' })

const props = withDefaults(defineProps<{
  src: string | null
  open: boolean
  alt?: string
  /** Which profile image this previews — drives crop dimensions & button label */
  variant?: 'avatar' | 'cover'
  /** Show the owner-only change button */
  editable?: boolean
  /** Upload in flight (disables the change button, shows progress) */
  uploading?: boolean
  /** Upload progress 0-100, or -1 when idle */
  progress?: number
}>(), {
  alt: undefined,
  variant: 'avatar',
  editable: false,
  uploading: false,
  progress: -1,
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'file-selected', file: File): void
}>()

// ========================================
// State
// ========================================

const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const isCropModalOpen = ref(false)
const localError = ref<string | null>(null)

const config = computed(() => VARIANT_CONFIG[props.variant])
const stencilComponent = computed(() => (config.value.circleStencil ? CircleStencil : RectangleStencil))
const showProgress = computed(() => props.progress >= 0 && props.progress <= 100)

// ========================================
// Handlers
// ========================================

function handleClose(): void {
  emit('close')
}

function triggerFileInput(): void {
  localError.value = null
  fileInput.value?.click()
}

function handleFileChange(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  // Reset input value to allow selecting the same file again
  input.value = ''
  if (!file) return

  // GATE — size & type before opening the cropper
  const maxBytes = config.value.maxSizeMb * 1024 * 1024
  if (file.size > maxBytes) {
    localError.value = `File size must be less than ${config.value.maxSizeMb}MB`
    return
  }
  if (!isValidMimeType(file.type, ACCEPTED_TYPES)) {
    localError.value = 'Invalid file type'
    return
  }

  selectedFile.value = file
  isCropModalOpen.value = true
}

function handleCropConfirm(blob: Blob): void {
  if (!selectedFile.value) return
  emit('file-selected', buildCroppedFile(blob, selectedFile.value.name, OUTPUT_FORMAT))
  selectedFile.value = null
}

function handleCropCancel(): void {
  selectedFile.value = null
}
</script>

<template>
  <UModal
    :open="open"
    fullscreen
    :ui="{
      overlay: 'bg-black/80 backdrop-blur-sm',
      content: 'bg-transparent shadow-none ring-0 divide-none',
    }"
    @update:open="(val) => !val && handleClose()"
  >
    <template #content>
      <div
        class="relative flex items-center justify-center w-full h-full p-4"
        @click.self="handleClose"
      >
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="lg"
          class="absolute top-4 right-4 z-10 text-white"
          @click="handleClose"
        />

        <img
          v-if="src"
          :src="src"
          :alt="alt ?? 'Image preview'"
          class="max-w-full max-h-full object-contain rounded-lg"
          @click="handleClose"
        >

        <!-- Owner-only change action -->
        <div
          v-if="editable"
          class="absolute bottom-8 inset-x-0 z-10 flex flex-col items-center gap-2"
        >
          <p v-if="localError" class="text-sm text-error" role="alert">
            {{ localError }}
          </p>
          <UButton
            icon="i-lucide-camera"
            size="lg"
            :loading="uploading"
            :disabled="uploading"
            @click="triggerFileInput"
          >
            <template v-if="uploading && showProgress">
              Uploading… {{ progress }}%
            </template>
            <template v-else>
              {{ config.buttonLabel }}
            </template>
          </UButton>

          <input
            ref="fileInput"
            type="file"
            class="hidden"
            :accept="ACCEPTED_TYPES"
            :aria-label="config.buttonLabel"
            @change="handleFileChange"
          >
        </div>
      </div>

      <!-- Crop Modal — Lazy so the cropper chunk loads only when used -->
      <LazyImageUploadModal
        v-if="isCropModalOpen"
        v-model="isCropModalOpen"
        :image-file="selectedFile"
        :stencil-component="stencilComponent"
        :aspect-ratio="config.aspectRatio"
        :output-format="OUTPUT_FORMAT"
        :output-quality="OUTPUT_QUALITY"
        @confirm="handleCropConfirm"
        @cancel="handleCropCancel"
      />
    </template>
  </UModal>
</template>

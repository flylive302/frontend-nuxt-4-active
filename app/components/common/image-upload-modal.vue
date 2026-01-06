<script setup lang="ts">
// ========================================
// Imports & Types
// ========================================
import type { Component } from 'vue'
import { Cropper, CircleStencil } from 'vue-advanced-cropper'
import 'vue-advanced-cropper/dist/style.css'

// ========================================
// Constants
// ========================================
const ZOOM_IN_FACTOR = 1.2
const ZOOM_OUT_FACTOR = 0.8
const ROTATE_ANGLE = 90

type OutputFormat = 'image/jpeg' | 'image/png' | 'image/webp'

// ========================================
// Types
// ========================================
interface Props {
  modelValue: boolean
  imageFile: File | null
  /** Custom stencil component (defaults to CircleStencil) */
  stencilComponent?: Component
  /** Output image format */
  outputFormat?: OutputFormat
  /** Output quality (0-1) for JPEG/WebP */
  outputQuality?: number
  /** Aspect ratio for the stencil (default: 1 for square) */
  aspectRatio?: number
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm', blob: Blob): void
  (e: 'cancel'): void
}

// ========================================
// Component State
// ========================================
const props = withDefaults(defineProps<Props>(), {
  stencilComponent: () => CircleStencil,
  outputFormat: 'image/jpeg',
  outputQuality: 0.9,
  aspectRatio: 1,
})

const emit = defineEmits<Emits>()

const cropperRef = ref<InstanceType<typeof Cropper> | null>(null)
const imageSrc = ref<string | null>(null)
const isProcessing = ref(false)

// ========================================
// Event Handlers
// ========================================
async function onCrop() {
  if (!cropperRef.value || isProcessing.value) return
  
  isProcessing.value = true
  
  try {
    const { canvas } = cropperRef.value.getResult()
    if (!canvas) {
      isProcessing.value = false
      return
    }

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, props.outputFormat, props.outputQuality)
    })

    if (blob) {
      emit('confirm', blob)
      emit('update:modelValue', false)
    }
  } finally {
    isProcessing.value = false
  }
}

function closeModal() {
  if (isProcessing.value) return
  emit('update:modelValue', false)
  emit('cancel')
}

function rotate(angle: number) {
  cropperRef.value?.rotate(angle)
}

function zoomIn() {
  cropperRef.value?.zoom(ZOOM_IN_FACTOR)
}

function zoomOut() {
  cropperRef.value?.zoom(ZOOM_OUT_FACTOR)
}

function reset() {
  cropperRef.value?.reset()
}

// ========================================
// Watchers & Lifecycle
// ========================================
watch(
  () => props.imageFile,
  (newFile) => {
    if (newFile) {
      if (imageSrc.value) {
        URL.revokeObjectURL(imageSrc.value)
      }
      imageSrc.value = URL.createObjectURL(newFile)
    } else {
      if (imageSrc.value) {
        URL.revokeObjectURL(imageSrc.value)
      }
      imageSrc.value = null
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (imageSrc.value) {
    URL.revokeObjectURL(imageSrc.value)
  }
})
</script>

<template>
  <USlideover 
    :open="modelValue" 
    side="bottom"
    title="Crop Image"
    description="Adjust your image by zooming, rotating, and cropping before saving"
    @update:open="emit('update:modelValue', $event)"
  >
    <template #content>
      <UCard class="flex flex-col flex-1">
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">
              Crop Photo
            </h3>
            <p class="text-xs text-muted">
              Scroll to zoom, drag to move
            </p>
            <UButton
              variant="soft"
              color="error"
              icon="i-lucide-x" 
              class="-my-1" 
              type="button" 
              :disabled="isProcessing"
              aria-label="Close"
              @click.prevent="closeModal" 
            />
          </div>
        </template>

        <!-- Cropper Area -->
        <ClientOnly>
          <Cropper
              v-if="imageSrc"
              ref="cropperRef"
              class="h-[60vh] border w-auto rounded-lg overflow-hidden inset-shadow-sm"
              :src="imageSrc"
              :stencil-component="props.stencilComponent"
              :stencil-props="{
                aspectRatio: props.aspectRatio,
                previewClass: 'border'
              }"
          />
          <div v-else class="flex flex-col items-center gap-2 text-gray-400">
            <UIcon name="i-lucide-image" class="h-8 w-8" />
            <span>Loading image...</span>
          </div>
        </ClientOnly>

        <!-- Controls -->
        <div class="flex items-center justify-center gap-4 mt-4">
          <UTooltip text="Zoom Out">
            <UButton
                icon="i-lucide-minus"
                color="neutral"
                variant="subtle"
                type="button"
                :disabled="isProcessing"
                aria-label="Zoom out"
                @click.prevent="zoomOut"
            />
          </UTooltip>

          <UTooltip text="Rotate Left">
            <UButton
                icon="i-lucide-rotate-ccw"
                color="neutral"
                variant="subtle"
                type="button"
                :disabled="isProcessing"
                aria-label="Rotate left"
                @click.prevent="rotate(-ROTATE_ANGLE)"
            />
          </UTooltip>

          <UTooltip text="Reset">
            <UButton
                icon="i-lucide-refresh-cw"
                color="neutral"
                variant="subtle"
                type="button"
                :disabled="isProcessing"
                aria-label="Reset"
                @click.prevent="reset"
            />
          </UTooltip>

          <UTooltip text="Rotate Right">
            <UButton
                icon="i-lucide-rotate-cw"
                color="neutral"
                variant="subtle"
                type="button"
                :disabled="isProcessing"
                aria-label="Rotate right"
                @click.prevent="rotate(ROTATE_ANGLE)"
            />
          </UTooltip>

          <UTooltip text="Zoom In">
            <UButton
                icon="i-lucide-plus"
                color="neutral"
                variant="subtle"
                type="button"
                :disabled="isProcessing"
                aria-label="Zoom in"
                @click.prevent="zoomIn"
            />
          </UTooltip>
        </div>

        <template #footer>
          <div class="flex justify-between">
            <UButton
                color="neutral"
                variant="soft"
                type="button"
                :disabled="isProcessing"
                @click.prevent="closeModal"
            >
              Cancel
            </UButton>
            <UButton
                color="primary"
                icon="i-lucide-save"
                type="button"
                class="font-bold"
                :loading="isProcessing"
                @click.prevent="onCrop"
            >
              Save Photo
            </UButton>
          </div>
        </template>
      </UCard>
    </template>
  </USlideover>
</template>


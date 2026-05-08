<script setup lang="ts">
// ========================================
// Imports & Types
// ========================================
import type { Component } from 'vue'
import { defineAsyncComponent } from 'vue'

// Async-load stencils so the vue-advanced-cropper chunk doesn't get pulled
// into bundles that import this component (e.g., auth routes via auto-imports).
const CircleStencil = defineAsyncComponent(async () =>
  (await import('vue-advanced-cropper')).CircleStencil as unknown as Component
)
const RectangleStencil = defineAsyncComponent(async () =>
  (await import('vue-advanced-cropper')).RectangleStencil as unknown as Component
)

// ========================================
// Constants
// ========================================
const SIZE_MAP = {
  sm: { container: 'h-16 w-16', icon: 'h-6 w-6', hoverIcon: 'h-4 w-4', loader: 'h-4 w-4' },
  md: { container: 'h-24 w-24', icon: 'h-8 w-8', hoverIcon: 'h-6 w-6', loader: 'h-6 w-6' },
  lg: { container: 'h-32 w-32', icon: 'h-12 w-12', hoverIcon: 'h-8 w-8', loader: 'h-8 w-8' },
  xl: { container: 'h-40 w-40', icon: 'h-16 w-16', hoverIcon: 'h-10 w-10', loader: 'h-10 w-10' },
} as const

const SHAPE_MAP = {
  circle: 'rounded-full',
  square: 'rounded-none',
  rounded: 'rounded-lg',
} as const

type Size = keyof typeof SIZE_MAP
type Shape = keyof typeof SHAPE_MAP

// ========================================
// Types
// ========================================
interface Props {
  /** Allowed file MIME types (e.g., 'image/*', 'image/png,image/jpeg') */
  accept?: string
  /** Aspect ratio for cropper (default: 1 for square) */
  aspectRatio?: number
  /** Custom container class (overrides size-based dimensions) */
  // eslint-disable-next-line vue/require-default-prop
  containerClass?: string
  /** Enable image cropping modal */
  crop?: boolean
  /** Current image URL (normalized string, not object) */
  // eslint-disable-next-line vue/require-default-prop
  currentImage?: string | null
  /** External error message to display */
  // eslint-disable-next-line vue/require-default-prop
  error?: string
  /** Icon displayed when no image is present */
  icon?: string
  /** Accessible label for the upload area */
  label?: string
  /** Show loading spinner overlay */
  loading?: boolean
  /** Maximum file size in MB */
  maxSize?: number
  /** Output format for cropped image */
  outputFormat?: 'image/jpeg' | 'image/png' | 'image/webp'
  /** Output quality for cropped image (0-1, JPEG/WebP only) */
  outputQuality?: number
  /** Upload progress percentage (0-100). When set, shows a progress bar instead of spinner. */
  progress?: number
  /** Shape variant: 'circle' | 'square' | 'rounded' */
  shape?: Shape
  /** Size variant: 'sm' | 'md' | 'lg' | 'xl' */
  size?: Size
  /** Custom stencil component for cropper (only used when crop=true) */
  // eslint-disable-next-line vue/require-default-prop
  stencilComponent?: Component
}

interface Emits {
  (e: 'file-selected', file: File): void
}

// ========================================
// Component State
// ========================================
const props = withDefaults(defineProps<Props>(), {
  accept: 'image/*',
  maxSize: 3,
  label: 'Upload image',
  icon: 'i-lucide-upload',
  crop: false,
  loading: false,
  size: 'md',
  shape: 'circle',
  aspectRatio: 0.8,
  outputFormat: 'image/jpeg',
  outputQuality: 0.9,
  progress: -1,
})

const emit = defineEmits<Emits>()

const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const isCropModalOpen = ref(false)
const localError = ref<string | null>(null)

// ========================================
// Computed Styles & Logic
// ========================================
const resolvedContainerClass = computed(() =>
  props.containerClass ?? SIZE_MAP[props.size].container
)
const shapeClass = computed(() => SHAPE_MAP[props.shape])
const isCustomSized = computed(() => !!props.containerClass)
const showProgress = computed(() => props.progress >= 0 && props.progress <= 100)

const realStencilComponent = computed(() => {
  if (props.stencilComponent) return props.stencilComponent
  return props.shape === 'circle' ? CircleStencil : RectangleStencil
})

// ========================================
// Event Handlers
// ========================================
function triggerFileInput() {
  localError.value = null
  fileInput.value?.click()
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    triggerFileInput()
  }
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files?.[0]) {
    validateAndProcessFile(input.files[0])
  }
  // Reset input value to allow selecting the same file again
  input.value = ''
}

function validateAndProcessFile(file: File) {
  // Validate Size
  const maxBytes = props.maxSize * 1024 * 1024
  if (file.size > maxBytes) {
    localError.value = `File size must be less than ${props.maxSize}MB`
    return
  }

  // Validate MIME Type
  if (!isValidMimeType(file.type, props.accept)) {
    localError.value = 'Invalid file type'
    return
  }

  selectedFile.value = file

  if (props.crop && file.type.startsWith('image/')) {
    isCropModalOpen.value = true
  } else {
    emit('file-selected', file)
  }
}

/**
 * Validates a file's MIME type against an accept string.
 * Supports wildcards like 'image/*' and comma-separated values like 'image/png,image/jpeg'
 */
function isValidMimeType(fileType: string, accept: string): boolean {
  const acceptedTypes = accept.split(',').map(t => t.trim())
  
  return acceptedTypes.some(acceptType => {
    if (acceptType === '*/*') return true
    if (acceptType.endsWith('/*')) {
      // Wildcard match: 'image/*' should match 'image/png'
      const category = acceptType.replace('/*', '')
      return fileType.startsWith(`${category}/`)
    }
    // Exact match
    return fileType === acceptType
  })
}

/**
 * Maps MIME types to their corresponding file extensions
 */
function getExtensionFromMimeType(mimeType: string): string | null {
  const mimeToExtension: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/bmp': '.bmp',
    'image/svg+xml': '.svg',
    'image/tiff': '.tiff',
    'image/x-icon': '.ico',
  }
  return mimeToExtension[mimeType.toLowerCase()] || null
}

/**
 * Sanitizes a filename by removing or replacing invalid characters
 */
function sanitizeFilename(filename: string): string {
  // Remove invalid characters for filenames (Windows/Unix compatible)
  // eslint-disable-next-line no-control-regex
  return filename.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim()
}

/**
 * Updates a filename's extension based on the new MIME type
 */
function updateFilenameExtension(originalName: string, newExtension: string): string {
  // Remove existing extension if present
  const lastDotIndex = originalName.lastIndexOf('.')
  const nameWithoutExt = lastDotIndex > 0 
    ? originalName.substring(0, lastDotIndex)
    : originalName
  
  // Append new extension
  return sanitizeFilename(nameWithoutExt) + newExtension
}

function handleCropConfirm(blob: Blob) {
  if (selectedFile.value) {
    // Derive the correct extension from the output format
    const extension = getExtensionFromMimeType(props.outputFormat)
    
    // Update filename with correct extension, or fall back to original if MIME is unknown
    const updatedFilename = extension
      ? updateFilenameExtension(selectedFile.value.name, extension)
      : selectedFile.value.name
    
    const croppedFile = new File([blob], updatedFilename, {
      type: props.outputFormat,
      lastModified: Date.now(),
    })
    emit('file-selected', croppedFile)
  }
}

function handleCropCancel() {
  selectedFile.value = null
}
</script>

<template>
  <div>
    <div class="flex flex-col items-center gap-2">
      <!-- Preview / Trigger -->
      <div 
        role="button" tabindex="0"
        class="relative group cursor-pointer"
        :class="[shapeClass, { 'w-full': isCustomSized }]" :aria-label="label"
        @click="triggerFileInput" @keydown="handleKeyDown"
      >
        <div class="relative overflow-hidden ring-2 ring-primary inset-shadow-sm" :class="[resolvedContainerClass, shapeClass]">
          <NuxtImg
              v-if="currentImage"
              :src="currentImage"
              class="h-full w-full object-cover"
              :alt="label"
          />
          <div
              v-else
              class="flex h-full w-full items-center justify-center bg-elevated text-gray-400"
          >
            <UIcon :name="icon" :class="SIZE_MAP[size].icon" />
          </div>
          <!-- Hover Overlay -->
          <div class="absolute inset-0 flex items-center justify-center bg-elevated opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <UIcon name="i-lucide-camera" class="text-white" :class="SIZE_MAP[size].hoverIcon" />
          </div>
        </div>
        
        <!-- Loading / Progress State -->
        <div 
          v-if="loading" 
          class="absolute inset-0 flex flex-col items-center justify-center bg-elevated gap-2"
          :class="shapeClass"
        >
          <template v-if="showProgress">
            <span class="text-sm font-semibold text-primary">{{ progress }}%</span>
            <div class="w-3/4 h-1.5 rounded-full bg-neutral-800 overflow-hidden">
              <div
                class="h-full bg-primary transition-all duration-200 ease-out rounded-full"
                :style="{ width: `${progress}%` }"
              />
            </div>
          </template>
          <UIcon v-else name="i-lucide-loader-2" class="animate-spin text-primary" :class="SIZE_MAP[size].loader" />
        </div>
      </div>

      <!-- Error Message -->
      <p v-if="localError || error" class="text-sm text-error" role="alert">
        {{ localError || error }}
      </p>

      <!-- Hidden Input -->
      <input
        ref="fileInput"
        type="file"
        class="hidden"
        :accept="accept"
        :aria-label="label"
        @change="handleFileChange"
      >
    </div>

    <!-- Crop Modal — Lazy-prefixed so the cropper chunk only loads when the user
         actually opens the cropper (not on initial page render). -->
    <LazyImageUploadModal
      v-if="crop && isCropModalOpen"
      v-model="isCropModalOpen"
      :image-file="selectedFile"
      :stencil-component="realStencilComponent"
      :aspect-ratio="aspectRatio"
      :output-format="outputFormat"
      :output-quality="outputQuality"
      @confirm="handleCropConfirm"
      @cancel="handleCropCancel"
    />
  </div>
</template>


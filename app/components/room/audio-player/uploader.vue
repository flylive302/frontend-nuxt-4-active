<script setup lang="ts">
/**
 * AudioUploader — File picker drawer for selecting audio files.
 *
 * Uses a UDrawer (Nuxt UI) to present a file input with drag-and-drop.
 * Only accepts audio file types. No server upload — file stays local.
 */

// ========================================
// Props & Emits
// ========================================

const open = defineModel<boolean>('open', { default: false });

const props = defineProps<{
  isLoading?: boolean;
}>();

const emit = defineEmits<{
  fileSelected: [file: File];
}>();

// ========================================
// State
// ========================================

const isDragging = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const error = ref<string | null>(null);

// ========================================
// Constants
// ========================================

const ALLOWED_TYPES = [
  'audio/mpeg',   // .mp3
  'audio/mp4',    // .m4a
  'audio/ogg',    // .ogg
  'audio/webm',   // .webm
  'audio/wav',    // .wav
  'audio/aac',    // .aac
  'audio/flac',   // .flac
];

const MAX_SIZE_MB = 50;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

// ========================================
// Handlers
// ========================================

function validateFile(file: File): boolean {
  error.value = null;

  if (!ALLOWED_TYPES.includes(file.type) && !file.name.match(/\.(mp3|m4a|ogg|webm|wav|aac|flac)$/i)) {
    error.value = 'Unsupported file type. Please select an audio file.';
    return false;
  }

  if (file.size > MAX_SIZE_BYTES) {
    error.value = `File too large. Maximum size is ${MAX_SIZE_MB}MB.`;
    return false;
  }

  return true;
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (!validateFile(file)) return;

  emit('fileSelected', file);
}

function handleDrop(event: DragEvent) {
  isDragging.value = false;
  event.preventDefault();

  const file = event.dataTransfer?.files?.[0];
  if (!file) return;
  if (!validateFile(file)) return;

  emit('fileSelected', file);
}

function handleDragOver(event: DragEvent) {
  event.preventDefault();
  isDragging.value = true;
}

function handleDragLeave() {
  isDragging.value = false;
}

function openFilePicker() {
  fileInput.value?.click();
}
</script>

<template>
  <UDrawer
    v-model:open="open"
    title="Play Music"
    description="Select an audio file from your device to play in this room."
    style="--ui-primary: var(--room-theme, var(--color-primary)); --ui-color-primary-500: var(--room-theme, var(--color-primary-500));"
  >
    <template #content>
      <div class="px-4 pb-6">
        <!-- Drop Zone -->
        <div
          class="border-2 border-dashed rounded-xl p-8 text-center transition-colors"
          :class="[
            isDragging ? 'border-primary bg-primary/10' : 'border-neutral-600 bg-neutral-800/50',
            props.isLoading ? 'opacity-50 pointer-events-none' : 'cursor-pointer'
          ]"
          @click="openFilePicker"
          @drop="handleDrop"
          @dragover="handleDragOver"
          @dragleave="handleDragLeave"
        >
          <UIcon
            :name="props.isLoading ? 'i-lucide-loader-2' : 'i-lucide-music'"
            class="text-4xl mx-auto mb-3 text-primary"
            :class="{ 'animate-spin': props.isLoading }"
          />

          <p v-if="props.isLoading" class="text-sm text-neutral-400">
            Loading audio...
          </p>
          <p v-else class="text-sm text-neutral-300">
            Tap to select or drag & drop an audio file
          </p>
          <p class="text-xs text-neutral-500 mt-1">
            MP3, M4A, OGG, WAV, FLAC • Max {{ MAX_SIZE_MB }}MB
          </p>
        </div>

        <!-- Error Message -->
        <p v-if="error" class="text-xs text-red-400 mt-2 text-center">
          {{ error }}
        </p>

        <!-- Hidden File Input -->
        <input
          ref="fileInput"
          type="file"
          accept="audio/*"
          class="hidden"
          @change="handleFileChange"
        />
      </div>
    </template>
  </UDrawer>
</template>

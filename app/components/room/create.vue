<script setup lang="ts">
// ========================================
// Imports
// ========================================

import { z } from 'zod'
import { useRoom } from '~/composables/room/useRoom'
import type { FormError, Form } from '@nuxt/ui'


// ========================================
// Emits
// ========================================

const emit = defineEmits<{
  (e: 'success'): void
}>()

// ========================================
// Dependencies
// ========================================

const { createRoom } = useRoom()
const { createUploadState } = useImageUpload()
const { normalizeError } = useApi()
const toast = useToast()
const authStore = useAuthStore()

// ========================================
// Constants & Schema
// ========================================

const ROOM_SCHEMA = z.object({
  name: z.string().min(3, 'Room name must be at least 3 characters'),
  country: z.string().length(2, 'Country code must be 2 characters'),
  logo: z.instanceof(File, { message: 'Logo is required' }),
})

type RoomSchema = z.infer<typeof ROOM_SCHEMA>

// ========================================
// State
// ========================================

// Form State
const formRef = ref<Form<RoomSchema> | null>(null)
const state = reactive<Partial<RoomSchema>>({
  name: '',
  country: authStore.user?.country || undefined, // Fallback to undefined if null/empty
  logo: undefined,
})

// UI State
const isProcessing = ref(false)
const logoPreview = ref<string | null>(null)

// Upload State
const logoUpload = createUploadState()
const isUploading = computed(() => logoUpload.state.value.status === 'uploading')

// ========================================
// Event Handlers
// ========================================

/**
 * Handle validation errors from the form.
 */
function onError(event: { errors?: FormError[] }) {
  const errors = event.errors?.map((e: FormError) => e.message).join(', ')
  if (errors) {
    toast.add({
      title: 'Validation Error',
      description: errors,
      color: 'error'
    })
  }
}

/**
 * Handle file selection from the uploader.
 */
function handleFileSelected(file: File) {
  state.logo = file
  
  // Create object URL for preview
  if (logoPreview.value) URL.revokeObjectURL(logoPreview.value)
  logoPreview.value = URL.createObjectURL(file)
}

/**
 * Handle form submission.
 */
async function onSubmit() {
  formRef.value?.clear()
  isProcessing.value = true

  try {
    // 1. Validate Prerequisites
    if (!state.logo) throw new Error('Logo is required')
    if (!state.country) throw new Error('Country is required')

    // 2. Upload Logo
    const result = await logoUpload.upload(state.logo, 'rooms')

    if (!result || !result.url) {
      throw new Error('Failed to upload logo')
    }

    const logoUrl = result.url
    const logoFileId = result.fileId

    // 3. Create Room
    await createRoom({
      name: state.name!,
      country: state.country!,
      type: 'public',
      logo_url: logoUrl,
      logo_file_id: logoFileId,
    })

    // 4. Success
    emit('success')
    
  } catch (error: unknown) {
    const err = normalizeError(error)
    
    if (err.status === 422 && err.fieldErrors) {
      // Map API validation errors to form fields
      const errors: FormError[] = Object.entries(err.fieldErrors).map(([path, messages]) => ({
        path,
        message: messages[0] || 'Invalid value'
      }))
      formRef.value?.setErrors(errors)
    } else {
      toast.add({
        title: 'Room Creation Failed',
        description: err.message || 'An unexpected error occurred',
        color: 'error'
      })
    }
  } finally {
    isProcessing.value = false
  }
}

// ========================================
// Lifecycle
// ========================================

onBeforeUnmount(() => {
  if (logoPreview.value) URL.revokeObjectURL(logoPreview.value)
})

</script>

<template>
  <UForm
    ref="formRef"
    :schema="ROOM_SCHEMA"
    :state="state"
    class="space-y-6"
    @submit="onSubmit"
    @error="onError"
  >
    <!-- Logo Upload Section -->
    <div class="flex flex-col items-center gap-4">
      <UFormField name="logo">
        <FileUpload
          :current-image="logoPreview"
          :loading="isUploading"
          crop
          :aspect-ratio="1"
          shape="rounded"
          label="Room Logo"
          @file-selected="handleFileSelected"
        />
      </UFormField>
      
      <div v-if="isUploading" class="w-full max-w-xs space-y-2">
         <p class="text-xs text-center text-muted">Uploading logo...</p>
         <UProgress :value="logoUpload.state.value.progress" size="xs" color="primary" />
      </div>

       <p class="text-sm text-muted text-center max-w-xs">
        Upload a strict 1:1 circular logo for your room. This will be visible to all users.
      </p>
    </div>

    <!-- Room Details -->
    <UFormField label="Room Name" name="name" required>
      <UInput
        v-model="state.name"
        placeholder="e.g. Chill Vibes Lounge"
        icon="i-lucide-monitor-play"
        size="xl"
        class="w-full"
      />
    </UFormField>
    
    <!-- Country Selection (Only if missing) -->
    <UFormField v-if="!authStore.user?.country" label="Country" name="country" required>
        <USelect
            v-model="state.country"
            :items="['us', 'uk', 'ca', 'de', 'fr', 'in', 'cn', 'jp', 'br', 'sa', 'ae', 'kw', 'qa', 'bh', 'om', 'lb', 'pk']" 
            placeholder="Select Country"
            size="xl"
            class="w-full"
        />
    </UFormField>

    <!-- Submit Button -->
    <div class="pb-7">
      <UButton
        type="submit"
        size="xl"
        block
        :loading="isProcessing"
        :disabled="isProcessing"
        icon="i-lucide-plus"
      >
        {{ isProcessing ? 'Creating Room...' : 'Create Room' }}
      </UButton>
    </div>

  </UForm>
</template>

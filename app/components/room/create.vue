<script setup lang="ts">
// ========================================
// Imports & Types
// ========================================

import { z } from 'zod'
import type { FormError, Form } from '@nuxt/ui'
import FileUpload from '~/components/common/file-upload.vue'
import { useRoom } from '~/composables/useRoom'

// ========================================
// Component State
// ========================================

const authStore = useAuthStore()
const { normalizeError } = useApi()
const { createUploadState } = useImageUpload()
const toast = useToast()

// ========================================
// Schema
// ========================================

const schema = z.object({
  name: z.string().min(3, 'Room name must be at least 3 characters'),
  country: z.string().length(2, 'Country code must be 2 characters'),
  logo: z.instanceof(File, { message: 'Logo is required' }).optional()
})

type Schema = z.infer<typeof schema>

const formRef = ref<Form<Schema> | null>(null)

const state = reactive<Schema>({
  name: '',
  country: '',
  logo: undefined
})

state.country = authStore.user?.phone_country ?? ''

const fileInputError = ref('')
const logoPreview = ref<string | null>(null)
const isSubmitting = ref(false)
const currentStep = ref<'idle' | 'uploading' | 'submitting'>('idle')

// ========================================
// Upload State
// ========================================

const logoUpload = createUploadState()

const isUploading = computed(() => logoUpload.state.value.status === 'uploading')

// ========================================
// Event Handlers
// ========================================

function onFileSelected(file: File) {
  state.logo = file
  fileInputError.value = ''

  if (logoPreview.value) URL.revokeObjectURL(logoPreview.value)
  logoPreview.value = URL.createObjectURL(file)
}

onBeforeUnmount(() => {
  if (logoPreview.value) URL.revokeObjectURL(logoPreview.value)
})

async function onSubmit() {
  if (!state.country) {
    toast.add({ title: 'Profile Error', description: 'Country code is missing in your profile.', color: 'error' })
    return
  }

  isSubmitting.value = true
  formRef.value?.clear()
  currentStep.value = 'idle'

  try {
    let logoUrl: string | undefined
    let logoFileId: string | undefined

    // Step 1: Upload logo to ImageKit if provided
    if (state.logo) {
      currentStep.value = 'uploading'
      const result = await logoUpload.upload(state.logo, 'rooms')

      if (!result) {
        toast.add({ title: 'Upload Failed', description: 'Failed to upload room logo', color: 'error' })
        return
      }

      logoUrl = result.url
      logoFileId = result.fileId
    }

    // Step 2: Create room with pre-uploaded logo URL
    currentStep.value = 'submitting'
    await useRoom().createRoom({
      name: state.name,
      country: state.country,
      type: 'public',
      logo_url: logoUrl,
      logo_file_id: logoFileId,
    })
  } catch (e: unknown) {
    const normalizedError = normalizeError(e)

    // Handle validation errors (422) - display on form fields
    if (normalizedError.status === 422 && normalizedError.fieldErrors) {
      const formErrors: FormError[] = Object.entries(normalizedError.fieldErrors).map(
        ([path, messages]) => ({
          path,
          id: path,
          message: messages?.[0] ?? 'Invalid value',
        })
      )
      formRef.value?.setErrors(formErrors)
    }

    // Show toast for non-validation errors
    if (normalizedError.status !== 422) {
      toast.add({ title: 'Error', description: normalizedError.message, color: 'error' })
    }
  } finally {
    isSubmitting.value = false
    currentStep.value = 'idle'
  }
}

// ========================================
// Helpers
// ========================================

function getUploadStatusIcon(status: string): string {
  switch (status) {
    case 'uploading': return 'i-lucide-loader-2'
    case 'success': return 'i-lucide-check-circle'
    case 'error': return 'i-lucide-alert-circle'
    default: return 'i-lucide-upload'
  }
}

function getUploadStatusColor(status: string): string {
  switch (status) {
    case 'uploading': return 'text-primary'
    case 'success': return 'text-success'
    case 'error': return 'text-error'
    default: return 'text-muted'
  }
}
</script>

<template>
  <UForm ref="formRef" :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
    <!-- Upload Progress Banner -->
    <div
      v-if="isUploading || currentStep === 'submitting'"
      class="bg-primary/90 text-white px-4 py-3 rounded-lg"
    >
      <div class="flex items-center gap-3">
        <icon name="i-lucide-loader-2" class="size-5 animate-spin" />
        <div class="flex-1">
          <p class="text-sm font-medium">
            {{ currentStep === 'submitting' ? 'Creating room...' : 'Uploading logo...' }}
          </p>
          <div v-if="isUploading" class="mt-1 h-1.5 bg-white/30 rounded-full overflow-hidden">
            <div
              class="h-full bg-white rounded-full transition-all duration-300"
              :style="{ width: `${logoUpload.state.value.progress}%` }"
            />
          </div>
        </div>
        <span v-if="isUploading" class="text-sm font-bold">{{ logoUpload.state.value.progress }}%</span>
      </div>
    </div>

    <!-- Logo Upload -->
    <div class="flex flex-col items-center gap-2">
      <FileUpload
        :error="fileInputError"
        :current-image="logoPreview"
        shape="rounded"
        size="xl"
        label="Room Logo"
        :aspect-ratio="2"
        :disabled="isSubmitting"
        @file-selected="onFileSelected"
      />
      <div class="flex items-center gap-1.5">
        <span class="text-sm font-medium text-gray-500">Upload Room Logo</span>
        <icon
          v-if="logoUpload.state.value.status !== 'idle'"
          :name="getUploadStatusIcon(logoUpload.state.value.status)"
          :class="[getUploadStatusColor(logoUpload.state.value.status), 'size-4', { 'animate-spin': isUploading }]"
        />
        <span v-if="logoUpload.state.value.status === 'success'" class="text-xs text-success">
          Uploaded
        </span>
      </div>
    </div>

    <!-- Name -->
    <UFormField label="Room Name" name="name">
      <UInput
        v-model="state.name"
        placeholder="My Awesome Room"
        size="xl"
        class="w-full"
        :disabled="isSubmitting"
      />
    </UFormField>

    <div class="pt-4 mb-12">
      <UButton type="submit" block size="xl" :loading="isSubmitting" :disabled="isSubmitting">
        {{ isUploading ? 'Uploading...' : currentStep === 'submitting' ? 'Creating...' : 'Create Room' }}
      </UButton>
    </div>
  </UForm>
</template>

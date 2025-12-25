<script setup lang="ts">
import { z } from 'zod'
import type { FormError, Form } from '@nuxt/ui'
import FileUpload from '~/components/common/file-upload.vue'
import { useRoom } from "~/composables/useRoom";

const authStore = useAuthStore()
const { normalizeError } = useApi()

// Schema
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

state.country = authStore.user?.phone_country ?? '';

const fileInputError = ref('')
const logoPreview = ref<string | null>(null)

const isSubmitting = ref(false)

function onFileSelected(file: File) {
    state.logo = file
    fileInputError.value = ''
    
    if (logoPreview.value) URL.revokeObjectURL(logoPreview.value)
    logoPreview.value = URL.createObjectURL(file)
}

onBeforeUnmount(() => {
    if (logoPreview.value) URL.revokeObjectURL(logoPreview.value)
})

const toast = useToast()

async function onSubmit() {
    if (!state.country) {
        toast.add({ title: 'Profile Error', description: 'Country code is missing in your profile.', color: 'error' });
        return;
    }
    isSubmitting.value = true
    formRef.value?.clear()

    try {
      await useRoom().createRoom({
        name: state.name,
        country: state.country,
        type: 'public',
        logo: state.logo
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
            toast.add({ title: 'Error', description: normalizedError.message, color: 'error' });
        }
    } finally {
        isSubmitting.value = false
    }
}
</script>

<template>
  <UForm ref="formRef" :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">

    <!-- Logo Upload -->
    <div class="flex flex-col items-center gap-2">
      <FileUpload
          :error="fileInputError" :current-image="logoPreview"
          shape="rounded" size="xl" label="Room Logo" :aspect-ratio="2"
          @file-selected="onFileSelected"
      />
      <span class="text-sm font-medium text-gray-500">Upload Room Logo</span>
    </div>

    <!-- Name -->
    <UFormField label="Room Name" name="name">
      <UInput v-model="state.name" placeholder="My Awesome Room" size="xl" class="w-full" />
    </UFormField>

    <div class="pt-4 mb-12">
      <UButton type="submit" block size="xl" :loading="isSubmitting">Create Room</UButton>
    </div>
  </UForm>
</template>

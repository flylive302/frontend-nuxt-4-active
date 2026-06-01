<script setup lang="ts">
import type { Form, FormSubmitEvent } from '@nuxt/ui'
import { contactSupportSchema, useContactSupport, type ContactSupportFormData } from '~/composables/support/useContactSupport'

const props = defineProps<{
  defaultCategory?: string
}>()

const FormsCountryPhoneInput = defineAsyncComponent(
  () => import('~/components/forms/country-phone-input.vue')
)

const ROUTES = {
  LOGIN: '/log-in',
} as const

const CATEGORY_OPTIONS = [
  { label: 'Bug Report', value: 'bug_report' },
  { label: 'Account / Login Issue', value: 'account_login' },
  { label: 'Password Reset', value: 'password_reset' },
{ label: 'Feature Request', value: 'feature_request' },
  { label: 'Other', value: 'other' },
] as const

const formRef = ref<Form<ContactSupportFormData> | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

const {
  isSubmitting,
  generalError,
  submitted,
  getFieldError,
  submit,
  category,
  attachments,
  uploadingAttachments,
  attachmentError,
  addAttachment,
  removeAttachment,
} = useContactSupport(formRef, { defaultCategory: props.defaultCategory })

const phoneError = computed(() => getFieldError('phone'))

const state = reactive({
  countryCode: '',
  dialCode: '',
  phone: '',
  email: '',
  name: '',
  message: '',
})

const hasAttachmentActivity = computed(
  () => attachments.value.length > 0 || uploadingAttachments.value.length > 0
)

async function onSubmit(event: FormSubmitEvent<ContactSupportFormData>): Promise<void> {
  await submit(event.data)
}

async function onFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  input.value = ''
  await addAttachment(file)
}

function triggerFileInput(): void {
  fileInputRef.value?.click()
}
</script>

<template>
  <div>
    <h2 id="contact-support-heading" class="sr-only">Contact Support We reply in 24 hours</h2>

    <div
      v-if="submitted"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      class="text-center space-y-4 py-4"
    >
      <div class="flex justify-center">
        <UIcon name="i-lucide-circle-check" class="size-12 text-success-500" aria-hidden="true" />
      </div>
      <p class="font-semibold text-lg">Message Sent!</p>
      <p class="text-sm text-muted">
        Thank you for reaching out. Our team will review your message and respond within 24 hours.
      </p>
      <UButton
        :to="ROUTES.LOGIN"
        variant="soft"
        size="lg"
        class="mt-2"
      >
        Back to Login
      </UButton>
    </div>

    <template v-else>
      <UAlert
        v-if="generalError"
        :description="generalError"
        color="error"
        variant="soft"
        title="Submission Failed"
        class="mb-4"
        icon="i-lucide-alert-circle"
        role="alert"
      />

      <UForm
        ref="formRef"
        :schema="contactSupportSchema"
        :state="state"
        :validate-on="['blur', 'change']"
        :disabled="isSubmitting"
        class="space-y-3"
        aria-labelledby="contact-support-heading"
        novalidate
        @submit="onSubmit"
      >
        <UFormField label="Your Name" name="name" required>
          <UInput
            v-model="state.name"
            placeholder="Full name or username"
            size="lg"
            class="w-full"
            autocomplete="name"
            :disabled="isSubmitting"
            aria-required="true"
          />
        </UFormField>

        <UFormField label="Email Address" name="email" required>
          <UInput
            v-model="state.email"
            type="email"
            inputmode="email"
            placeholder="you@example.com"
            size="lg"
            class="w-full"
            autocomplete="email"
            :disabled="isSubmitting"
            aria-required="true"
          />
        </UFormField>

        <FormsCountryPhoneInput
          v-model:country-code="state.countryCode"
          v-model:dial-code="state.dialCode"
          v-model:phone="state.phone"
          :disabled="isSubmitting"
          :error="phoneError"
        />

        <UFormField label="Category" name="category">
          <USelect
            v-model="category"
            :items="CATEGORY_OPTIONS"
            value-key="value"
            label-key="label"
            placeholder="Select a category"
            size="lg"
            class="w-full"
            :disabled="isSubmitting"
          />
        </UFormField>

        <UFormField label="Message" name="message" required>
          <UTextarea
            v-model="state.message"
            placeholder="Describe your issue or question in detail…"
            :rows="5"
            size="lg"
            class="w-full"
            :disabled="isSubmitting"
            aria-required="true"
            :maxlength="2000"
          />
          <template #hint>
            <span class="text-xs text-muted" aria-live="polite">
              {{ state.message.length }}/2000
            </span>
          </template>
        </UFormField>

        <!-- Attachments -->
        <div class="space-y-2">
          <p class="text-sm font-medium">
            Attachments
            <span class="text-muted font-normal">({{ attachments.length }}/6)</span>
          </p>

          <!-- Completed thumbnails -->
          <div
            v-if="hasAttachmentActivity"
            class="flex flex-wrap gap-2"
          >
            <div
              v-for="(att, i) in attachments"
              :key="att.file_id"
              class="relative group size-20 rounded-md overflow-hidden border border-default"
            >
              <img
                :src="att.url"
                :alt="att.localName"
                class="size-full object-cover"
              />
              <button
                type="button"
                class="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                :aria-label="`Remove ${att.localName}`"
                :disabled="isSubmitting"
                @click="removeAttachment(i)"
              >
                <UIcon name="i-lucide-x" class="size-5 text-white" aria-hidden="true" />
              </button>
            </div>

            <!-- In-flight uploads -->
            <div
              v-for="up in uploadingAttachments"
              :key="up.localName"
              class="relative size-20 rounded-md border border-default bg-elevated flex flex-col items-center justify-center gap-1 p-1"
            >
              <UIcon name="i-lucide-image" class="size-6 text-muted" aria-hidden="true" />
              <div
                class="w-full bg-default rounded-full h-1 overflow-hidden"
                role="progressbar"
                :aria-valuenow="up.progress"
                aria-valuemin="0"
                aria-valuemax="100"
                :aria-label="`Uploading ${up.localName}`"
              >
                <div
                  class="h-full bg-primary transition-all"
                  :style="{ width: `${up.progress}%` }"
                />
              </div>
              <span class="text-xs text-muted truncate max-w-full px-0.5">{{ up.progress }}%</span>
            </div>
          </div>

          <!-- Error message -->
          <p
            v-if="attachmentError"
            role="alert"
            class="text-sm text-error-500"
          >
            {{ attachmentError }}
          </p>

          <!-- Add button + hidden input -->
          <div>
            <input
              ref="fileInputRef"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              class="sr-only"
              tabindex="-1"
              aria-hidden="true"
              @change="onFileChange"
            />
            <UButton
              v-if="attachments.length < 6"
              type="button"
              variant="soft"
              size="sm"
              icon="i-lucide-paperclip"
              :disabled="isSubmitting || uploadingAttachments.length > 0"
              @click="triggerFileInput"
            >
              Add Image
            </UButton>
          </div>
        </div>

        <UButton
          :loading="isSubmitting"
          type="submit"
          size="xl"
          icon="i-lucide-send"
          class="w-full justify-center"
          :disabled="isSubmitting"
        >
          Send Message
        </UButton>
      </UForm>

      <UButton
        :to="ROUTES.LOGIN"
        class="mt-3 underline font-bold px-0"
        variant="link"
        trailing-icon="i-lucide-arrow-right"
        size="xl"
        :disabled="isSubmitting"
      >
        Back to Login
      </UButton>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Form, FormSubmitEvent } from '@nuxt/ui'
import { contactSupportSchema, useContactSupport, type ContactSupportFormData } from '~/composables/support/useContactSupport'

definePageMeta({
  layout: 'auth',
  authHeading: 'Contact Support',
  pageTransition: false,
  layoutTransition: false,
})

useSeoMeta({
  title: 'Contact Support — FlyLive',
  description: 'Send a message to the FlyLive support team. We respond within 24 hours.',
  ogTitle: 'Contact Support — FlyLive',
  ogDescription: 'Send a message to the FlyLive support team. We respond within 24 hours.',
  ogType: 'website',
  robots: 'index, follow',
})

const ROUTES = {
  LOGIN: '/log-in',
} as const

const formRef = ref<Form<ContactSupportFormData> | null>(null)

const { isSubmitting, generalError, submitted, getFieldError, submit } = useContactSupport(formRef)

const phoneError = computed(() => getFieldError('phone'))

const state = reactive({
  countryCode: '',
  dialCode: '',
  phone: '',
  email: '',
  name: '',
  message: '',
})

async function onSubmit(event: FormSubmitEvent<ContactSupportFormData>): Promise<void> {
  await submit(event.data)
}
</script>

<template>
  <div>
    <h2 id="contact-support-heading" class="sr-only">Contact Support Form</h2>

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

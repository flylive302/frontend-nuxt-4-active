<script setup lang="ts">
import { z } from 'zod'
import { normalizePhone, usePhoneSchema } from '~/composables/auth/usePhoneSchema'
import { useCountries } from '~/composables/shared/useCountries'
import { useAuthForm } from '~/composables/auth/useAuthForm'
import type { FormSubmitEvent, Form } from '@nuxt/ui'

definePageMeta({
  layout: 'auth',
  middleware: 'guest',
  authHeading: 'Reset Password',
})

const ROUTES = {
  LOGIN: '/log-in',
} as const

const toast = useToast()
const { countries } = useCountries()

const formRef = ref<Form<ForgotPasswordFormData> | null>(null)

const { isSubmitting, generalError, getFieldError, handleSubmit } = useAuthForm({ formRef })

const phoneError = computed(() => getFieldError('phone'))

const state = reactive({
  countryCode: '',
  dialCode: '',
  phone: '',
})

const selectedCountry = computed(() => {
  const country = countries.value.find(c => c.code === state.countryCode)
  return country ? { code: country.code, name: country.name } : undefined
})

const phoneSchema = usePhoneSchema(selectedCountry)

type ForgotPasswordFormData = z.infer<typeof phoneSchema.value>

/**
 * Handles forgot-password form submission.
 * Currently stubbed — backend endpoint not yet implemented.
 */
async function onSubmit(event: FormSubmitEvent<ForgotPasswordFormData>): Promise<void> {
  await handleSubmit(async () => {
    const { dialCode, phone } = event.data
    const _normalizedPhone = normalizePhone(dialCode, phone)

    // TODO: Replace with actual API call when backend endpoint is ready
    // await $fetch('/api/v1/auth/forgot-password', { method: 'POST', body: { phone: normalizedPhone, country: event.data.countryCode } })

    toast.add({
      title: 'Coming Soon',
      description: 'Password reset via phone is not yet available. Please contact support.',
      color: 'warning',
      icon: 'i-lucide-construction',
    })
  })
}
</script>

<template>
  <div>
    <h2 id="forgot-password-heading" class="sr-only">Reset Your Password</h2>

    <UAlert
      v-if="generalError"
      :description="generalError"
      color="error"
      variant="soft"
      title="Reset Failed"
      class="mb-4"
      icon="i-lucide-alert-circle"
    />

    <UForm
      ref="formRef"
      :schema="phoneSchema"
      :state="state"
      :validate-on="['blur', 'change']"
      :disabled="isSubmitting"
      class="space-y-3"
      @submit="onSubmit"
    >
      <FormsCountryPhoneInput
        v-model:country-code="state.countryCode"
        v-model:dial-code="state.dialCode"
        v-model:phone="state.phone"
        :disabled="isSubmitting"
        :error="phoneError"
      />

      <UButton
        :loading="isSubmitting"
        type="submit"
        size="xl"
        icon="i-lucide-send"
        class="w-full justify-center"
        :disabled="isSubmitting"
      >
        Send Reset Link
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
  </div>
</template>
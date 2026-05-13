<script setup lang="ts">
import { z } from 'zod'
import { normalizePhone, usePhoneSchema } from '~/composables/auth/usePhoneSchema'
import { useCountries } from '~/composables/shared/useCountries'
import { useAuthForm } from '~/composables/auth/useAuthForm'
import type { FormSubmitEvent, Form } from '@nuxt/ui'
const FormsCountryPhoneInput = defineAsyncComponent(
    () => import('~/components/forms/country-phone-input.vue')
)

definePageMeta({
  layout: 'auth',
  middleware: 'guest',
  authHeading: 'Create a new FlyLive account',
  pageTransition: false,
  layoutTransition: false,
})

useThemeColor('#000002')
useSeoMeta({
  title: 'Sign Up — FlyLive',
  description: 'Create your FlyLive account to join live audio rooms, connect with hosts, and start broadcasting.',
  ogTitle: 'Sign Up — FlyLive',
  ogDescription: 'Create your FlyLive account to join live audio rooms, connect with hosts, and start broadcasting.',
  ogType: 'website',
  robots: 'index, follow',
})
const MIN_PASSWORD_LENGTH = 8

const ROUTES = {
  COMPLETE_PROFILE: '/complete-profile-data',
  LOGIN: '/log-in',
} as const

const { register } = useAuthActions()
const { countries } = useCountries()

const formRef = ref<Form<RegistrationFormData> | null>(null)

const { isSubmitting, generalError, getFieldError, handleSubmit } = useAuthForm({ formRef })

const phoneError = computed(() => getFieldError('phone'))

const state = reactive({
  name: '',
  password: '',
  countryCode: '',
  dialCode: '',
  phone: '',
})

const selectedCountry = computed(() => {
  const country = countries.value.find(c => c.code === state.countryCode)
  return country ? { code: country.code, name: country.name } : undefined
})

const phoneSchema = usePhoneSchema(selectedCountry)

const registrationSchema = computed(() => {
  const baseSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    password: z.string().min(MIN_PASSWORD_LENGTH, 'Must be at least 8 characters'),
  })

  return z.intersection(baseSchema, phoneSchema.value)
})

type RegistrationFormData = z.infer<typeof registrationSchema.value>

/**
 * Handles form submission - validates data, registers user, and navigates to profile completion
 */
async function handleFormSubmit(event: FormSubmitEvent<RegistrationFormData>): Promise<void> {
  await handleSubmit(async () => {
    const { name, password, dialCode, phone, countryCode } = event.data

    await register({
      name,
      phone: normalizePhone(dialCode, phone),
      country: countryCode,
      password,
    }, ROUTES.COMPLETE_PROFILE)
  })
}
</script>

<template>
  <div>
    <h2 id="signup-heading" class="sr-only">Create Your Account</h2>

    <UAlert
      v-if="generalError"
      :description="generalError"
      color="error"
      variant="soft"
      title="Registration Failed"
      class="mb-4"
      icon="i-lucide-alert-circle"
    />

    <UForm
      ref="formRef"
      :schema="registrationSchema"
      :state="state"
      :validate-on="['blur', 'change']"
      :disabled="isSubmitting"
      class="space-y-3"
      @submit="handleFormSubmit"
    >
      <UFormField label="Full Name" name="name" required>
        <UInput v-model="state.name" class="w-full" size="lg" icon="i-lucide-user" placeholder="John Doe" :disabled="isSubmitting" />
      </UFormField>

      <FormsCountryPhoneInput
        v-model:country-code="state.countryCode"
        v-model:dial-code="state.dialCode"
        v-model:phone="state.phone"
        :disabled="isSubmitting"
        :error="phoneError"
      />

      <UFormField label="Password" name="password" required>
        <FormsPasswordInput
          v-model="state.password"
          placeholder="********"
          :disabled="isSubmitting"
        />
      </UFormField>

      <UButton
        :loading="isSubmitting"
        type="submit"
        size="xl"
        icon="i-lucide-send"
        class="w-full justify-center"
        :disabled="isSubmitting"
      >
        Sign Up
      </UButton>

      <p class="text-xs text-neutral-500 text-center mt-2 leading-relaxed">
        By signing up, you agree to our
        <a href="/privacy-policy" class="text-primary hover:underline">Privacy Policy</a>
        and
        <a href="/terms-of-service" class="text-primary hover:underline">Terms of Service</a>.
        You must be at least 18 years old.
      </p>
    </UForm>

    <UButton
      :to="ROUTES.LOGIN"
      class="mt-3 underline font-bold px-0"
      variant="link"
      trailing-icon="i-lucide-arrow-right"
      size="xl"
      :disabled="isSubmitting"
    >
      Have an Account? Log In
    </UButton>
  </div>
</template>
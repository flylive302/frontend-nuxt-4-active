<script setup lang="ts">
import { z } from 'zod'
import { computed, reactive, ref } from 'vue'
import { navigateTo } from 'nuxt/app'
import type { PhoneModel } from '~/composables/usePhoneSchema'

// ========================================
// Page Configuration
// ========================================
definePageMeta({
  layout: 'auth',
  middleware: 'guest'
})

// ========================================
// Constants
// ========================================
const VALIDATION_MESSAGES = {
  NAME_MIN_LENGTH: 'Name must be at least 2 characters',
  PASSWORD_MIN_LENGTH: 'Must be at least 8 characters',
  PASSWORD_LOWERCASE: 'Must contain at least one lowercase letter',
  PASSWORD_UPPERCASE: 'Must contain at least one uppercase letter',
  PASSWORD_NUMBER: 'Must contain at least one number',
  PASSWORD_SPECIAL: 'Must contain at least one special character',
} as const

const FIELD_CONSTRAINTS = {
  NAME_MIN_LENGTH: 2,
  PASSWORD_MIN_LENGTH: 8,
  COUNTRY_CODE_MIN_LENGTH: 2,
  DIAL_CODE_MIN_LENGTH: 1,
  PHONE_MIN_LENGTH: 1,
} as const

const HTTP_STATUS = {
  UNPROCESSABLE_ENTITY: 422,
} as const

const ROUTES = {
  COMPLETE_PROFILE: '/complete-profile-data',
  LOGIN: '/log-in',
} as const

// ========================================
// Validation Schema
// ========================================
const registrationSchema = z.object({
  name: z.string().min(
    FIELD_CONSTRAINTS.NAME_MIN_LENGTH,
    VALIDATION_MESSAGES.NAME_MIN_LENGTH
  ),
  password: z.string()
    .min(FIELD_CONSTRAINTS.PASSWORD_MIN_LENGTH, VALIDATION_MESSAGES.PASSWORD_MIN_LENGTH)
    .regex(/[a-z]/, VALIDATION_MESSAGES.PASSWORD_LOWERCASE)
    .regex(/[A-Z]/, VALIDATION_MESSAGES.PASSWORD_UPPERCASE)
    .regex(/\d/, VALIDATION_MESSAGES.PASSWORD_NUMBER)
    .regex(/[\W_]/, VALIDATION_MESSAGES.PASSWORD_SPECIAL),
  countryCode: z.string().min(FIELD_CONSTRAINTS.COUNTRY_CODE_MIN_LENGTH),
  dialCode: z.string().min(FIELD_CONSTRAINTS.DIAL_CODE_MIN_LENGTH),
  phone: z.string().min(FIELD_CONSTRAINTS.PHONE_MIN_LENGTH),
})

type RegistrationFormData = z.output<typeof registrationSchema>

// ========================================
// Component State
// ========================================
// Form data state - initialized with undefined to track user input
const formData = reactive<Partial<RegistrationFormData>>({
  name: undefined,
  password: undefined,
  countryCode: undefined,
  dialCode: undefined,
  phone: undefined,
})

// UI state
const isProcessing = ref<boolean>(false)
const generalErrorMessage = ref<string>('')
const formRef = ref<{ setErrors: (errors: Array<{ path: string; message: string }>) => void } | null>(null)

// Computed validation state - reactive validation status for submit button
const isFormValid = computed<boolean>(() => registrationSchema.safeParse(formData).success)

// ========================================
// Composables
// ========================================
const toast = useToast()
const { register } = useAuth()
const { normalizeError } = useApi()

// ========================================
// Event Handlers
// ========================================
/**
 * Updates form data when phone input component emits new phone data
 * @param phoneData - Phone model containing country code, dial code, and phone number
 */
function handlePhoneUpdate(phoneData: PhoneModel): void {
  formData.countryCode = phoneData.countryCode
  formData.dialCode = phoneData.dialCode
  formData.phone = phoneData.phone
}

/**
 * Formats phone number by combining dial code and phone, removing non-numeric characters except '+'
 * @param dialCode - Country dial code (e.g., '+1')
 * @param phone - Phone number without country code
 * @returns Formatted phone number with only digits and leading '+'
 */
function formatPhoneNumber(dialCode: string, phone: string): string {
  return `${dialCode}${phone}`.replace(/[^+\d]/g, '')
}

/**
 * Handles form submission - validates data, registers user, and navigates to profile completion
 */
async function handleFormSubmit(): Promise<void> {
  isProcessing.value = true
  generalErrorMessage.value = ''

  try {
    // Validate form data using Zod schema
    const validationResult = registrationSchema.safeParse(formData)
    if (!validationResult.success) {
      return
    }

    const validatedData = validationResult.data

    // Register user with validated and formatted data
    await register({
      name: validatedData.name,
      phone: formatPhoneNumber(validatedData.dialCode, validatedData.phone),
      phone_country: validatedData.countryCode,
      country_code: validatedData.dialCode,
      password: validatedData.password,
    })

    // Navigate to profile completion page on successful registration
    await navigateTo(ROUTES.COMPLETE_PROFILE)
  } catch (error: unknown) {
    const normalizedError = normalizeError(error)

    // Handle validation errors from backend (HTTP 422)
    if (normalizedError.status === HTTP_STATUS.UNPROCESSABLE_ENTITY && normalizedError.fieldErrors) {
      const formFieldErrors = Object.entries(normalizedError.fieldErrors).map(
        ([fieldPath, errorMessages]) => ({
          path: fieldPath,
          message: errorMessages?.[0] ?? 'Invalid value', // Use first error message with fallback
        })
      )
      formRef.value?.setErrors(formFieldErrors)
    }

    // Display error to user via both inline alert and toast notification
    generalErrorMessage.value = normalizedError.message
    toast.add({
      title: 'Error',
      description: normalizedError.message,
      color: 'error'
    })
  } finally {
    isProcessing.value = false
  }
}
</script>

<template>
  <main>
    <!-- General error alert - displayed at top of form when registration fails -->
    <UAlert
        v-if="generalErrorMessage"
        :description="generalErrorMessage"
        color="error" variant="soft" title="Registration Failed"
        class="mb-4" icon="i-lucide-alert-circle"
    />

    <!-- Registration form with Zod validation -->
    <UForm ref="formRef" :schema="registrationSchema" :state="formData" class="space-y-3" @submit="handleFormSubmit">
      <!-- Full name input field -->
      <UFormField label="Full Name" name="name" required>
        <UInput v-model="formData.name" class="w-full" size="lg" icon="i-lucide-user" placeholder="John Doe" />
      </UFormField>

      <!-- Country phone input component - handles country code, dial code, and phone number -->
      <FormsCountryPhoneInput @update:model="handlePhoneUpdate" />

      <!-- Password input field with strength requirements -->
      <UFormField label="Password" name="password" required>
        <UInput
            v-model="formData.password"
            class="w-full" size="lg" icon="i-lucide-lock"
            type="password" placeholder="********"
        />
      </UFormField>

      <!-- Submit button - disabled until form is valid -->
      <UButton
          :loading="isProcessing" :disabled="!isFormValid"
          type="submit" size="xl" icon="i-lucide-send"
          class="w-full justify-center disabled:bg-primary-400"
      >
        Sign Up
      </UButton>
    </UForm>

    <!-- Link to login page for existing users -->
    <UButton
        :to="ROUTES.LOGIN"
        class="mt-3 underline font-bold px-0" variant="link"
        trailing-icon="i-lucide-arrow-right" size="xl"
    >
      Have an Account Log In
    </UButton>
  </main>
</template>
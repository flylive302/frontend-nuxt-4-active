<script setup lang="ts">
// ========================================
// Imports & Types
// ========================================
import { z } from 'zod'
import type { PhoneModel } from '~/composables/usePhoneSchema'
import { normalizePhone } from '~/composables/usePhoneSchema'

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
const MIN_PASSWORD_LENGTH = 8 as const
const VALIDATION_ERROR_STATUS = 422 as const

// ========================================
// Validation Schema
// ========================================
const loginSchema = z.object({
  password: z.string().min(MIN_PASSWORD_LENGTH, 'Must be at least 8 characters'),
  countryCode: z.string().min(2, 'Country is required'),
  dialCode: z.string().startsWith('+', 'Invalid dial code'),
  phone: z.string().min(1, 'Phone number is required'),
  rememberMe: z.boolean().optional(),
})

// ========================================
// Types
// ========================================
interface LoginFormState {
  password: string
  countryCode: string
  dialCode: string
  phone: string
  rememberMe: boolean
}

interface LoginPayload {
  phone: string
  phone_country: string
  password: string
  remember_me: boolean
}

// ========================================
// Component State
// ========================================
const state = reactive<LoginFormState>({
  password: '',
  countryCode: '',
  dialCode: '',
  phone: '',
  rememberMe: false,
})

const form = ref<{ setErrors: (errors: { path: string; message: string }[]) => void } | null>(null)
const processing = ref(false)

// ========================================
// Composables / Injected Dependencies
// ========================================
const toast = useToast()
const { login } = useAuth()
const { normalizeError } = useApi()

// ========================================
// Event Handlers
// ========================================
function handlePhoneUpdate(phoneData: PhoneModel): void {
  state.countryCode = phoneData.countryCode
  state.dialCode = phoneData.dialCode
  state.phone = phoneData.phone
}

async function handleSubmit(): Promise<void> {
  processing.value = true

  try {
    const validationResult = loginSchema.safeParse(state)

    if (!validationResult.success) {
      processing.value = false
      return
    }

    const { dialCode, phone, countryCode, password, rememberMe } = validationResult.data

    const loginPayload: LoginPayload = {
      phone: normalizePhone(dialCode, phone),
      phone_country: countryCode,
      password,
      remember_me: rememberMe ?? false
    }

    await login(loginPayload)

    try {
      await navigateTo('/')
    } catch (navError) {
      toast.add({
        title: 'Navigation Error',
        description: 'Login successful but navigation failed. Please refresh the page.',
        color: 'warning'
      })
    }
  } catch (error: unknown) {
    handleLoginError(error)
  } finally {
    processing.value = false
  }
}

// ========================================
// Helpers / Utilities
// ========================================
function handleLoginError(error: unknown): void {
  const apiError = normalizeError(error)

  if (apiError.status === VALIDATION_ERROR_STATUS && apiError.fieldErrors) {
    const formErrors = Object.entries(apiError.fieldErrors).map(([path, messages]) => ({
      path,
      message: messages.join(', ')
    }))

    if (form.value) {
      form.value.setErrors(formErrors)
    }
  }

  toast.add({
    title: 'Login Failed',
    description: apiError.message,
    color: 'error'
  })
}
</script>

<template>
  <main>
    <UForm ref="form" :schema="loginSchema" :state="state" class="space-y-3" @submit="handleSubmit">
      <FormsCountryPhoneInput @update:model="handlePhoneUpdate" />

      <UFormField label="Password" name="password" required>
        <UInput v-model="state.password" class="w-full" size="lg" icon="i-lucide-lock" type="password"
          placeholder="********" />
      </UFormField>

      <UCheckbox v-model="state.rememberMe" label="Remember me" />

      <UButton type="submit" size="xl" class="w-full" icon="i-lucide-send" :loading="processing">
        Log In
      </UButton>
    </UForm>

    <UButton to="/sign-up" class="mt-3 underline font-bold px-0" variant="link" trailing-icon="i-lucide-arrow-right"
      size="xl">
      Create an Account
    </UButton>
  </main>
</template>
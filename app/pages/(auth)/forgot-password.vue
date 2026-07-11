<script setup lang="ts">
import { z } from 'zod'
import { useAuthForm } from '~/composables/auth/useAuthForm'
import type { FormSubmitEvent, Form } from '@nuxt/ui'

definePageMeta({
  layout: 'auth',
  middleware: 'guest',
  authHeading: 'Reset your password',
})

useThemeColor('#000002')
useSeoMeta({
  title: 'Reset Password — FlyLive',
  description: 'Reset your FlyLive password using a one-time code sent to your email.',
  robots: 'noindex, nofollow',
})

const ROUTES = { LOGIN: '/log-in' } as const
const OTP_LENGTH = 6

const { requestPasswordReset, resetPassword } = useAuthActions()
const toast = useToast()

const step = ref<'request' | 'reset'>('request')
const email = ref('')

// ── Step 1: request a reset code ────────────────────────────────────────────
const requestFormRef = ref<Form<RequestFormData> | null>(null)
const requestForm = useAuthForm({ formRef: requestFormRef })
const requestState = reactive({ email: '' })
const requestSchema = z.object({ email: z.string().email('Enter a valid email address') })
type RequestFormData = z.infer<typeof requestSchema>

async function onRequest(event: FormSubmitEvent<RequestFormData>): Promise<void> {
  await requestForm.handleSubmit(async () => {
    await requestPasswordReset({ email: event.data.email })
    email.value = event.data.email
    step.value = 'reset'
    toast.add({ title: 'If that account exists, a reset code was sent.', color: 'success' })
  })
}

// ── Step 2: enter code + new password ───────────────────────────────────────
const resetFormRef = ref<Form<ResetFormData> | null>(null)
const resetForm = useAuthForm({ formRef: resetFormRef })
const resetState = reactive<{ code: number[]; password: string; password_confirmation: string }>({
  code: [],
  password: '',
  password_confirmation: '',
})
const resetSchema = z.object({
  code: z.number().int().min(0).max(9).array().length(OTP_LENGTH, `Enter the ${OTP_LENGTH}-digit code`),
  password: z.string()
    .min(8, 'Must be at least 8 characters')
    .regex(/[a-z]/, 'Add a lowercase letter')
    .regex(/[A-Z]/, 'Add an uppercase letter')
    .regex(/[0-9]/, 'Add a number')
    .regex(/[^A-Za-z0-9]/, 'Add a symbol'),
  password_confirmation: z.string(),
}).refine(data => data.password === data.password_confirmation, {
  path: ['password_confirmation'],
  message: 'Passwords do not match',
})
type ResetFormData = z.infer<typeof resetSchema>

async function onReset(event: FormSubmitEvent<ResetFormData>): Promise<void> {
  await resetForm.handleSubmit(async () => {
    await resetPassword({
      email: email.value,
      code: event.data.code.join(''),
      password: event.data.password,
      password_confirmation: event.data.password_confirmation,
    })
    toast.add({ title: 'Password reset. Please log in.', color: 'success' })
    await navigateTo(ROUTES.LOGIN)
  })
}
</script>

<template>
  <div>
    <!-- Step 1: email -->
    <template v-if="step === 'request'">
      <p class="text-sm text-neutral-400 mb-5 text-center">
        Enter your account email and we'll send you a 6-digit reset code.
      </p>

      <UAlert
        v-if="requestForm.generalError.value"
        :description="requestForm.generalError.value"
        color="error"
        variant="soft"
        title="Could not send code"
        class="mb-4"
        icon="i-lucide-alert-circle"
      />

      <UForm
        ref="requestFormRef"
        :schema="requestSchema"
        :state="requestState"
        :validate-on="['blur', 'change']"
        :disabled="requestForm.isSubmitting.value"
        class="space-y-4"
        @submit="onRequest"
      >
        <UFormField label="Email" name="email" required>
          <UInput
            v-model="requestState.email"
            type="email"
            autocomplete="email"
            class="w-full"
            size="lg"
            icon="i-lucide-mail"
            placeholder="you@example.com"
            :disabled="requestForm.isSubmitting.value"
          />
        </UFormField>

        <UButton
          type="submit"
          size="xl"
          class="w-full justify-center"
          icon="i-lucide-send"
          :loading="requestForm.isSubmitting.value"
          :disabled="requestForm.isSubmitting.value"
        >
          Send reset code
        </UButton>
      </UForm>
    </template>

    <!-- Step 2: code + new password -->
    <template v-else>
      <p class="text-sm text-neutral-400 mb-5 text-center">
        Enter the code sent to
        <span class="font-semibold text-neutral-200">{{ email }}</span>
        and choose a new password.
      </p>

      <UAlert
        v-if="resetForm.generalError.value"
        :description="resetForm.generalError.value"
        color="error"
        variant="soft"
        title="Could not reset password"
        class="mb-4"
        icon="i-lucide-alert-circle"
      />

      <UForm
        ref="resetFormRef"
        :schema="resetSchema"
        :state="resetState"
        :disabled="resetForm.isSubmitting.value"
        class="space-y-5"
        @submit="onReset"
      >
        <UFormField name="code" :error-pattern="/(code)\..*/" class="flex justify-center">
          <UPinInput
            v-model="resetState.code"
            otp
            type="number"
            :length="OTP_LENGTH"
            size="xl"
            autofocus
            :disabled="resetForm.isSubmitting.value"
          />
        </UFormField>

        <UFormField label="New Password" name="password" required>
          <FormsPasswordInput
            v-model="resetState.password"
            autocomplete="new-password"
            placeholder="********"
            :disabled="resetForm.isSubmitting.value"
          />
        </UFormField>

        <UFormField label="Confirm Password" name="password_confirmation" required>
          <FormsPasswordInput
            v-model="resetState.password_confirmation"
            autocomplete="new-password"
            placeholder="********"
            :show-strength="false"
            :disabled="resetForm.isSubmitting.value"
          />
        </UFormField>

        <UButton
          type="submit"
          size="xl"
          class="w-full justify-center"
          icon="i-lucide-shield-check"
          :loading="resetForm.isSubmitting.value"
          :disabled="resetForm.isSubmitting.value"
        >
          Reset password
        </UButton>
      </UForm>
    </template>

    <UButton
      :to="ROUTES.LOGIN"
      class="mt-3 underline font-bold px-0"
      variant="link"
      trailing-icon="i-lucide-arrow-right"
      size="xl"
    >
      Back to Log In
    </UButton>
  </div>
</template>

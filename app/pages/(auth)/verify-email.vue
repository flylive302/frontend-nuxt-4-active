<script setup lang="ts">
import { z } from 'zod'
import { useAuthForm } from '~/composables/auth/useAuthForm'
import type { FormSubmitEvent, Form } from '@nuxt/ui'

definePageMeta({
  layout: 'auth',
  middleware: 'guest',
  authHeading: 'Verify your email',
})

useThemeColor('#000002')
useSeoMeta({
  title: 'Verify Email — FlyLive',
  robots: 'noindex, nofollow',
})

const OTP_LENGTH = 6
const RESEND_COOLDOWN_SECONDS = 30

const route = useRoute()
const toast = useToast()
const { verifyEmail, resendVerificationCode } = useAuthActions()

const email = computed(() => String(route.query.email ?? ''))

// No email in the query means the user landed here directly — send them back.
onMounted(() => {
  if (!email.value) navigateTo('/sign-up')
})

const formRef = ref<Form<VerifyFormData> | null>(null)
const { isSubmitting, generalError, handleSubmit } = useAuthForm({ formRef })

const state = reactive<{ code: number[] }>({ code: [] })

const verifySchema = z.object({
  code: z.number().int().min(0).max(9).array().length(OTP_LENGTH, `Enter the ${OTP_LENGTH}-digit code`),
})
type VerifyFormData = z.infer<typeof verifySchema>

// Resend cooldown
const cooldown = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

function startCooldown(): void {
  cooldown.value = RESEND_COOLDOWN_SECONDS
  timer = setInterval(() => {
    cooldown.value -= 1
    if (cooldown.value <= 0 && timer) {
      clearInterval(timer)
      timer = null
    }
  }, 1000)
}

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

async function onSubmit(event: FormSubmitEvent<VerifyFormData>): Promise<void> {
  await handleSubmit(async () => {
    // verifyEmail() stores tokens and routes into profile completion on success.
    await verifyEmail({ email: email.value, code: event.data.code.join('') })
  })
}

// Auto-submit once all digits are entered (mobile-friendly).
function onComplete(): void {
  formRef.value?.submit?.()
}

async function onResend(): Promise<void> {
  if (cooldown.value > 0) return
  startCooldown()
  await resendVerificationCode(email.value)
  toast.add({ title: 'A new code has been sent.', color: 'success' })
}
</script>

<template>
  <div>
    <h2 class="sr-only">Verify your email</h2>

    <UAlert
      v-if="generalError"
      :description="generalError"
      color="error"
      variant="soft"
      title="Verification failed"
      class="mb-4"
      icon="i-lucide-alert-circle"
    />

    <p class="text-sm text-neutral-400 mb-5 text-center">
      We sent a 6-digit code to
      <span class="font-semibold text-neutral-200">{{ email }}</span>.
      Enter it below to verify your account.
    </p>

    <UForm
      ref="formRef"
      :schema="verifySchema"
      :state="state"
      :disabled="isSubmitting"
      class="space-y-5"
      @submit="onSubmit"
    >
      <UFormField name="code" :error-pattern="/(code)\..*/" class="flex justify-center">
        <UPinInput
          v-model="state.code"
          otp
          type="number"
          :length="OTP_LENGTH"
          size="xl"
          autofocus
          :disabled="isSubmitting"
          @complete="onComplete"
        />
      </UFormField>

      <UButton
        type="submit"
        size="xl"
        class="w-full justify-center"
        icon="i-lucide-shield-check"
        :loading="isSubmitting"
        :disabled="isSubmitting"
      >
        Verify
      </UButton>
    </UForm>

    <div class="mt-4 text-center text-sm text-neutral-400">
      Didn't get a code?
      <UButton
        variant="link"
        class="px-1 font-semibold"
        :disabled="cooldown > 0 || isSubmitting"
        @click="onResend"
      >
        {{ cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code' }}
      </UButton>
    </div>
  </div>
</template>

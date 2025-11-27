<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { computed, reactive, ref } from 'vue'
import { navigateTo } from 'nuxt/app'
import type { PhoneModel } from '~/composables/usePhoneSchema'

definePageMeta({
  layout: 'auth',
  middleware: 'guest'
})

const baseSchema = z.object({
  password: z.string().min(8, 'Must be at least 8 characters'),
  countryCode: z.string().min(2),
  dialCode: z.string().min(1),
  phone: z.string().min(1),
})

type BaseSchema = z.output<typeof baseSchema>

const state = reactive<Partial<BaseSchema>>({
  password: undefined,
  countryCode: undefined,
  dialCode: undefined,
  phone: undefined,
})

const isValid = computed(() => baseSchema.safeParse(state).success)
const form = ref()
const generalError = ref('')

const toast = useToast()
const processing = ref(false)
const { login } = useAuth()
const { normalizeError } = useApi()

function onPhoneUpdate(phoneData: PhoneModel) {
  state.countryCode = phoneData.countryCode
  state.dialCode = phoneData.dialCode
  state.phone = phoneData.phone
}

async function onSubmit(_e: FormSubmitEvent<BaseSchema>) {
  processing.value = true
  generalError.value = ''

  try {
    const parsed = baseSchema.safeParse(state)
    if (!parsed.success) return

    await login({
        phone: `${parsed.data.dialCode}${parsed.data.phone}`.replace(/[^+\d]/g, ''),
        phone_country: parsed.data.countryCode,
        password: parsed.data.password
    })

    navigateTo('/')
  } catch (error: any) {
      const err = normalizeError(error)
      if (err.status === 422 && err.fieldErrors) {
          const formErrors = Object.entries(err.fieldErrors).map(([path, messages]) => ({
              path,
              message: messages[0]
          }))
          form.value.setErrors(formErrors)
      }
      generalError.value = err.message
      toast.add({ title: 'Error', description: err.message, color: 'error' })
  } finally {
    processing.value = false
  }
}
</script>

<template>
  <main>
    <UAlert
      v-if="generalError"
      color="error"
      variant="soft"
      title="Login Failed"
      :description="generalError"
      class="mb-4"
      icon="i-lucide-alert-circle"
    />

    <UForm ref="form" :schema="baseSchema" :state="state" class="space-y-3" @submit="onSubmit">
      <FormsCountryPhoneInput @update:model="onPhoneUpdate" />

      <UFormField label="Password" name="password" required>
        <UInput
            v-model="state.password"
            class="w-full"
            size="lg"
            icon="i-lucide-lock"
            type="password"
            placeholder="********"
        />
      </UFormField>

      <UButton
          type="submit"
          size="xl"
          class="w-full justify-center disabled:bg-primary-400"
          icon="i-lucide-send"
          :loading="processing"
          :disabled="!isValid"
      >
        Log In
      </UButton>
    </UForm>

    <UButton to="/sign-up" class="mt-3 underline font-bold px-0" variant="link" trailing-icon="i-lucide-arrow-right" size="xl">Create an Account</UButton>
  </main>
</template>
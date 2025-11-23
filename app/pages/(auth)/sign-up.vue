<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { computed, reactive, ref } from 'vue'
import { navigateTo } from 'nuxt/app'
import type { PhoneModel } from '~/composables/usePhoneSchema'

definePageMeta({ layout: 'auth' })

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

const toast = useToast()
const processing = ref(false)

function onPhoneUpdate(phoneData: PhoneModel) {
  state.countryCode = phoneData.countryCode
  state.dialCode = phoneData.dialCode
  state.phone = phoneData.phone
}

async function onSubmit(_e: FormSubmitEvent<BaseSchema>) {
  processing.value = true
  try {
    const parsed = baseSchema.safeParse(state)
    if (!parsed.success) return

    const e164 = `${state.dialCode}${state.phone}`
    toast.add({ title: 'Success', description: `Phone: ${e164}`, color: 'success' })
    console.log('Form payload →', parsed.data)

    setTimeout(() => navigateTo('/complete-profile-data'), 3000)
  } finally {
    processing.value = false
  }
}
</script>

<template>
  <main>
    <UForm :schema="baseSchema" :state="state" class="space-y-3" @submit="onSubmit">
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
          class="w-full justify-center"
          icon="i-lucide-send"
          :loading="processing"
          :disabled="!isValid"
      >
        Sign Up
      </UButton>
    </UForm>
  </main>
</template>
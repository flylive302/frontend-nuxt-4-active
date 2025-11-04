<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { computed, onMounted, reactive, ref } from 'vue'
import { navigateTo, useLazyFetch } from 'nuxt/app'
import { localFetch } from '~/utils/http'
import type { Country, PhoneModel } from '~/composables/usePhoneSchema'
import { usePhoneSchema, normalizePhone } from '~/composables/usePhoneSchema'
import { useGeolocation } from '~/composables/useGeolocation'

definePageMeta({ layout: 'auth' })

// ---------- schema ----------
const baseSchema = z.object({
  password: z.string().min(8, 'Must be at least 8 characters'),
})

type BaseSchema = z.output<typeof baseSchema>

// ---------- reactive state ----------
const state = reactive<Partial<BaseSchema>>({
  password: undefined,
})

// phone model (for merged schema)
const phone = reactive<PhoneModel>({
  countryCode: '',
  dialCode: '',
  phone: '',
})

// ---------- load countries ----------
const { data: countries, status } = await useLazyFetch<Country[]>(
    '/countries.json',
    { immediate: true, $fetch: localFetch }
)

// ---------- auto-detect country ----------
const detectingLocation = ref(false)
const { detectCountry } = useGeolocation()

onMounted(async () => {
  detectingLocation.value = true
  try {
    const code = await detectCountry()
    if (code && countries.value) {
      const match = countries.value.find(c => c.code.toUpperCase() === code.toUpperCase())
      if (match) {
        phone.countryCode = match.code
        phone.dialCode = match.dial_code
      }
    }
  } finally {
    detectingLocation.value = false
  }
})

// ---------- compose schemas ----------
const phoneSchema = usePhoneSchema(computed(() =>
    phone.countryCode ? { code: phone.countryCode, name: '' } : undefined
))
const pageSchema = computed(() => baseSchema.and(phoneSchema.value))

type FullSchema = z.output<typeof pageSchema.value>

// ---------- validity ----------
const isValid = computed(() => pageSchema.value.safeParse({ ...state, ...phone }).success)

// ---------- submit ----------
const toast = useToast()

const processing = ref(false)
async function onSubmit(_e: FormSubmitEvent<FullSchema>) {
  processing.value = true
  try {
    const parsed = pageSchema.value.safeParse({ ...state, ...phone })
    if (!parsed.success) {
      return
    }
    const e164 = normalizePhone(phone.dialCode, phone.phone)
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
    <UForm :schema="pageSchema" :state="{ ...state, ...phone }" class="space-y-3" @submit="onSubmit">
      <!-- integrated country + phone -->
      <FormsCountryPhoneInput
          v-if="countries"
          :countries="countries"
          :initial-country="countries.find(c => c.code === phone.countryCode)"
          :detecting-location="detectingLocation || status === 'pending'"
          @update:model="Object.assign(phone, $event)"
      />

      <UFormField label="Password" name="password" required>
        <UInput v-model="state.password" class="w-full" size="lg" icon="i-lucide-lock" type="password" placeholder="********" />
      </UFormField>

      <UButton type="submit" size="xl" class="w-full justify-center" icon="i-lucide-send" :loading="processing" :disabled="!isValid">
        Sign Up
      </UButton>
    </UForm>
  </main>
</template>

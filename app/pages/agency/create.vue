<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { computed, onMounted, reactive, ref } from 'vue'
import { navigateTo, useLazyFetch } from 'nuxt/app'
import { localFetch } from '~/utils/http'
import type { Country, PhoneModel } from '~/composables/usePhoneSchema'
import { usePhoneSchema, normalizePhone } from '~/composables/usePhoneSchema'
import { useGeolocation } from '~/composables/useGeolocation'
import { useSubmitRequest } from '~/composables/useSubmitRequest'

definePageMeta({ layout: 'alt' })

// ---------- schema ----------
const imageFile = z.instanceof(File, { message: 'Only image files are allowed' })
  .refine(f => /^image\//.test(f.type), 'Only image files are allowed')
  .refine(f => f.size <= 2 * 1024 * 1024, 'Each file must be ≤ 2MB')

const baseSchema = z.object({
  agencyName: z.string()
    .min(1, 'Agency name is required')
    .max(30, 'Agency name must be less than 30 characters'),
  address: z.string()
    .min(1, 'Address is required'),
  logo: imageFile,
  idCardFront: imageFile,
  idCardBack: imageFile,
})

type BaseSchema = z.output<typeof baseSchema>

// ---------- reactive state ----------
const state = reactive<Partial<BaseSchema>>({
  agencyName: undefined,
  address: undefined,
  logo: undefined,
  idCardFront: undefined,
  idCardBack: undefined,
})

// phone model (for merged schema)
const phone = reactive<PhoneModel>({
  countryCode: '',
  dialCode: '',
  phone: '',
})

import type { ResellerApiRow } from '~/types/reseller'

// selected reseller
const selectedReseller = ref<ResellerApiRow | null>(null)

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
const isValid = computed(() => {
  const baseValid = baseSchema.safeParse(state).success
  const phoneValid = phoneSchema.value.safeParse(phone).success
  return baseValid && phoneValid && !!selectedReseller.value
})

// ---------- submit ----------
const toast = useToast()
const processing = ref(false)
const { submit, mapError } = useSubmitRequest()

async function onSubmit(_e: FormSubmitEvent<FullSchema>) {
  processing.value = true
  try {
    const parsed = pageSchema.value.safeParse({ ...state, ...phone })
    if (!parsed.success) {
      toast.add({ title: 'Validation Error', description: 'Please check all required fields', color: 'error' })
      return
    }

    if (!selectedReseller.value) {
      toast.add({ title: 'Validation Error', description: 'Please select a default reseller', color: 'error' })
      return
    }

    // Build FormData
    const formData = new FormData()
    formData.append('agency_name', parsed.data.agencyName)
    formData.append('address', parsed.data.address)
    formData.append('logo', parsed.data.logo)
    formData.append('id_card_front', parsed.data.idCardFront)
    formData.append('id_card_back', parsed.data.idCardBack)
    formData.append('country_code', parsed.data.countryCode)
    formData.append('dial_code', parsed.data.dialCode)
    formData.append('phone', parsed.data.phone)
    formData.append('phone_e164', normalizePhone(parsed.data.dialCode, parsed.data.phone))
    formData.append('reseller_signature', selectedReseller.value.signature)
    formData.append('reseller_name', selectedReseller.value.name)
    formData.append('reseller_contact', selectedReseller.value.contact)

    try {
      await submit({
        endpoint: '/api/agency/create',
        method: 'POST',
        body: formData,
        asFormData: true,
        retryPost: false
      })

      toast.add({ title: 'Success', description: 'Agency registration submitted for review', color: 'success' })
      console.log('Form payload →', parsed.data)
      
      // Navigate after success
      setTimeout(() => navigateTo('/agency/owner'), 3000)
    } catch (error: unknown) {
      const n = mapError(error)
      toast.add({ title: 'Error', description: n.message, color: 'error' })
    }
  } finally {
    processing.value = false
  }
}
</script>

<template>
  <main>
    <NavAlt back-to="/agency/list">Create New Agency</NavAlt>

    <div class="px-3 py-14 space-y-6">
      <UForm :schema="pageSchema" :state="{ ...state, ...phone }" class="space-y-6" @submit="onSubmit">
        <!-- Agency Name -->
        <UFormField label="Agency Name" name="agencyName" required>
          <template #hint>
            <p class="text-xs text-muted">Cannot be modified once created</p>
          </template>
          <UInput
            v-model="state.agencyName"
            class="w-full"
            size="lg"
            icon="i-lucide-building-2"
            placeholder="Choose a name less than 30 characters"
            :maxlength="30"
          />
        </UFormField>

        <!-- Country and Phone (using country-phone-input component) -->
        <FormsCountryPhoneInput
          :countries="countries || []"
          :initial-country="countries?.find((c: Country) => c.code === phone.countryCode)"
          :detecting-location="detectingLocation || status === 'pending'"
          @update:model="Object.assign(phone, $event)"
        />

        <!-- Logo Upload -->
        <UFormField
            label="Add a Logo for your Agency"
            name="logo"
            required
        >
          <UFileUpload
            v-model="state.logo"
            color="primary"
            accept="image/*"
            :disabled="processing"
            label="Drop your Agencies Logo here"
            description="SVG, PNG, JPG (max. 2MB)"
            class="w-full min-h-40"
            highlight
          />
        </UFormField>

        <!-- Address -->
        <UFormField label="Address" name="address" required>
          <template #hint>
            <p class="text-xs text-muted">Cannot be modified once created</p>
          </template>
          <UInput
            v-model="state.address"
            class="w-full"
            size="lg"
            icon="i-lucide-map-pin"
            placeholder="Add your current address"
          />
        </UFormField>

        <!-- ID Card Front -->
        <UFormField label="Upload the front Side of your ID Card" name="idCardFront" required>
          <UFileUpload
            v-model="state.idCardFront"
            color="primary"
            accept="image/*"
            :disabled="processing"
            label="Make Sure It's clear and fully readable"
            description="SVG, PNG, JPG or GIF (max. 2MB). Make sure it's clear and fully readable"
            class="w-full min-h-40"
            highlight
          />
        </UFormField>

        <!-- ID Card Back -->
        <UFormField label="Upload the Back Side of your ID Card" name="idCardBack" required>
          <UFileUpload
            v-model="state.idCardBack"
            color="primary"
            accept="image/*"
            :disabled="processing"
            label="Make Sure It's clear and fully readable"
            description="SVG, PNG, JPG or GIF (max. 2MB). Make sure it's clear and fully readable"
            class="w-full min-h-40"
            highlight
          />
        </UFormField>

        <!-- Default Reseller -->
        <ChooseDefaultReseller
          color="primary"
          @update:selected="selectedReseller = $event"
        />

        <!-- Submit Button -->
        <UButton
          type="submit"
          size="xl"
          class="w-full justify-center"
          icon="i-lucide-send"
          :loading="processing"
          :disabled="!isValid"
          color="primary"
        >
          Submit For Review
        </UButton>
      </UForm>
    </div>
  </main>
</template>

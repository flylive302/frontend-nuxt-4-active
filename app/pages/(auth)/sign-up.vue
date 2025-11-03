<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent, SelectItem } from '@nuxt/ui'
import { CalendarDate } from '@internationalized/date'
import { computed, onMounted, reactive, ref } from 'vue'
import { useLazyFetch } from 'nuxt/app'
import { localFetch } from '~/utils/http'
import type { Country, PhoneModel } from '~/composables/usePhoneSchema'
import { usePhoneSchema, normalizePhone } from '~/composables/usePhoneSchema'
import { useGeolocation } from '~/composables/useGeolocation'

definePageMeta({ layout: 'auth' })

// ---------- schema ----------
const baseSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  gender: z.string().min(1, 'Please select a gender'),
  email: z.email('Invalid email'),
  password: z.string().min(8, 'Must be at least 8 characters'),
  dateOfBirth: z.custom<CalendarDate>(
      (val) => val instanceof CalendarDate,
      { message: 'Please select a valid date of birth' }
  ).refine((date) => {
    const today = new Date()
    const birth = date.toDate('UTC')
    const age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    const adj = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate()) ? age - 1 : age
    return adj >= 18
  }, { message: 'You must be at least 18 years old' }),
})

type BaseSchema = z.output<typeof baseSchema>

// ---------- reactive state ----------
const state = reactive<Partial<BaseSchema>>({
  name: undefined,
  gender: undefined,
  email: undefined,
  password: undefined,
  dateOfBirth: undefined as CalendarDate | undefined,
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

// ---------- gender dropdown ----------
const genderOptions: SelectItem[] = [
  { label: 'Male', value: 'male', icon: 'i-lucide-mars' },
  { label: 'Female', value: 'female', icon: 'i-lucide-venus' },
  { label: 'Non-binary', value: 'non_binary', icon: 'i-lucide-non-binary' },
  { label: 'Prefer not to say', value: 'not_specified', icon: 'i-lucide-help-circle' },
]
const selectedIcon = computed(() =>
    genderOptions.find(o => o?.value === state.gender)?.icon ?? 'i-lucide-venus-and-mars'
)

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

async function onSubmit(e: FormSubmitEvent<FullSchema>) {
  const parsed = pageSchema.value.safeParse({ ...state, ...phone })
  if (!parsed.success) return
  const e164 = normalizePhone(phone.dialCode, phone.phone)
  toast.add({ title: 'Success', description: `Phone: ${e164}`, color: 'success' })
  console.log('Form payload →', parsed.data)
}
</script>

<template>
  <div>
    <UForm :schema="pageSchema" :state="{ ...state, ...phone }" class="space-y-3" @submit="onSubmit">
      <UFormField label="Name" name="name" required>
        <UInput v-model="state.name" class="w-full" size="lg" icon="i-lucide-user-pen" placeholder="Enter your full name" />
      </UFormField>

      <!-- integrated country + phone -->
      <FormsCountryPhoneInput
          v-if="countries"
          :countries="countries"
          :initial-country="countries.find(c => c.code === phone.countryCode)"
          :detecting-location="detectingLocation || status === 'pending'"
          @update:model="Object.assign(phone, $event)"
      />

      <UFormField label="Gender" name="gender" required>
        <USelect
            v-model="state.gender" class="w-full"
            :items="genderOptions"
            :icon="selectedIcon"
            size="lg"
            placeholder="Select your gender"
        />
      </UFormField>

      <UFormField label="Date of Birth" name="dateOfBirth" required>
        <UPopover>
          <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-calendar"
              size="lg"
              class="justify-start text-dimmed"
              block
          >
            {{ state.dateOfBirth ? state.dateOfBirth.toString() : 'Select date of birth' }}
          </UButton>
          <template #content>
            <UCalendar v-model="state.dateOfBirth" class="p-2" />
          </template>
        </UPopover>
      </UFormField>

      <UFormField label="Email" name="email" required>
        <UInput v-model="state.email" class="w-full" size="lg" icon="i-lucide-at-sign" placeholder="email@example.com" />
      </UFormField>

      <UFormField label="Password" name="password" required>
        <UInput v-model="state.password" class="w-full" size="lg" icon="i-lucide-lock" type="password" placeholder="********" />
      </UFormField>

      <UButton type="submit" size="xl" class="w-full justify-center" :disabled="!isValid">
        Submit
      </UButton>
    </UForm>
  </div>
</template>

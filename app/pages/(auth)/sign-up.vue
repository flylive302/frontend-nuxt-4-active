<script setup lang="ts">
import { z } from 'zod'
import type {FormSubmitEvent, SelectItem} from '@nuxt/ui'
import { CalendarDate } from '@internationalized/date'
import {computed, onMounted, reactive, ref } from "vue"
import { useLazyFetch } from "nuxt/app"

definePageMeta({
  layout: 'auth',
})

const schema = z.object({
  name: z.string('Invalid name'),
  gender: z.string().min(1, 'Please select a gender'),
  email: z.email('Invalid email'),
  password: z.string('Password is required').min(8, 'Must be at least 8 characters'),
  country: z.object({
    name: z.string(),
    code: z.string(),
    flag: z.string(),
    dial_code: z.string(),
  }).refine(country => country.code !== '', {
    message: 'Please select a country'
  }),
  dateOfBirth: z.custom<CalendarDate>(
      (val) => val instanceof CalendarDate,
      { message: 'Please select a valid date of birth' }
  ).refine(
      (date) => {
        // Ensure the person is at least 18 years old
        const today = new Date()
        const birthDate = date.toDate('UTC')
        const age = today.getFullYear() - birthDate.getFullYear()
        const monthDiff = today.getMonth() - birthDate.getMonth()

        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          return age - 1 >= 18
        }
        return age >= 18
      },
      { message: 'You must be at least 18 years old' }
  )
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  name: undefined,
  gender: undefined,
  email: undefined,
  password: undefined,
  country: undefined,
  dateOfBirth: undefined as CalendarDate | undefined
})

// Fetch countries from your JSON file
const { data: countries, status } = await useLazyFetch<{
  name: string
  code: string
  flag: string
  dial_code: string

}[]>('/countries.json', {
  immediate: true
})

// Auto-detect user's country based on location
const detectingLocation = ref(false)

onMounted(async () => {
  detectingLocation.value = true

  try {
    // Call your server API instead of external API directly
    const response = await $fetch<{ country_code: string | null }>('/api/detect-country')

    if (response.country_code && countries.value) {
      const detectedCountry = countries.value.find(
          c => c.code.toUpperCase() === response.country_code?.toUpperCase()
      )

      if (detectedCountry) {
        state.country = detectedCountry
      }
    }
  } catch (error) {
    console.error('Failed to detect location:', error)
  } finally {
    detectingLocation.value = false
  }
})

const genderOptions: SelectItem[] = [
  {
    label: 'Male',
    value: 'male',
    icon: 'i-lucide-mars'
  },
  {
    label: 'Female',
    value: 'female',
    icon: 'i-lucide-venus'
  },
  {
    label: 'Non-binary',
    value: 'non_binary',
    icon: 'i-lucide-non-binary'
  },
  {
    label: 'Prefer not to say',
    value: 'not_specified',
    icon: 'i-lucide-help-circle'
  }
]

// Compute the icon based on selected value
const selectedIcon = computed(() => {
  if (!state.gender) {
    return 'i-lucide-venus-and-mars' // Default icon
  }
  return genderOptions.find(option => option?.value === state.gender)?.icon
})

// Set max date to today (can't be born in the future)
const maxDate = new CalendarDate(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    new Date().getDate()
)

const toast = useToast()
async function onSubmit(event: FormSubmitEvent<Schema>) {
  toast.add({ title: 'Success', description: 'The form has been submitted.', color: 'success' })
  console.log(event.data)
}
</script>

<template>
  <div>
    <UForm :schema="schema" :state="state" class="space-y-2 form" @submit="onSubmit">
      <UFormField label="Name" name="name" required>
        <UInput v-model="state.name" size="lg" icon="i-lucide-user-pen" placeholder="Enter Your Full Name" class="w-full" />
      </UFormField>

      <UFormField label="Country" name="country" required>
        <USelectMenu
            v-model="state.country"
            :items="countries"
            :loading="status === 'pending' || detectingLocation"
            label-key="name"
            placeholder="Select your country"
            :search-input="{ icon: 'i-lucide-search', placeholder: 'Search countries...' }"
            class="w-full"
            size="lg"
        >
          <template #leading="{ modelValue }">
          <span v-if="modelValue" class="size-5">
            {{ modelValue.flag }}
          </span>
            <UIcon v-else name="i-lucide-earth" class="size-5" />
          </template>

          <template #item-leading="{ item }">
          <span class="size-5 bg-elevated">
            {{ item.flag }}
          </span>
          </template>
        </USelectMenu>
      </UFormField>

      <UFormField label="Gender" name="gender" required>
        <USelect
            v-model="state.gender"
            :items="genderOptions"
            :icon="selectedIcon"
            size="lg"
            placeholder="Select your gender"
            class="w-full"
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
            <UCalendar
                v-model="state.dateOfBirth"
                :max-value="maxDate"
                class="p-2"
            />
          </template>
        </UPopover>
      </UFormField>

      <UFormField label="Email" name="email" required>
        <UInput v-model="state.email" size="lg" icon="i-lucide-at-sign" placeholder="email@example.com" class="w-full" />
      </UFormField>

      <UFormField label="Password" name="password" required>
        <UInput v-model="state.password" size="lg" icon="i-lucide-lock" type="password" placeholder="********" class="w-full" />
      </UFormField>

      <UButton type="submit" icon="i-lucide-signature" size="xl" class="w-full justify-center">
        Submit
      </UButton>
    </UForm>
  </div>
</template>
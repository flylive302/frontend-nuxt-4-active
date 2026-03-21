<script setup lang="ts">
import { z } from 'zod'
import { CalendarDate, type DateValue, getLocalTimeZone, today } from '@internationalized/date'
import { useAuthForm } from '~/composables/auth/useAuthForm'
import type { Form } from '@nuxt/ui'
import type { Country } from '~/composables/auth/usePhoneSchema'

import type {UpdateProfilePayload, GenderOption} from "~/types/user/auth";

definePageMeta({
  layout: 'auth',
  middleware: ['profile-completion']
})

const MINIMUM_AGE_REQUIREMENT = 18 as const
const DEFAULT_CALENDAR_YEAR = 2000 as const
const DEFAULT_CALENDAR_MONTH = 1 as const
const DEFAULT_CALENDAR_DAY = 1 as const

const GENDER_MALE = 1 as const
const GENDER_FEMALE = 2 as const
const GENDER_NON_BINARY = 3 as const
const GENDER_PREFER_NOT_TO_SAY = 4 as const

const ICON_MARS = 'i-lucide-mars' as const
const ICON_VENUS = 'i-lucide-venus' as const
const ICON_NON_BINARY = 'i-lucide-non-binary' as const
const ICON_HELP_CIRCLE = 'i-lucide-help-circle' as const
const ICON_DEFAULT_GENDER = 'i-lucide-venus-and-mars' as const

const INVALID_FLAG_CODES = new Set(['an'])
const DEFAULT_FLAG_ICON = 'i-lucide-earth'

const genderOptions: GenderOption[] = [
  { label: 'Male', value: GENDER_MALE, icon: ICON_MARS },
  { label: 'Female', value: GENDER_FEMALE, icon: ICON_VENUS },
  { label: 'Non-binary', value: GENDER_NON_BINARY, icon: ICON_NON_BINARY },
  { label: 'Prefer not to say', value: GENDER_PREFER_NOT_TO_SAY, icon: ICON_HELP_CIRCLE },
]

const calendarDefaultDate = new CalendarDate(
  DEFAULT_CALENDAR_YEAR,
  DEFAULT_CALENDAR_MONTH,
  DEFAULT_CALENDAR_DAY
)

const authStore = useAuthStore()

// ========================================
// Determine which fields are missing
// ========================================

const needsGender = computed(() => authStore.user?.gender == null)
const needsEmail = computed(() => !authStore.user?.email)
const needsDateOfBirth = computed(() => !authStore.user?.date_of_birth)
const needsCountry = computed(() => !authStore.user?.country)
const needsAvatar = computed(() => !authStore.user?.avatar)

/** True when there are fields the user still needs to fill in */
const hasMissingFields = computed(() =>
  needsGender.value || needsEmail.value || needsDateOfBirth.value || needsCountry.value
)

// ========================================
// Dynamic Zod Schema — only validates shown fields
// ========================================

const formSchema = computed(() => {
  const shape: Record<string, z.ZodTypeAny> = {}

  if (needsGender.value) {
    shape.gender = z.number().min(1, 'Please select a gender')
  }

  if (needsEmail.value) {
    shape.email = z.string().email('Invalid email')
  }

  if (needsDateOfBirth.value) {
    shape.dateOfBirth = z
      .custom<DateValue>(
        (value) => value instanceof CalendarDate,
        { message: 'Please select a valid date of birth' }
      )
      .refine(
        (selectedDate) => {
          const now = today(getLocalTimeZone())
          let age = now.year - selectedDate.year
          if (
            now.month < selectedDate.month ||
            (now.month === selectedDate.month && now.day < selectedDate.day)
          ) {
            age--
          }
          return age >= MINIMUM_AGE_REQUIREMENT
        },
        { message: `You must be at least ${MINIMUM_AGE_REQUIREMENT} years old` }
      )
  }

  if (needsCountry.value) {
    shape.country = z.string().min(2, 'Please select a country')
  }

  return z.object(shape)
})


// ========================================
// Form State
// ========================================

const formState = reactive<Record<string, any>>({
  gender: undefined,
  email: '',
  dateOfBirth: null as DateValue | null,
  country: '',
})

const dateOfBirthModel = ref<CalendarDate | undefined>(undefined)

const calendarModel = computed({
  get: () => dateOfBirthModel.value as DateValue | undefined,
  set: (value: DateValue | undefined) => {
    dateOfBirthModel.value = value as CalendarDate | undefined
  }
})

watchEffect(() => {
  dateOfBirthModel.value = (formState.dateOfBirth as CalendarDate | null) ?? undefined
})

watch(dateOfBirthModel, (value) => {
  formState.dateOfBirth = value ?? null
})

// ========================================
// Country Picker (standalone, no phone)
// ========================================

const { countries, loading: countriesLoading, ensureLoaded, detectIfAllowed } = useCountries()

const selectedCountry = ref<Country | undefined>(undefined)

function getFlagIconName(code: string): string {
  const normalized = (code || '').toLowerCase()
  if (INVALID_FLAG_CODES.has(normalized)) return DEFAULT_FLAG_ICON
  return `i-flag-${normalized}-4x3`
}

function onCountryChange(country: Country | undefined): void {
  if (!country) return
  selectedCountry.value = country
  formState.country = country.code
}

onMounted(async () => {
  if (needsCountry.value) {
    await ensureLoaded()
    const detected = await detectIfAllowed()
    if (detected) {
      onCountryChange(detected)
    }
  }
})

// ========================================
// Gender Icon
// ========================================

const selectedGenderIcon = computed<string>(() => {
  const matchedOption = genderOptions.find(
    (option) => option.value === formState.gender
  )
  return matchedOption?.icon ?? ICON_DEFAULT_GENDER
})

// ========================================
// Avatar Upload
// ========================================

const formRef = ref<Form<any> | null>(null)
const { updateProfile, uploadAvatar } = useProfileActions()

const { isSubmitting: isProcessingSubmit, generalError, handleSubmit, getFieldError } = useAuthForm({
  formRef,
})

const emailError = computed(() => getFieldError('email'))
const genderError = computed(() => getFieldError('gender'))
const dateOfBirthError = computed(() => getFieldError('dateOfBirth') || getFieldError('date_of_birth'))
const countryError = computed(() => getFieldError('country'))

const isUploadingAvatar = ref(false)
const toast = useToast()

const avatarUrl = computed<string | null>(() => {
  return authStore.user?.avatar ?? null
})

async function handleAvatarSelected(file: File) {
  try {
    isUploadingAvatar.value = true
    await uploadAvatar(file)
  } catch {
    toast.add({
      title: 'Upload Failed',
      description: 'Failed to upload avatar. Please try again.',
      color: 'error',
    })
  } finally {
    isUploadingAvatar.value = false
  }
}

// ========================================
// Form Submission
// ========================================

async function handleFormSubmit(): Promise<void> {
  await handleSubmit(async () => {
    const profilePayload = buildProfileUpdatePayload()
    await updateProfile(profilePayload)
    await navigateTo('/')
  })
}

function buildProfileUpdatePayload(): UpdateProfilePayload {
  const payload: UpdateProfilePayload = {}

  if (needsGender.value && formState.gender !== undefined) {
    payload.gender = formState.gender
  }
  if (needsEmail.value && formState.email) {
    payload.email = formState.email
  }
  if (needsDateOfBirth.value && formState.dateOfBirth) {
    payload.date_of_birth = formState.dateOfBirth.toString()
  }
  if (needsCountry.value && formState.country) {
    payload.country = formState.country
  }

  return payload
}

</script>


<template>
  <main>
    <UAlert 
      v-if="generalError" 
      :description="generalError" 
      color="error" 
      variant="soft"
      title="Update Failed" 
      class="mb-4" 
      icon="i-lucide-alert-circle" 
    />

    <SectionTitle class="my-3">Complete your Profile</SectionTitle>

    <!-- Avatar + Welcome Section — always shown -->
    <div class="my-3 flex gap-2">
      <FileUpload
        v-if="needsAvatar"
        :current-image="avatarUrl"
        :loading="isUploadingAvatar"
        crop
        @file-selected="handleAvatarSelected"
      />
      <div>
        <h1 class="text-md font-semibold text-white">
          Hy! {{authStore.user?.name}}. here is your Signature
          <UBadge color="success" variant="soft" icon="i-lucide-pen-tool" class="text-success-200 text-md font-semibold">{{authStore.user?.signature}}</UBadge>
        </h1>
        <p v-if="needsAvatar" class="text-sm text-warning-400"> <UIcon name="i-lucide-arrow-left" class="animate-pulse"/> You may Please Upload your profile picture from the input on left.</p>
      </div>
    </div>

    <!-- If all required fields are filled, show a success message -->
    <div v-if="!hasMissingFields" class="text-center py-8">
      <UIcon name="i-lucide-check-circle" class="size-12 text-success mb-4" />
      <p class="text-lg text-success-400 font-semibold">Your profile is complete!</p>
      <UButton class="mt-4" variant="solid" color="primary" @click="navigateTo('/', { replace: true })">
        Continue to App
      </UButton>
    </div>

    <!-- Dynamic form: only shows missing fields -->
    <UForm
      v-else
      ref="formRef"
      :schema="formSchema"
      :state="formState"
      class="space-y-3"
      @submit="handleFormSubmit"
    >
      <!-- Gender -->
      <UFormField v-if="needsGender" label="Gender" name="gender" required :error="genderError">
        <USelect 
          v-model.number="formState.gender" 
          :items="genderOptions" 
          :icon="selectedGenderIcon" 
          class="w-full"
          size="lg" placeholder="Select your gender" 
          option-attribute="label" value-attribute="value"
        />
      </UFormField>

      <!-- Date of Birth -->
      <UFormField v-if="needsDateOfBirth" label="Date of Birth" name="dateOfBirth" required :error="dateOfBirthError">
        <UPopover>
          <UButton 
            color="neutral" 
            variant="outline" 
            icon="i-lucide-calendar" 
            size="lg"
            class="justify-start text-dimmed" block
          >
            {{ formState.dateOfBirth ? formState.dateOfBirth.toString() : 'Select date of birth' }}
          </UButton>
          <template #content>
            <UCalendar
              v-model="calendarModel"
              :default-placeholder="calendarDefaultDate"
              class="p-2"
            />
          </template>
        </UPopover>
      </UFormField>

      <!-- Email -->
      <UFormField v-if="needsEmail" label="Email" name="email" required :error="emailError">
        <UInput 
          v-model="formState.email" 
          class="w-full" 
          size="lg" 
          icon="i-lucide-at-sign"
          placeholder="email@example.com" 
        />
      </UFormField>

      <!-- Country -->
      <UFormField v-if="needsCountry" label="Country" name="country" required :error="countryError">
        <USelectMenu
          v-model="selectedCountry"
          :items="(countries as Country[])"
          :loading="countriesLoading"
          virtualize
          label-key="name"
          placeholder="Select your country"
          :search-input="{ icon: 'i-lucide-search', placeholder: 'Search countries...' }"
          size="lg"
          class="w-full"
          @update:model-value="onCountryChange"
        >
          <template #leading>
            <UIcon
              v-if="selectedCountry?.code"
              :name="getFlagIconName(selectedCountry.code)"
              class="size-5 rounded overflow-hidden h-4"
            />
            <UIcon v-else :name="DEFAULT_FLAG_ICON" />
          </template>

          <template #item-leading="{ item }">
            <UIcon
              v-if="(item as Country)?.code"
              :name="getFlagIconName((item as Country).code)"
              class="size-5 rounded overflow-hidden h-4"
            />
          </template>

          <template #item-label="{ item }">
            <template v-if="item">
              {{ (item as Country).name }}
            </template>
          </template>
        </USelectMenu>
      </UFormField>

      <UButton 
        :loading="isProcessingSubmit" 
        type="submit" 
        size="xl" 
        icon="i-lucide-send"
        class="w-full justify-center disabled:bg-primary-400"
      >
        Submit
      </UButton>
    </UForm>
  </main>
</template>

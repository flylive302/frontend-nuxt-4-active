<script setup lang="ts">
import { z } from 'zod'
import { CalendarDate, type DateValue, getLocalTimeZone, today } from '@internationalized/date'
import { useAuthForm } from '~/composables/auth/useAuthForm'
import type { Form } from '@nuxt/ui'

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

const formSchema = z.object({
  gender: z.number().min(1, 'Please select a gender'),
  email: z.email('Invalid email'),
  dateOfBirth: z
    .custom<DateValue>(
      (value) => value instanceof CalendarDate,
      { message: 'Please select a valid date of birth' }
    )
    .refine(
      (selectedDate) => {
        // Use @internationalized/date for consistent comparison
        // This avoids timezone issues by comparing calendar dates directly
        const now = today(getLocalTimeZone())

        // Calculate age based on year difference
        let age = now.year - selectedDate.year

        // Adjust if birthday hasn't occurred yet this year
        // Compare (month, day) tuples
        if (
          now.month < selectedDate.month ||
          (now.month === selectedDate.month && now.day < selectedDate.day)
        ) {
          age--
        }

        return age >= MINIMUM_AGE_REQUIREMENT
      },
      { message: `You must be at least ${MINIMUM_AGE_REQUIREMENT} years old` }
    ),
})

type FormSchema = z.infer<typeof formSchema>

type FormState = Partial<Omit<FormSchema, 'dateOfBirth'>> & { dateOfBirth: DateValue | null }

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

const formState = reactive<FormState>({
  gender: undefined,
  email: '',
  dateOfBirth: null,
})

const dateOfBirthModel = ref<CalendarDate | undefined>(undefined)

// Computed wrapper for UCalendar v-model compatibility
// UCalendar expects DateValue from @nuxt/ui, but we use CalendarDate from @internationalized/date
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

const formRef = ref<Form<FormSchema> | null>(null)

const authStore = useAuthStore()
const { updateProfile, uploadAvatar } = useAuth()

const { isSubmitting: isProcessingSubmit, generalError, handleSubmit, getFieldError } = useAuthForm({
  formRef,
})

const emailError = computed(() => getFieldError('email'))
const genderError = computed(() => getFieldError('gender'))
const dateOfBirthError = computed(() => getFieldError('dateOfBirth') || getFieldError('date_of_birth'))

/**
 * Determines the icon to display based on the selected gender option.
 */
const selectedGenderIcon = computed<string>(() => {
  const matchedOption = genderOptions.find(
    (option) => option.value === formState.gender
  )
  return matchedOption?.icon ?? ICON_DEFAULT_GENDER
})

const isUploadingAvatar = ref(false)
const toast = useToast()

/**
 * User's avatar URL (BootstrapUser.avatar is now a string directly).
 */
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

/**
 * Handles form submission by validating data, preparing the API payload,
 * and updating the user's profile information.
 */
async function handleFormSubmit(): Promise<void> {
  await handleSubmit(async () => {
    const profilePayload = buildProfileUpdatePayload(formState as FormSchema)
    await updateProfile(profilePayload)
    await navigateTo('/')
  })
}

/**
 * Builds the profile update payload from validated form data.
 */
function buildProfileUpdatePayload(validatedFormData: FormSchema): UpdateProfilePayload {
  return {
    gender: validatedFormData.gender,
    email: validatedFormData.email,
    date_of_birth: validatedFormData.dateOfBirth.toString(),
  }
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


    <div class="my-3 flex gap-2">
      <FileUpload
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
        <p class="text-sm text-warning-400"> <UIcon name="i-lucide-arrow-left" class="animate-pulse"/> You may Please Upload your profile picture from the input on left.</p>
      </div>
    </div>

    <UForm
      ref="formRef"
      :schema="formSchema"
      :state="{ ...formState, dateOfBirth: formState.dateOfBirth ?? undefined } as Partial<FormSchema>"
      class="space-y-3"
      @submit="handleFormSubmit"
    >
      <UFormField label="Gender" name="gender" required :error="genderError">
        <USelect 
          v-model.number="formState.gender" 
          :items="genderOptions" 
          :icon="selectedGenderIcon" 
          class="w-full"
          size="lg" placeholder="Select your gender" 
          option-attribute="label" value-attribute="value"
        />
      </UFormField>

      <UFormField label="Date of Birth" name="dateOfBirth" required :error="dateOfBirthError">
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

      <UFormField label="Email" name="email" required :error="emailError">
        <UInput 
          v-model="formState.email" 
          class="w-full" 
          size="lg" 
          icon="i-lucide-at-sign"
          placeholder="email@example.com" 
        />
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


<script setup lang="ts">
import { z } from 'zod'
import { CalendarDate, type DateValue, getLocalTimeZone, today } from '@internationalized/date'
import { useAuthForm } from '~/composables/useAuthForm'
import type { Form } from '@nuxt/ui'
import FileUpload from "~/components/common/FileUpload.vue";
import type {UpdateProfilePayload, GenderOption} from "~/types/auth";

definePageMeta({
  layout: 'alt',
  middleware: 'auth'
})

const MINIMUM_AGE_REQUIREMENT = 18 as const
const SIGNATURE_MAX_LENGTH = 100 as const
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
  signature: z
      .string()
      .max(SIGNATURE_MAX_LENGTH, `Signature must be less than ${SIGNATURE_MAX_LENGTH} characters`)
      .optional(),
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

const formState = reactive<Partial<FormSchema>>({
  gender: undefined,
  email: '',
  signature: '',
  dateOfBirth: undefined,
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
const signatureError = computed(() => getFieldError('signature'))

/**
 * Retrieves the initial signature value from the authenticated user's profile.
 */
const initialUserSignature = computed<string | undefined>(() => {
  return authStore.user?.signature ?? undefined
})

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
 * Normalizes the user's avatar to a string URL.
 * Extracts the original URL from the Avatar object.
 */
const avatarUrl = computed<string | null>(() => {
  const avatar = authStore.user?.avatar
  if (!avatar) return null

  return avatar.original ?? null
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
  const payload: UpdateProfilePayload = {
    gender: validatedFormData.gender,
    email: validatedFormData.email,
    date_of_birth: validatedFormData.dateOfBirth.toString(),
  }

  // Only include signature in payload if it has been changed
  if (validatedFormData.signature !== initialUserSignature.value) {
    payload.signature = validatedFormData.signature
  }

  return payload
}

// Initialize form state with existing user data
// Watch for user data to be available (in case of race condition or late load)
watch(
    () => authStore.user,
    (user) => {
      if (!user) return

      // Initialize signature if empty
      if (user.signature && !formState.signature) {
        formState.signature = user.signature
      }

      // Initialize gender if empty
      if (user.gender !== null && user.gender !== undefined && formState.gender === undefined) {
        formState.gender = user.gender
      }

      // Initialize email if empty
      if (user.email && !formState.email) {
        formState.email = user.email
      }

      // Initialize dateOfBirth if empty
      if (user.date_of_birth && !formState.dateOfBirth) {
        try {
          // Parse date string (expected format: YYYY-MM-DD)
          const dateParts = user.date_of_birth.split('-')
          if (dateParts.length === 3) {
            const yearStr = dateParts[0]
            const monthStr = dateParts[1]
            const dayStr = dateParts[2]
            if (yearStr && monthStr && dayStr) {
              const year = parseInt(yearStr, 10)
              const month = parseInt(monthStr, 10)
              const day = parseInt(dayStr, 10)
              if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
                formState.dateOfBirth = new CalendarDate(year, month, day)
              }
            }
          }
        } catch (error) {
          // Silently fail if date parsing fails
          console.error('Failed to parse date_of_birth:', error)
        }
      }
    },
    { immediate: true }
)

</script>

<template>
  <main>
    <NavAlt back-to="/profile">Edit Profile</NavAlt>
    <div class="h-20" />
    <div class="px-3">
      <UAlert
          v-if="generalError"
          :description="generalError"
          color="error"
          variant="soft"
          title="Update Failed"
          class="mb-4"
          icon="i-lucide-alert-circle"
      />

      <div class="mb-2">
        <FileUpload
            :current-image="avatarUrl"
            :loading="isUploadingAvatar"
            crop
            @file-selected="handleAvatarSelected"
        />
        <p class="text-lg text-center font-semibold mt-2">Upload Profile Picture</p>
      </div>

      <UForm ref="formRef" :schema="formSchema" :state="(formState as Partial<FormSchema>)" class="space-y-3" @submit="handleFormSubmit">
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
              <UCalendar v-model="(formState.dateOfBirth as DateValue | undefined)" :default-placeholder="calendarDefaultDate" class="p-2" />
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

        <UFormField label="Signature" name="signature" :error="signatureError">
          <UInput
              v-model="formState.signature"
              class="w-full"
              size="lg"
              icon="i-lucide-pen-tool"
              placeholder="Enter your signature"
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
    </div>
  </main>
</template>

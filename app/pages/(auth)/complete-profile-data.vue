<script setup lang="ts">
// ========================================
// Imports & Types
// ========================================
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { CalendarDate, type DateValue } from '@internationalized/date'
import { computed, reactive, ref } from 'vue'

// ========================================
// Page Configuration
// ========================================
definePageMeta({
  layout: 'auth',
})

// ========================================
// Constants
// ========================================
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

// ========================================
// Validation Schema
// ========================================
const formSchema = z.object({
  gender: z.number().min(1, 'Please select a gender'),
  email: z.string().email('Invalid email'),
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
        const currentDate = new Date()
        const birthDate = selectedDate.toDate('UTC')
        const calculatedAge = currentDate.getFullYear() - birthDate.getFullYear()
        const monthDifference = currentDate.getMonth() - birthDate.getMonth()

        // Adjust age if birthday hasn't occurred yet this year
        const hasNotHadBirthdayThisYear =
          monthDifference < 0 ||
          (monthDifference === 0 && currentDate.getDate() < birthDate.getDate())

        const adjustedAge = hasNotHadBirthdayThisYear ? calculatedAge - 1 : calculatedAge

        return adjustedAge >= MINIMUM_AGE_REQUIREMENT
      },
      { message: `You must be at least ${MINIMUM_AGE_REQUIREMENT} years old` }
    ),
})

// ========================================
// Types
// ========================================
type FormSchema = z.infer<typeof formSchema>

interface GenderOption {
  readonly label: string
  readonly value: number
  readonly icon: string
}

interface ProfileUpdatePayload {
  gender: number
  email: string
  date_of_birth: string
  signature?: string
}

// ========================================
// Component State
// ========================================
const genderOptions: readonly GenderOption[] = [
  { label: 'Male', value: GENDER_MALE, icon: ICON_MARS },
  { label: 'Female', value: GENDER_FEMALE, icon: ICON_VENUS },
  { label: 'Non-binary', value: GENDER_NON_BINARY, icon: ICON_NON_BINARY },
  { label: 'Prefer not to say', value: GENDER_PREFER_NOT_TO_SAY, icon: ICON_HELP_CIRCLE },
] as const

const calendarDefaultDate = new CalendarDate(
  DEFAULT_CALENDAR_YEAR,
  DEFAULT_CALENDAR_MONTH,
  DEFAULT_CALENDAR_DAY
)

const formState = reactive<Partial<FormSchema>>({
  gender: undefined,
  email: undefined,
  signature: undefined,
  dateOfBirth: undefined,
})

const isProcessingSubmit = ref<boolean>(false)

// ========================================
// Composables / Injected Dependencies
// ========================================
const authStore = useAuthStore()
const { updateProfile } = useAuth()
const { normalizeError } = useApi()
const toast = useToast()

// ========================================
// Computed Properties
// ========================================
/**
 * Retrieves the initial signature value from the authenticated user's profile.
 * @returns The user's existing signature or undefined if not set.
 */
const initialUserSignature = computed<string | undefined>(() => {
  return authStore.user?.signature ?? undefined
})

/**
 * Determines the icon to display based on the selected gender option.
 * @returns The icon identifier string for the selected gender, or default icon if none selected.
 */
const selectedGenderIcon = computed<string>(() => {
  const matchedOption = genderOptions.find(
    (option) => option.value === formState.gender
  )
  return matchedOption?.icon ?? ICON_DEFAULT_GENDER
})

/**
 * Validates the entire form state against the schema.
 * @returns True if all form fields are valid, false otherwise.
 */
const isFormValid = computed<boolean>(() => {
  const validationResult = formSchema.safeParse({ ...formState })
  return validationResult.success
})

// ========================================
// Event Handlers
// ========================================
/**
 * Handles form submission by validating data, preparing the API payload,
 * and updating the user's profile information.
 * @param _submitEvent - The form submit event (unused but required by type signature).
 */
async function handleFormSubmit(_submitEvent: FormSubmitEvent<FormSchema>): Promise<void> {
  isProcessingSubmit.value = true

  try {
    const validationResult = formSchema.safeParse({ ...formState })

    if (!validationResult.success) {
      return
    }

    const profilePayload = buildProfileUpdatePayload(validationResult.data)

    await updateProfile(profilePayload)

    navigateTo('/')
  } catch (error) {
    const normalizedError = normalizeError(error)
    toast.add({
      title: 'Error',
      description: normalizedError.message,
      color: 'error',
    })
  } finally {
    isProcessingSubmit.value = false
  }
}

// ========================================
// Helpers / Utilities
// ========================================
/**
 * Builds the profile update payload from validated form data.
 * Only includes signature if it has been modified from the initial value.
 * @param validatedFormData - The validated form data.
 * @returns The formatted payload ready for API submission.
 */
function buildProfileUpdatePayload(validatedFormData: FormSchema): ProfileUpdatePayload {
  const payload: ProfileUpdatePayload = {
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

// ========================================
// Lifecycle Hooks
// ========================================
/**
 * Initialize form state with existing user data on component mount.
 */
onMounted(() => {
  formState.signature = initialUserSignature.value
})
</script>

<template>
  <main>
    <UForm :schema="formSchema" :state="formState" class="space-y-3" @submit="handleFormSubmit">
      <UFormField label="Gender" name="gender" required>
        <USelect v-model="formState.gender" class="w-full" :items="genderOptions" :icon="selectedGenderIcon" size="lg"
          placeholder="Select your gender" />
      </UFormField>

      <UFormField label="Date of Birth" name="dateOfBirth" required>
        <UPopover>
          <UButton color="neutral" variant="outline" icon="i-lucide-calendar" size="lg"
            class="justify-start text-dimmed" block>
            {{ formState.dateOfBirth ? formState.dateOfBirth.toString() : 'Select date of birth' }}
          </UButton>
          <template #content>
            <UCalendar v-model="formState.dateOfBirth" :default-placeholder="calendarDefaultDate" class="p-2" />
          </template>
        </UPopover>
      </UFormField>

      <UFormField label="Email" name="email" required>
        <UInput v-model="formState.email" class="w-full" size="lg" icon="i-lucide-at-sign"
          placeholder="email@example.com" />
      </UFormField>

      <UFormField label="Signature" name="signature">
        <UInput v-model="formState.signature" class="w-full" size="lg" icon="i-lucide-pen-tool"
          placeholder="Enter your signature" />
      </UFormField>

      <UButton type="submit" size="xl" class="w-full justify-center disabled:bg-primary-400" icon="i-lucide-send"
        :loading="isProcessingSubmit" :disabled="!isFormValid">
        Submit
      </UButton>
    </UForm>
  </main>
</template>

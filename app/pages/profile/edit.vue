<script setup lang="ts">
import { z } from 'zod'
import { CalendarDate, type DateValue, getLocalTimeZone, today } from '@internationalized/date'
import { useAuthForm } from '~/composables/auth/useAuthForm'
import type { Form } from '@nuxt/ui'

import type {UpdateProfilePayload, GenderOption} from "~/types/user/auth";
import { createLogger } from '~/utils/logger';

const log = createLogger('[ProfileEdit]');

definePageMeta({
  layout: 'alt',
  middleware: 'auth'
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

const NAME_MIN_LENGTH = 2 as const
const NAME_MAX_LENGTH = 255 as const

const formSchema = z.object({
  name: z.string()
      .min(NAME_MIN_LENGTH, `Name must be at least ${NAME_MIN_LENGTH} characters`)
      .max(NAME_MAX_LENGTH, `Name must be at most ${NAME_MAX_LENGTH} characters`)
      .optional()
      .or(z.literal('')),
  gender: z.number().min(1, 'Please select a gender').optional(),
  email: z.email('Invalid email').optional().or(z.literal('')),
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
      )
      .optional(),
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
  name: '',
  gender: undefined,
  email: '',
  dateOfBirth: undefined,
})

const formRef = ref<Form<FormSchema> | null>(null)

const authStore = useAuthStore()
const { updateProfile, uploadAvatar } = useAuth()

const { isSubmitting: isProcessingSubmit, generalError, handleSubmit, getFieldError } = useAuthForm({
  formRef,
})

const nameError = computed(() => getFieldError('name'))
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

// ========================================
// Asset Management
// ========================================

const bootstrapStore = useBootstrapStore()
const showAssetModal = ref(false)

/**
 * Icon based on current asset download status.
 */
const assetStatusIcon = computed(() => {
  if (bootstrapStore.isDownloading) return 'i-lucide-loader-2'
  if (bootstrapStore.isDownloadComplete) return 'i-lucide-check-circle'
  return 'i-lucide-download'
})

/**
 * Icon color based on asset status.
 */
const assetStatusIconColor = computed(() => {
  if (bootstrapStore.isDownloading) return 'text-primary'
  if (bootstrapStore.isDownloadComplete) return 'text-success'
  return 'text-neutral-400'
})

/**
 * Title text for asset status.
 */
const assetStatusTitle = computed(() => {
  if (bootstrapStore.isDownloading) return 'Downloading...'
  if (bootstrapStore.isDownloadComplete) return 'All Downloaded'
  if (bootstrapStore.assetPhase === 'error') return 'Download Error'
  return 'Ready to Download'
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
  const payload: UpdateProfilePayload = {}

  if (validatedFormData.name) {
    payload.name = validatedFormData.name
  }
  if (validatedFormData.gender !== undefined) {
    payload.gender = validatedFormData.gender
  }
  if (validatedFormData.email) {
    payload.email = validatedFormData.email
  }
  if (validatedFormData.dateOfBirth) {
    payload.date_of_birth = validatedFormData.dateOfBirth.toString()
  }

  return payload
}

// Initialize form state with existing user data
// Watch for user data to be available (in case of race condition or late load)
watch(
    () => authStore.user,
    (user) => {
      if (!user) return

      // Initialize name if empty
      if (user.name && !formState.name) {
        formState.name = user.name
      }

      // Initialize gender if empty
      // BootstrapUser.gender is 'male' | 'female' | null, form uses numeric IDs
      if (user.gender !== null && formState.gender === undefined) {
        const GENDER_STRING_TO_NUMBER: Record<string, number> = {
          'male': GENDER_MALE,
          'female': GENDER_FEMALE,
        }
        formState.gender = GENDER_STRING_TO_NUMBER[user.gender] ?? undefined
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
          log.warn('Failed to parse date_of_birth:', error)
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
        <UFormField label="Name" name="name" :error="nameError">
          <UInput
              v-model="formState.name"
              class="w-full"
              size="lg"
              icon="i-lucide-user"
              placeholder="Enter your name"
          />
        </UFormField>

        <UFormField label="Gender" name="gender" :error="genderError">
          <USelect
              v-model.number="formState.gender"
              :items="genderOptions"
              :icon="selectedGenderIcon"
              class="w-full"
              size="lg" placeholder="Select your gender"
              option-attribute="label" value-attribute="value"
          />
        </UFormField>

        <UFormField label="Date of Birth" name="dateOfBirth" :error="dateOfBirthError">
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

        <UFormField label="Email" name="email" :error="emailError">
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

      <!-- Asset Management Section -->
      <div class="mt-8">
        <h3 class="text-lg font-semibold text-white mb-3">Asset Management</h3>
        
        <div class="rounded-lg bg-neutral-900 p-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-800">
                <UIcon 
                  :name="assetStatusIcon" 
                  :class="['h-5 w-5', assetStatusIconColor, bootstrapStore.isDownloading ? 'animate-spin' : '']" 
                />
              </div>
              <div>
                <p class="font-medium text-white">{{ assetStatusTitle }}</p>
                <p class="text-sm text-neutral-400">
                  {{ bootstrapStore.cachedAssetCount }} / {{ bootstrapStore.totalAssetCount }} assets
                </p>
              </div>
            </div>
            <UButton 
              variant="outline" 
              color="neutral"
              icon="i-lucide-settings"
              size="sm"
              @click="showAssetModal = true"
            >
              Manage
            </UButton>
          </div>
          
          <!-- Progress bar when downloading -->
          <div v-if="bootstrapStore.isDownloading" class="mt-3">
            <div class="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
              <div
                class="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-300 ease-out"
                :style="{ width: `${bootstrapStore.downloadPercent}%` }"
              />
            </div>
            <p class="mt-1 text-xs text-neutral-500">
              {{ bootstrapStore.downloadPercent }}% complete
            </p>
          </div>
        </div>
      </div>

      <!-- Asset Manager Modal -->
      <SystemAssetManagerModal v-model="showAssetModal" />
    </div>
  </main>
</template>


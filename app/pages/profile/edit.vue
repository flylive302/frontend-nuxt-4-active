<script setup lang="ts">
import { z } from 'zod'
import { CalendarDate, type DateValue, getLocalTimeZone, today } from '@internationalized/date'
import { useAuthForm } from '~/composables/auth/useAuthForm'
import { isValidE164Phone } from '~/composables/auth/usePhoneSchema'
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
  // Phone (E.164) and country (residence) are independent — neither is
  // validated against the other.
  country: z.string().optional().or(z.literal('')),
  phone: z.string()
    .refine(v => !v || isValidE164Phone(v), 'Enter a valid phone number')
    .optional()
    .or(z.literal('')),
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
  country: '',
  phone: '',
})

const formRef = ref<Form<FormSchema> | null>(null)

const authStore = useAuthStore()
const { updateProfile } = useProfileActions()
const { logout } = useAuthActions()
const showDeleteModal = ref(false)
const isFollowListPublic = ref(authStore.user?.is_follow_list_public ?? true)
const isSavingPrivacy = ref(false)

// ── Block list ────────────────────────────────────────
const showBlockList = ref(false)
const { blockList, blockListLoading, loadBlockList, unblock } = useBlockedUsers()

function openBlockList(): void {
  showBlockList.value = true
  void loadBlockList()
}

const { isSubmitting: isProcessingSubmit, generalError, handleSubmit, getFieldError } = useAuthForm({
  formRef,
})

const nameError = computed(() => getFieldError('name'))
const emailError = computed(() => getFieldError('email'))
const genderError = computed(() => getFieldError('gender'))
const dateOfBirthError = computed(() => getFieldError('dateOfBirth') || getFieldError('date_of_birth'))
const countryError = computed(() => getFieldError('country'))
const phoneError = computed(() => getFieldError('phone'))

/**
 * Determines the icon to display based on the selected gender option.
 */
const selectedGenderIcon = computed<string>(() => {
  const matchedOption = genderOptions.find(
      (option) => option.value === formState.gender
  )
  return matchedOption?.icon ?? ICON_DEFAULT_GENDER
})

const toast = useToast()

// ========================================
// Asset Management
// ========================================

const showAssetModal = ref(false)

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
  if (validatedFormData.country) {
    payload.country = validatedFormData.country
  }
  if (validatedFormData.phone) {
    payload.phone = validatedFormData.phone
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

      // Initialize gender if empty.
      // Backend casts gender to an integer (1=male … 4=prefer-not), but older
      // payloads may still send 'male' | 'female' strings — handle both.
      if (user.gender !== null && user.gender !== undefined && formState.gender === undefined) {
        const GENDER_STRING_TO_NUMBER: Record<string, number> = {
          'male': GENDER_MALE,
          'female': GENDER_FEMALE,
        }
        const numericGender = typeof user.gender === 'number'
          ? user.gender
          : (GENDER_STRING_TO_NUMBER[user.gender] ?? undefined)
        formState.gender = numericGender
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
          log.warn('Failed to parse date of birth', error)
        }
      }

      // Initialize country + phone (independent fields)
      if (user.country && !formState.country) {
        formState.country = user.country
      }
      if (user.phone && !formState.phone) {
        formState.phone = user.phone
      }
    },
    { immediate: true }
)

// Sync privacy toggle from auth store
watch(
    () => authStore.user?.is_follow_list_public,
    (val) => {
      if (val !== undefined) isFollowListPublic.value = val
    },
    { immediate: true }
)

/**
 * Save privacy setting immediately on toggle.
 * GATE:    Prevent duplicate saves
 * EXECUTE: API call to update profile
 * REACT:   Toast confirmation
 */
async function handlePrivacyToggle(newValue: boolean): Promise<void> {
  if (isSavingPrivacy.value) return
  isSavingPrivacy.value = true
  try {
    await updateProfile({ is_follow_list_public: newValue })
  }
  catch {
    // Revert on failure
    isFollowListPublic.value = !newValue
    toast.add({
      title: 'Failed to update privacy setting',
      color: 'error',
    })
  }
  finally {
    isSavingPrivacy.value = false
  }
}

</script>

<template>
  <main>
    <NavAlt back-to="/profile">Edit Profile</NavAlt>
    <div class="h-20" />
    <div class="px-4">
      <UAlert
          v-if="generalError"
          :description="generalError"
          color="error"
          variant="soft"
          title="Update Failed"
          class="mb-4"
          icon="i-lucide-alert-circle"
      />

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
                class="justify-start" block
                :class="formState.dateOfBirth ? 'text-highlighted' : 'text-dimmed'"
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

        <!-- Country and phone are independent of each other -->
        <FormsCountrySelect v-model="formState.country" :error="countryError" />

        <FormsPhoneNumberInput v-model="formState.phone" :error="phoneError" />

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
        <h3 class="text-lg font-semibold text-white mb-3">Privacy</h3>

        <div class="rounded-lg bg-neutral-900 p-4 flex items-center justify-between gap-3">
          <div class="flex-1 min-w-0">
            <p class="font-medium text-white">Follow List Visibility</p>
            <p class="text-sm text-neutral-400">
              Allow other users to see who you follow and who follows you
            </p>
          </div>
          <USwitch
            v-model="isFollowListPublic"
            :loading="isSavingPrivacy"
            @update:model-value="handlePrivacyToggle"
          />
        </div>
      </div>

      <!-- Asset Management Section -->
      <div class="mt-6">
<!--        <h3 class="text-lg font-semibold text-white mb-3">Asset Management</h3>-->

<!--        <div class="rounded-lg bg-neutral-900 p-4">-->
<!--          -->
<!--          <div class="flex items-center justify-between">-->
<!--            <div class="flex items-center gap-3">-->
<!--              <div class="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-800">-->
<!--                <UIcon-->
<!--                  :name="assetStatusIcon"-->
<!--                  :class="['h-5 w-5', assetStatusIconColor, assetStore.isDownloading ? 'animate-spin' : '']"-->
<!--                />-->
<!--              </div>-->
<!--              <div>-->
<!--                <p class="font-medium text-white">{{ assetStatusTitle }}</p>-->
<!--                <p class="text-sm text-neutral-400">-->
<!--                  {{ assetStore.completedCount }} / {{ assetStore.totalCount }} assets-->
<!--                </p>-->
<!--              </div>-->
<!--            </div>-->
<!--            <UButton-->
<!--              variant="outline"-->
<!--              color="neutral"-->
<!--              icon="i-lucide-settings"-->
<!--              size="sm"-->
<!--              @click="showAssetModal = true"-->
<!--            >-->
<!--              Manage-->
<!--            </UButton>-->
<!--          </div>-->

<!--          &lt;!&ndash; Progress bar when downloading &ndash;&gt;-->
<!--          <div v-if="assetStore.isDownloading" class="mt-3">-->
<!--            <div class="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">-->
<!--              <div-->
<!--                class="h-full bg-linear-to-r from-primary to-secondary transition-all duration-300 ease-out"-->
<!--                :style="{ width: `${assetStore.downloadPercent}%` }"-->
<!--              />-->
<!--            </div>-->
<!--            <p class="mt-1 text-xs text-neutral-500">-->
<!--              {{ assetStore.downloadPercent }}% complete-->
<!--            </p>-->
<!--          </div>-->

<!--        </div>-->
        <!-- Blocked Users -->
        <UButton
          class="w-full justify-center"
          icon="i-lucide-ban"
          size="xl"
          variant="subtle"
          color="neutral"
          @click="openBlockList"
        >
          Blocked Users List
        </UButton>

        <UButton
            class="w-full justify-center mt-22"
            icon="i-lucide-power-off"
            size="xl"
            variant="subtle"
            @click="logout"
          >
            Logout
          </UButton>

          <!-- Danger Zone: Delete Account -->
          <div class="mt-4 mb-12 rounded-lg bg-red-950/20 border border-red-900/30 p-4">
            <div class="flex items-center gap-2 mb-2">
              <UIcon name="i-lucide-alert-triangle" class="h-4 w-4 text-red-400" />
              <h3 class="text-sm font-semibold text-red-400">Danger Zone</h3>
            </div>
            <p class="text-xs text-neutral-500 mb-3">
              Permanently delete your account and all personal data. You'll have 30 days to change your mind.
            </p>
            <UButton
              class="w-full justify-center"
              icon="i-lucide-trash-2"
              size="lg"
              variant="subtle"
              color="error"
              @click="showDeleteModal = true"
            >
              Delete Account
            </UButton>
          </div>
      </div>

      <!-- Asset Manager Modal -->
      <SystemAssetManagerModal v-model="showAssetModal" />

      <!-- Delete Account Modal -->
      <ProfileDeleteAccountModal v-model="showDeleteModal" />
    </div>

    <!-- Block List Slideover -->
    <USlideover v-model:open="showBlockList" side="right">
      <template #content>
        <div class="flex flex-col h-full">
          <!-- Header with close button -->
          <div class="flex items-center gap-3 px-4 py-3 border-b border-muted/20 shrink-0">
            <UButton
              icon="i-lucide-arrow-left"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="showBlockList = false"
            />
            <div>
              <h3 class="text-sm font-semibold">Blocked Users</h3>
              <p class="text-xs text-muted">Users you have blocked cannot send you DMs.</p>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto p-4">
            <!-- Loading -->
            <div v-if="blockListLoading" class="space-y-3">
              <div v-for="i in 4" :key="i" class="animate-pulse flex items-center gap-3">
                <div class="size-10 rounded-full bg-muted/30" />
                <div class="flex-1 h-4 bg-muted/30 rounded" />
              </div>
            </div>

            <!-- Empty -->
            <div v-else-if="blockList.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
              <UIcon name="i-lucide-shield-check" class="size-10 text-muted mb-2" />
              <p class="text-sm text-muted">No blocked users</p>
            </div>

            <!-- List -->
            <div v-else class="space-y-1">
              <div
                v-for="entry in blockList"
                :key="entry.id"
                class="flex items-center gap-3 py-2 px-1"
              >
                <UAvatar
                  :src="entry.avatar ?? undefined"
                  :alt="entry.name"
                  size="sm"
                />
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium truncate">{{ entry.name }}</p>
                  <p v-if="entry.signature" class="text-xs text-muted truncate">{{ entry.signature }}</p>
                </div>
                <UButton
                  size="xs"
                  color="neutral"
                  variant="outline"
                  @click="unblock(entry.id)"
                >
                  Unblock
                </UButton>
              </div>
            </div>
          </div>
        </div>
      </template>
    </USlideover>
  </main>
</template>


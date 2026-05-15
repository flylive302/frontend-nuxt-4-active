// ========================================
// Profile Completion Composable
// ========================================
// Orchestrates the "complete your profile" flow shown to new users
// after registration or social auth when required fields are missing.
//
// ARCHITECTURE: All business logic, schema building, state management,
// and submission orchestration live here — NOT in the page.

import { z } from 'zod'
import { CalendarDate, type DateValue, getLocalTimeZone, today } from '@internationalized/date'
import { useAuthForm, type UseAuthFormOptions } from '~/composables/auth/useAuthForm'
import type { Country } from '~/composables/auth/usePhoneSchema'
import type { UpdateProfilePayload, GenderOption } from '~/types/user/auth'

// ========================================
// Constants
// ========================================

const MINIMUM_AGE_REQUIREMENT = 18 as const
const DEFAULT_CALENDAR_YEAR = 2000 as const
const DEFAULT_CALENDAR_MONTH = 1 as const
const DEFAULT_CALENDAR_DAY = 1 as const

export const GENDER_MALE = 1 as const
export const GENDER_FEMALE = 2 as const
const GENDER_NON_BINARY = 3 as const
const GENDER_PREFER_NOT_TO_SAY = 4 as const

const ICON_MARS = 'i-lucide-mars' as const
const ICON_VENUS = 'i-lucide-venus' as const
const ICON_NON_BINARY = 'i-lucide-non-binary' as const
const ICON_HELP_CIRCLE = 'i-lucide-help-circle' as const
const ICON_DEFAULT_GENDER = 'i-lucide-venus-and-mars' as const

const INVALID_FLAG_CODES = new Set(['an'])
const DEFAULT_FLAG_ICON = 'i-lucide-earth'

const GENDER_OPTIONS: GenderOption[] = [
  { label: 'Male', value: GENDER_MALE, icon: ICON_MARS },
  { label: 'Female', value: GENDER_FEMALE, icon: ICON_VENUS },
  { label: 'Non-binary', value: GENDER_NON_BINARY, icon: ICON_NON_BINARY },
  { label: 'Prefer not to say', value: GENDER_PREFER_NOT_TO_SAY, icon: ICON_HELP_CIRCLE },
]

// ========================================
// Composable
// ========================================

export function useProfileCompletion() {
  // ========================================
  // Dependencies
  // ========================================

  const authStore = useAuthStore()
  const { updateProfile, uploadAvatar } = useProfileActions()
  const { countries, loading: countriesLoading, ensureLoaded, detectIfAllowed } = useCountries()
  const { normalizeError } = useApi()
  const toast = useToast()

  // ========================================
  // Form ref (must be set by the component)
  // ========================================

  const formRef: UseAuthFormOptions['formRef'] = ref(null)

  const { isSubmitting, generalError, handleSubmit, getFieldError } = useAuthForm({
    formRef,
  })

  // ========================================
  // Missing-field detection (business rules)
  // ========================================

  const needsGender = computed(() => authStore.user?.gender == null)
  const needsEmail = computed(() => !authStore.user?.email)
  const needsDateOfBirth = computed(() => !authStore.user?.date_of_birth)
  const needsCountry = computed(() => !authStore.user?.country)
  const needsAvatar = computed(() => !authStore.user?.avatar)

  const hasMissingFields = computed(() =>
    needsGender.value || needsEmail.value || needsDateOfBirth.value
  )

  // ========================================
  // Dynamic Zod Schema — GATE: only validates shown fields
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

  interface ProfileCompletionFormState {
    gender: number | undefined
    email: string
    dateOfBirth: DateValue | null
    country: string
  }

  const formState = reactive<ProfileCompletionFormState>({
    gender: undefined,
    email: '',
    dateOfBirth: null,
    country: '',
  })

  const dateOfBirthModel = ref<CalendarDate | undefined>(undefined)

  const calendarModel = computed({
    get: () => dateOfBirthModel.value as DateValue | undefined,
    set: (value: DateValue | undefined) => {
      dateOfBirthModel.value = value as CalendarDate | undefined
    }
  })

  const calendarDefaultDate = new CalendarDate(
    DEFAULT_CALENDAR_YEAR,
    DEFAULT_CALENDAR_MONTH,
    DEFAULT_CALENDAR_DAY
  )

  watchEffect(() => {
    dateOfBirthModel.value = (formState.dateOfBirth as CalendarDate | null) ?? undefined
  })

  watch(dateOfBirthModel, (value) => {
    formState.dateOfBirth = value ?? null
  })

  // ========================================
  // Country Picker
  // ========================================

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

  /** Auto-detect country on mount (called by the component's onMounted) */
  async function initCountryDetection(): Promise<void> {
    if (!needsCountry.value) return
    await ensureLoaded()
    const detected = await detectIfAllowed()
    if (detected) {
      onCountryChange(detected)
    }
  }

  // ========================================
  // Gender Icon
  // ========================================

  const selectedGenderIcon = computed<string>(() => {
    const matchedOption = GENDER_OPTIONS.find(
      (option) => option.value === formState.gender
    )
    return matchedOption?.icon ?? ICON_DEFAULT_GENDER
  })

  // ========================================
  // Field Errors
  // ========================================

  const emailError = computed(() => getFieldError('email'))
  const genderError = computed(() => getFieldError('gender'))
  const dateOfBirthError = computed(() => getFieldError('dateOfBirth') || getFieldError('date_of_birth'))
  const countryError = computed(() => getFieldError('country'))

  // ========================================
  // Avatar Upload
  // ========================================

  const isUploadingAvatar = ref(false)

  const avatarUrl = computed<string | null>(() => {
    return authStore.user?.avatar ?? null
  })

  async function handleAvatarSelected(file: File): Promise<void> {
    try {
      isUploadingAvatar.value = true
      await uploadAvatar(file)
    } catch (error: unknown) {
      const normalized = normalizeError(error)
      // REACT — toast on failure
      toast.add({
        title: 'Upload Failed',
        description: normalized.message || 'Failed to upload avatar. Please try again.',
        color: 'error',
      })
    } finally {
      isUploadingAvatar.value = false
    }
  }

  // ========================================
  // Submission — EXECUTE + REACT
  // ========================================

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

  async function submitProfileCompletion(): Promise<void> {
    await handleSubmit(async () => {
      // EXECUTE
      const profilePayload = buildProfileUpdatePayload()
      await updateProfile(profilePayload)

      // REACT
      await navigateTo('/')
    })
  }

  /**
   * Wizard submission — bypasses UForm validation (wizard validates per-step).
   * GATE:    skipped (each step validates inline)
   * EXECUTE: build payload → updateProfile
   * REACT:   navigate home / show error toast
   */
  async function submitWizardData(): Promise<void> {
    if (isSubmitting.value) return
    isSubmitting.value = true
    generalError.value = ''

    try {
      const payload = buildProfileUpdatePayload()
      if (Object.keys(payload).length === 0 && !hasMissingFields.value) {
        await navigateTo('/', { replace: true })
        return
      }
      await updateProfile(payload)
      await navigateTo('/', { replace: true })
    } catch (error: unknown) {
      const normalized = normalizeError(error)
      generalError.value = normalized.message
      toast.add({ title: 'Update Failed', description: normalized.message, color: 'error' })
    } finally {
      isSubmitting.value = false
    }
  }

  // ========================================
  // Return
  // ========================================

  return {
    // Form ref (component must bind this to <UForm ref>)
    formRef,

    // User info (for welcome display)
    userName: computed(() => authStore.user?.name ?? ''),
    userSignature: computed(() => authStore.user?.signature ?? ''),

    // Missing-field flags
    needsGender,
    needsEmail,
    needsDateOfBirth,
    needsCountry,
    needsAvatar,
    hasMissingFields,

    // Schema + state
    formSchema,
    formState,

    // Calendar
    calendarModel,
    calendarDefaultDate,

    // Country
    countries,
    countriesLoading,
    selectedCountry,
    getFlagIconName,
    onCountryChange,
    initCountryDetection,
    DEFAULT_FLAG_ICON,

    // Gender
    GENDER_OPTIONS,
    selectedGenderIcon,

    // Field errors
    emailError,
    genderError,
    dateOfBirthError,
    countryError,
    generalError,

    // Avatar
    avatarUrl,
    isUploadingAvatar,
    handleAvatarSelected,

    // Submission
    isSubmitting,
    submitProfileCompletion,
    submitWizardData,
  }
}

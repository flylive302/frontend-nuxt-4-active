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
import { type Country, isValidE164Phone } from '~/composables/auth/usePhoneSchema'
import type { UpdateProfilePayload, GenderOption } from '~/types/user/auth'
// Imported explicitly rather than relying on the `app/utils` auto-import: the
// Vitest config is plain `vitest/config` with no Nuxt auto-import layer, so the
// bare reference resolved at runtime but threw `getFlagIcon is not defined`
// across 9 specs. Harmless in the app, where the auto-import would cover it.
import { DEFAULT_FLAG_ICON, getFlagIcon } from '~/utils/flag-icon'

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

  const needsConsent = computed(() =>
    authStore.user?.terms_accepted_at == null || authStore.user?.privacy_policy_accepted_at == null
  )
  const needsGender = computed(() => authStore.user?.gender == null)
  const needsEmail = computed(() => !authStore.user?.email)
  const needsDateOfBirth = computed(() => !authStore.user?.date_of_birth)
  const needsCountry = computed(() => !authStore.user?.country)
  const needsPhone = computed(() => !authStore.user?.phone)
  const needsAvatar = computed(() => !authStore.user?.avatar)

  const hasMissingFields = computed(() =>
    needsConsent.value || needsGender.value || needsEmail.value
    || needsDateOfBirth.value || needsCountry.value || needsPhone.value
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

    if (needsPhone.value) {
      // Independent E.164 number — validated on its own, not against country.
      shape.phone = z.string()
        .min(1, 'Phone number is required')
        .refine(isValidE164Phone, 'Enter a valid phone number')
    }

    return z.object(shape)
  })

  // ========================================
  // Form State
  // ========================================

  interface ProfileCompletionFormState {
    termsAccepted: boolean
    privacyAccepted: boolean
    gender: number | undefined
    email: string
    dateOfBirth: DateValue | null
    country: string
    phone: string
  }

  const formState = reactive<ProfileCompletionFormState>({
    termsAccepted: false,
    privacyAccepted: false,
    gender: undefined,
    email: '',
    dateOfBirth: null,
    country: '',
    phone: '',
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

  const getFlagIconName = getFlagIcon

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
  const phoneError = computed(() => getFieldError('phone'))

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

    if (needsConsent.value && formState.termsAccepted) {
      payload.terms_accepted_at = true
    }
    if (needsConsent.value && formState.privacyAccepted) {
      payload.privacy_policy_accepted_at = true
    }
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
    if (needsPhone.value && formState.phone) {
      payload.phone = formState.phone
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
    needsConsent,
    needsGender,
    needsEmail,
    needsDateOfBirth,
    needsCountry,
    needsPhone,
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
    phoneError,
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

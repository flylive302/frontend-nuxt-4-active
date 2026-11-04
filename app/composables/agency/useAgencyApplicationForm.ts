// ========================================
// useAgencyApplicationForm — agency application create / edit pipeline
// ========================================
// Shared by `pages/agency/create.vue` (new application) and
// `pages/agency/edit.vue` (edit + resubmit a rejected/cancelled one).
//
//   GATE    → schema parse (+ "file OR kept image" per slot in edit mode)
//   EXECUTE → upload logo → ID front → ID back in order (first failure stops),
//             then POST /agencies (create) or PUT /user/agency/application (edit)
//   REACT   → toasts, agency refresh, redirect to /agency/my-agency
//
// Pages keep only the template, state binding, and route-level data loading.

import { z } from 'zod'
import { computed, reactive, ref, watch } from 'vue'
import { navigateTo } from 'nuxt/app'
import type { PhoneModel } from '~/composables/auth/usePhoneSchema'
import { usePhoneSchema, normalizePhone } from '~/composables/auth/usePhoneSchema'
import type { ImageUploadFolder, ImageUploadResult, NationalIdImage } from '~/types/asset/upload'
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE } from '~/types/asset/upload'
import type { Agency, AgencyNationalIdImage } from '~/types/agency/agency'
import { normalizeFetchError } from '~/utils/api/normalizeFetchError'

// ========================================
// Constants
// ========================================

const MY_AGENCY_ROUTE = '/agency/my-agency'

/** Create mode shows the success toast this long before redirecting. */
const CREATE_REDIRECT_DELAY_MS = 1500

// ========================================
// Types
// ========================================

export type AgencyApplicationFormMode = 'create' | 'edit'

export type AgencyApplicationStep = 'idle' | 'uploading' | 'submitting'

export interface AgencyApplicationFields {
  agencyName?: string
  address?: string
  logo?: File
  idCardFront?: File
  idCardBack?: File
}

export interface KeptLogo {
  url: string
  file_id: string
}

export interface AgencyApplicationPayloadInput {
  agencyName: string
  address: string
  countryCode: string
  dialCode: string
  phone: string
  logo: KeptLogo
  idFront: NationalIdImage
  idBack: NationalIdImage
  coinResellerId: number | null
}

type UploadSlot = ReturnType<ReturnType<typeof useImageUpload>['createUploadState']>

// ========================================
// Pure helpers (exported for tests)
// ========================================

const imageFile = z.instanceof(File, { message: 'Only image files are allowed' })
  // Same allowlist `useImageUpload.validateFile` enforces — anything looser
  // (e.g. HEIC/GIF from a phone gallery) passes the form, then fails at upload.
  .refine(f => ALLOWED_IMAGE_TYPES.includes(f.type), 'Please pick a JPG, PNG or WebP image')
  .refine(f => f.size <= MAX_IMAGE_SIZE, 'Each file must be ≤ 5MB')

const textFields = {
  agencyName: z.string()
    .min(1, 'Agency name is required')
    .max(30, 'Agency name must be less than 30 characters'),
  address: z.string()
    .min(1, 'Address is required'),
}

/**
 * Create mode requires a File per slot. Edit mode makes them optional at the
 * zod level — a kept (already-uploaded) image substitutes for a fresh File, and
 * that "file OR kept image" rule is enforced in `isValid` / at submit.
 */
export function buildAgencyApplicationBaseSchema(mode: AgencyApplicationFormMode) {
  const slot = mode === 'create' ? imageFile : imageFile.optional()
  return z.object({ ...textFields, logo: slot, idCardFront: slot, idCardBack: slot })
}

/** Request body shared by POST /agencies and PUT /user/agency/application. */
export function buildAgencyApplicationPayload(input: AgencyApplicationPayloadInput): Record<string, unknown> {
  return {
    name: input.agencyName,
    address: input.address,
    country: input.countryCode.toUpperCase(),
    logo_url: input.logo.url,
    logo_file_id: input.logo.file_id,
    national_id_images: [input.idFront, input.idBack],
    // Phone — the backend stores phone_e164; the parts are informational.
    phone_country_code: input.countryCode,
    phone_dial_code: input.dialCode,
    phone: input.phone,
    phone_e164: normalizePhone(input.dialCode, input.phone),
    ...(input.coinResellerId && { coin_reseller_id: input.coinResellerId }),
  }
}

/** Owner-only, rejected/cancelled applications only. */
export function canEditAgencyApplication(agency: Agency | null, isOwner: boolean): boolean {
  if (!agency || !isOwner) return false
  return agency.can_resubmit ?? (agency.status === 'rejected' || agency.status === 'cancelled')
}

// ========================================
// Composable
// ========================================

export function useAgencyApplicationForm(mode: AgencyApplicationFormMode) {
  const toast = useToast()
  const { submitAgency } = useAgencyCreateApi()
  const { resubmitApplication } = useAgencyApplication()
  const { fetchUserAgency } = useAgencyMembership()
  const { createUploadState } = useImageUpload()

  // ========================================
  // State
  // ========================================

  const state = reactive<AgencyApplicationFields>({
    agencyName: undefined,
    address: undefined,
    logo: undefined,
    idCardFront: undefined,
    idCardBack: undefined,
  })

  const phone = reactive<PhoneModel>({
    countryCode: '',
    dialCode: '',
    phone: '',
  })

  // Selected coin reseller from ChooseDefaultReseller.
  const coinResellerId = ref<number | null>(null)

  // Edit mode: images kept from the previous application. Replaced (not
  // merged) the moment the owner picks a new file for that slot.
  const existingLogo = ref<KeptLogo | null>(null)
  const existingIdFront = ref<AgencyNationalIdImage | null>(null)
  const existingIdBack = ref<AgencyNationalIdImage | null>(null)

  // Edit mode: E.164 phone from the previous application, applied once the
  // phone input has resolved the dial code from the country (async).
  const storedPhone = ref<string | null>(null)

  const logoUpload = createUploadState()
  const idFrontUpload = createUploadState()
  const idBackUpload = createUploadState()

  const processing = ref(false)
  const currentStep = ref<AgencyApplicationStep>('idle')

  // Create mode: set once the application is accepted; keeps the form locked
  // through the success toast → redirect delay so a second tap can't re-POST.
  const submitted = ref(false)

  // ========================================
  // Schema
  // ========================================

  const baseSchema = buildAgencyApplicationBaseSchema(mode)
  const phoneSchema = usePhoneSchema(computed(() =>
    phone.countryCode ? { code: phone.countryCode, name: '' } : undefined,
  ))
  const pageSchema = computed(() => baseSchema.and(phoneSchema.value))

  // ========================================
  // Computed
  // ========================================

  const isValid = computed(() => {
    const baseValid = baseSchema.safeParse(state).success
    const phoneValid = phoneSchema.value.safeParse(phone).success
    const hasLogo = !!state.logo || !!existingLogo.value
    const hasIdFront = !!state.idCardFront || !!existingIdFront.value
    const hasIdBack = !!state.idCardBack || !!existingIdBack.value
    return baseValid && phoneValid && hasLogo && hasIdFront && hasIdBack
  })

  const isUploading = computed(() =>
    logoUpload.state.value.status === 'uploading'
    || idFrontUpload.state.value.status === 'uploading'
    || idBackUpload.state.value.status === 'uploading',
  )

  const overallProgress = computed(() => {
    const states = [logoUpload.state.value, idFrontUpload.state.value, idBackUpload.state.value]
    const total = states.reduce((sum, s) => sum + s.progress, 0)
    return Math.round(total / states.length)
  })

  // ========================================
  // Prefill (edit mode)
  // ========================================

  function prefillFromAgency(agency: Agency): void {
    state.agencyName = agency.name
    state.address = agency.address ?? undefined
    phone.countryCode = agency.country ?? ''
    storedPhone.value = agency.phone ?? null
    applyStoredPhone()

    // The API rejects a logo URL without its file id (`required_with`), so a
    // logo we cannot re-send with its file id counts as "no logo kept" — the
    // owner must pick a new one rather than hit a 422 on submit.
    if (agency.logo && agency.logo_file_id) {
      existingLogo.value = { url: agency.logo, file_id: agency.logo_file_id }
    }

    const idImages = agency.national_id_images ?? []
    existingIdFront.value = idImages.find(img => img.side === 'front') ?? null
    existingIdBack.value = idImages.find(img => img.side === 'back') ?? null

    coinResellerId.value = agency.coin_reseller?.id ?? null
  }

  /** One-shot: never overwrites a number the owner already typed. */
  function applyStoredPhone(): void {
    const stored = storedPhone.value
    if (!stored || !phone.dialCode || phone.phone) return
    if (stored.startsWith(phone.dialCode)) {
      phone.phone = stored.slice(phone.dialCode.length)
    }
    storedPhone.value = null
  }

  watch(() => phone.dialCode, applyStoredPhone)

  // ========================================
  // EXECUTE helpers
  // ========================================

  /**
   * Uploads a freshly picked file, or falls back to the kept image.
   * Returns null (after a toast) when the slot cannot be filled.
   */
  async function resolveSlot<T>(opts: {
    file: File | undefined
    upload: UploadSlot
    folder: ImageUploadFolder
    fromUpload: (result: ImageUploadResult) => T
    kept: T | null
    uploadFailedText: string
    missingTitle: string
    missingText: string
  }): Promise<T | null> {
    if (opts.file) {
      const result = await opts.upload.upload(opts.file, opts.folder)
      if (!result) {
        toast.add({ title: 'Upload Failed', description: opts.upload.state.value.error ?? opts.uploadFailedText, color: 'error' })
        return null
      }
      return opts.fromUpload(result)
    }
    if (opts.kept) return opts.kept
    toast.add({ title: opts.missingTitle, description: opts.missingText, color: 'error' })
    return null
  }

  // ========================================
  // Pipeline
  // ========================================

  async function submit(): Promise<void> {
    if (submitted.value || processing.value) return
    processing.value = true
    currentStep.value = 'idle'

    try {
      // GATE
      const parsed = pageSchema.value.safeParse({ ...state, ...phone })
      if (!parsed.success) {
        toast.add({ title: 'Validation Error', description: 'Please check all required fields', color: 'error' })
        return
      }

      // EXECUTE — uploads, in order; the first failure stops the run.
      currentStep.value = 'uploading'

      const logo = await resolveSlot<KeptLogo>({
        file: parsed.data.logo,
        upload: logoUpload,
        folder: 'agencies/logos',
        fromUpload: r => ({ url: r.url, file_id: r.fileId }),
        kept: existingLogo.value,
        uploadFailedText: 'Failed to upload logo',
        missingTitle: 'Missing Logo',
        missingText: 'Please add a logo for your agency',
      })
      if (!logo) return

      const idFront = await resolveSlot<NationalIdImage>({
        file: parsed.data.idCardFront,
        upload: idFrontUpload,
        folder: 'agencies/national-ids',
        fromUpload: r => ({ url: r.url, file_id: r.fileId, side: 'front' }),
        kept: existingIdFront.value,
        uploadFailedText: 'Failed to upload ID card front',
        missingTitle: 'Missing ID',
        missingText: 'Please add the front of your ID card',
      })
      if (!idFront) return

      const idBack = await resolveSlot<NationalIdImage>({
        file: parsed.data.idCardBack,
        upload: idBackUpload,
        folder: 'agencies/national-ids',
        fromUpload: r => ({ url: r.url, file_id: r.fileId, side: 'back' }),
        kept: existingIdBack.value,
        uploadFailedText: 'Failed to upload ID card back',
        missingTitle: 'Missing ID',
        missingText: 'Please add the back of your ID card',
      })
      if (!idBack) return

      // EXECUTE — submit.
      currentStep.value = 'submitting'

      const payload = buildAgencyApplicationPayload({
        agencyName: parsed.data.agencyName,
        address: parsed.data.address,
        countryCode: parsed.data.countryCode,
        dialCode: parsed.data.dialCode,
        phone: parsed.data.phone,
        logo,
        idFront,
        idBack,
        coinResellerId: coinResellerId.value,
      })

      if (mode === 'create') {
        await submitAgency(payload)
        submitted.value = true

        // REACT
        await fetchUserAgency()
        toast.add({ title: 'Success', description: 'Agency application submitted for review', color: 'success' })
        setTimeout(() => navigateTo(MY_AGENCY_ROUTE), CREATE_REDIRECT_DELAY_MS)
        return
      }

      // Edit: resubmitApplication toasts + refreshes the agency itself.
      const ok = await resubmitApplication(payload)
      if (!ok) return

      // REACT — immediate redirect; no live Submit button after success.
      await navigateTo(MY_AGENCY_ROUTE)
    } catch (error: unknown) {
      const normalizedError = normalizeFetchError(error)
      const errorDescription = normalizedError.fieldErrors
        ? Object.values(normalizedError.fieldErrors).flat()[0]
        : normalizedError.message

      const fallback = mode === 'create'
        ? 'Failed to create agency. Please try again.'
        : 'Failed to resubmit agency application. Please try again.'

      toast.add({ title: 'Error', description: errorDescription || fallback, color: 'error' })
    } finally {
      // Create: stay locked after success until the delayed redirect fires.
      processing.value = submitted.value
      currentStep.value = 'idle'
    }
  }

  return {
    state,
    phone,
    coinResellerId,
    existingLogo,
    existingIdFront,
    existingIdBack,
    logoUpload,
    idFrontUpload,
    idBackUpload,
    processing,
    currentStep,
    pageSchema,
    isValid,
    isUploading,
    overallProgress,
    prefillFromAgency,
    submit,
  }
}

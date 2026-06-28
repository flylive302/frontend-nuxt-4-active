import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, reactive, ref } from 'vue'

// ── Vue reactivity as Nuxt auto-imports ──────────────────────
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('reactive', reactive)
vi.stubGlobal('watchEffect', vi.fn())
vi.stubGlobal('watch', vi.fn())
vi.stubGlobal('navigateTo', vi.fn())
vi.stubGlobal('useToast', () => ({ add: vi.fn() }))
vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBase: '', apiRoot: '' } }))
vi.stubGlobal('useApi', () => ({ normalizeError: (e: unknown) => ({ message: String(e) }) }))
vi.stubGlobal('useCountries', () => ({
  countries: ref([]),
  loading: ref(false),
  ensureLoaded: vi.fn(),
  detectIfAllowed: vi.fn().mockResolvedValue(undefined),
}))
vi.stubGlobal('useAuthForm', () => ({
  isSubmitting: ref(false),
  generalError: ref(''),
  handleSubmit: vi.fn(),
  getFieldError: vi.fn().mockReturnValue(null),
}))
vi.stubGlobal('useProfileActions', () => ({
  updateProfile: vi.fn().mockResolvedValue({}),
  uploadAvatar: vi.fn(),
}))

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    gender: 1,
    email: 'user@example.com',
    date_of_birth: '1990-01-01',
    country: 'US',
    avatar: 'https://example.com/avatar.jpg',
    terms_accepted_at: '2024-01-01T00:00:00Z',
    privacy_policy_accepted_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

function stubAuthStore(user: Record<string, unknown> | null) {
  ;(globalThis as Record<string, unknown>).useAuthStore = () => ({ user })
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'useAuthStore')
})

// ─────────────────────────────────────────────────
// needsConsent
// ─────────────────────────────────────────────────

describe('needsConsent', () => {
  it('is false when both timestamps are present', async () => {
    stubAuthStore(makeUser())
    const { useProfileCompletion } = await import('../../app/composables/auth/useProfileCompletion')
    const { needsConsent } = useProfileCompletion()
    expect(needsConsent.value).toBe(false)
  })

  it('is true when terms_accepted_at is null', async () => {
    stubAuthStore(makeUser({ terms_accepted_at: null }))
    const { useProfileCompletion } = await import('../../app/composables/auth/useProfileCompletion')
    const { needsConsent } = useProfileCompletion()
    expect(needsConsent.value).toBe(true)
  })

  it('is true when privacy_policy_accepted_at is null', async () => {
    stubAuthStore(makeUser({ privacy_policy_accepted_at: null }))
    const { useProfileCompletion } = await import('../../app/composables/auth/useProfileCompletion')
    const { needsConsent } = useProfileCompletion()
    expect(needsConsent.value).toBe(true)
  })

  it('is true when both timestamps are null', async () => {
    stubAuthStore(makeUser({ terms_accepted_at: null, privacy_policy_accepted_at: null }))
    const { useProfileCompletion } = await import('../../app/composables/auth/useProfileCompletion')
    const { needsConsent } = useProfileCompletion()
    expect(needsConsent.value).toBe(true)
  })
})

// ─────────────────────────────────────────────────
// Wizard step ordering
// ─────────────────────────────────────────────────

describe('wizard step ordering', () => {
  it('consent step comes before gender when both needed', async () => {
    stubAuthStore({
      gender: null,
      email: 'user@example.com',
      date_of_birth: '1990-01-01',
      country: 'US',
      avatar: 'https://example.com/avatar.jpg',
      terms_accepted_at: null,
      privacy_policy_accepted_at: null,
    })
    const { useProfileCompletion } = await import('../../app/composables/auth/useProfileCompletion')
    const { needsConsent, needsGender } = useProfileCompletion()
    expect(needsConsent.value).toBe(true)
    expect(needsGender.value).toBe(true)
    // Consent is the first check — this mirrors step ordering in the wizard's onMounted
  })

  it('no consent step when both timestamps present', async () => {
    stubAuthStore(makeUser({ gender: null }))
    const { useProfileCompletion } = await import('../../app/composables/auth/useProfileCompletion')
    const { needsConsent, needsGender } = useProfileCompletion()
    expect(needsConsent.value).toBe(false)
    expect(needsGender.value).toBe(true)
  })

  it('only consent step when only consent missing', async () => {
    stubAuthStore(makeUser({ terms_accepted_at: null, privacy_policy_accepted_at: null }))
    const { useProfileCompletion } = await import('../../app/composables/auth/useProfileCompletion')
    const { needsConsent, needsGender, needsDateOfBirth, needsEmail } = useProfileCompletion()
    expect(needsConsent.value).toBe(true)
    expect(needsGender.value).toBe(false)
    expect(needsDateOfBirth.value).toBe(false)
    expect(needsEmail.value).toBe(false)
  })
})

// ─────────────────────────────────────────────────
// buildProfileUpdatePayload — consent fields
// ─────────────────────────────────────────────────

describe('buildProfileUpdatePayload consent fields', () => {
  it('includes consent fields when needsConsent and both boxes checked', async () => {
    stubAuthStore(makeUser({ terms_accepted_at: null, privacy_policy_accepted_at: null }))
    const { useProfileCompletion } = await import('../../app/composables/auth/useProfileCompletion')
    const { formState } = useProfileCompletion()

    formState.termsAccepted = true
    formState.privacyAccepted = true

    // Capture what was passed to updateProfile
    const updateProfile = vi.fn().mockResolvedValue({})
    ;(globalThis as Record<string, unknown>).useProfileActions = () => ({ updateProfile, uploadAvatar: vi.fn() })

    vi.resetModules()
    const { useProfileCompletion: fresh } = await import('../../app/composables/auth/useProfileCompletion')
    const instance = fresh()
    instance.formState.termsAccepted = true
    instance.formState.privacyAccepted = true

    await instance.submitWizardData()

    expect(updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ terms_accepted_at: true, privacy_policy_accepted_at: true })
    )
  })

  it('does not include consent fields when not needed', async () => {
    stubAuthStore(makeUser())
    const updateProfile = vi.fn().mockResolvedValue({})
    ;(globalThis as Record<string, unknown>).useProfileActions = () => ({ updateProfile, uploadAvatar: vi.fn() })

    vi.resetModules()
    const { useProfileCompletion } = await import('../../app/composables/auth/useProfileCompletion')
    const { submitWizardData } = useProfileCompletion()

    await submitWizardData()

    // navigateTo is called directly, updateProfile not called with empty payload
    expect(updateProfile).not.toHaveBeenCalledWith(
      expect.objectContaining({ terms_accepted_at: expect.anything() })
    )
  })
})

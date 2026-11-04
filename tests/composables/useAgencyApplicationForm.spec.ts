// ========================================
// useAgencyApplicationForm Composable Tests
// ========================================
// agency-create-page step 5 — the create/edit pipeline moved out of the pages.
// Covers: payload shape, the edit gate, upload order short-circuit, kept-image
// reuse in edit mode, and the create-mode post-success lock (step 4).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { ImageUploadProgress, ImageUploadResult } from '~/types/asset/upload'
import type { Agency } from '~/types/agency/agency'

const navigateTo = vi.fn().mockResolvedValue(undefined)
vi.mock('nuxt/app', () => ({ navigateTo: (...args: unknown[]) => navigateTo(...args) }))

// ========================================
// Test doubles
// ========================================

interface FakeSlot {
  state: ReturnType<typeof ref<ImageUploadProgress>>
  upload: ReturnType<typeof vi.fn>
  reset: () => void
}

function fakeSlot(behaviour: 'ok' | 'fail', fileId: string): FakeSlot {
  const state = ref<ImageUploadProgress>({ status: 'idle', progress: 0 })
  const upload = vi.fn(async (): Promise<ImageUploadResult | null> => {
    if (behaviour === 'fail') {
      state.value = { status: 'error', progress: 0, error: 'Too many upload attempts. Please wait a minute and try again.' }
      return null
    }
    const result = { fileId, url: `https://ik.imagekit.io/x/${fileId}.png` }
    state.value = { status: 'success', progress: 100, result }
    return result
  })
  return { state, upload, reset: () => {} }
}

function stubDependencies(slots: Array<'ok' | 'fail'> = ['ok', 'ok', 'ok']) {
  const toastAdd = vi.fn()
  const submitAgency = vi.fn().mockResolvedValue(undefined)
  const resubmitApplication = vi.fn().mockResolvedValue(true)
  const fetchUserAgency = vi.fn().mockResolvedValue(undefined)
  const created = [fakeSlot(slots[0]!, 'logo'), fakeSlot(slots[1]!, 'front'), fakeSlot(slots[2]!, 'back')]
  let next = 0

  const g = globalThis as Record<string, unknown>
  g.useToast = () => ({ add: toastAdd })
  g.useAgencyCreateApi = () => ({ submitAgency })
  g.useAgencyApplication = () => ({ resubmitApplication })
  g.useAgencyMembership = () => ({ fetchUserAgency })
  g.useImageUpload = () => ({ createUploadState: () => created[next++] })

  const [logoSlot, frontSlot, backSlot] = created as [FakeSlot, FakeSlot, FakeSlot]
  return { toastAdd, submitAgency, resubmitApplication, fetchUserAgency, logoSlot, frontSlot, backSlot }
}

function png(name: string): File {
  return new File([new Uint8Array([137, 80, 78, 71])], name, { type: 'image/png' })
}

async function loadModule() {
  return await import('~/composables/agency/useAgencyApplicationForm')
}

type Form = ReturnType<Awaited<ReturnType<typeof loadModule>>['useAgencyApplicationForm']>

function fillTextAndPhone(form: Form): void {
  form.state.agencyName = 'Test Agency'
  form.state.address = 'Karachi'
  form.phone.countryCode = 'PK'
  form.phone.dialCode = '+92'
  form.phone.phone = '3001234567'
}

function rejectedAgency(overrides: Partial<Agency> = {}): Agency {
  return {
    id: 7,
    name: 'Old Name',
    country: 'PK',
    logo: 'https://ik.imagekit.io/x/old-logo.png',
    logo_file_id: 'old-logo',
    status: 'rejected',
    status_label: 'Rejected',
    created_at: '2026-11-01T00:00:00Z',
    address: 'Old Address',
    phone: '+923001234567',
    national_id_images: [
      { url: 'https://ik.imagekit.io/x/old-front.png', file_id: 'old-front', side: 'front' },
      { url: 'https://ik.imagekit.io/x/old-back.png', file_id: 'old-back', side: 'back' },
    ],
    can_resubmit: true,
    ...overrides,
  } as Agency
}

beforeEach(() => {
  vi.resetModules()
  navigateTo.mockClear()
})

afterEach(() => {
  for (const key of ['useToast', 'useAgencyCreateApi', 'useAgencyApplication', 'useAgencyMembership', 'useImageUpload']) {
    Reflect.deleteProperty(globalThis, key)
  }
  vi.useRealTimers()
})

// ========================================
// Pure helpers
// ========================================

describe('buildAgencyApplicationPayload', () => {
  it('builds the shared create/resubmit body with an E.164 phone', async () => {
    const { buildAgencyApplicationPayload } = await loadModule()

    const payload = buildAgencyApplicationPayload({
      agencyName: 'A',
      address: 'B',
      countryCode: 'pk',
      dialCode: '+92',
      phone: '300 123-4567',
      logo: { url: 'u', file_id: 'l' },
      idFront: { url: 'f', file_id: 'f1', side: 'front' },
      idBack: { url: 'b', file_id: 'b1', side: 'back' },
      coinResellerId: 42,
    })

    expect(payload).toMatchObject({
      name: 'A',
      address: 'B',
      country: 'PK',
      logo_url: 'u',
      logo_file_id: 'l',
      national_id_images: [
        { url: 'f', file_id: 'f1', side: 'front' },
        { url: 'b', file_id: 'b1', side: 'back' },
      ],
      phone_e164: '+923001234567',
      coin_reseller_id: 42,
    })
  })

  it('omits coin_reseller_id when none is selected', async () => {
    const { buildAgencyApplicationPayload } = await loadModule()

    const payload = buildAgencyApplicationPayload({
      agencyName: 'A', address: 'B', countryCode: 'PK', dialCode: '+92', phone: '3001234567',
      logo: { url: 'u', file_id: 'l' },
      idFront: { url: 'f', file_id: 'f1', side: 'front' },
      idBack: { url: 'b', file_id: 'b1', side: 'back' },
      coinResellerId: null,
    })

    expect(payload).not.toHaveProperty('coin_reseller_id')
  })
})

describe('canEditAgencyApplication', () => {
  it('allows only the owner of a resubmittable application', async () => {
    const { canEditAgencyApplication } = await loadModule()

    expect(canEditAgencyApplication(null, true)).toBe(false)
    expect(canEditAgencyApplication(rejectedAgency(), false)).toBe(false)
    expect(canEditAgencyApplication(rejectedAgency(), true)).toBe(true)
    expect(canEditAgencyApplication(rejectedAgency({ can_resubmit: false }), true)).toBe(false)
    expect(canEditAgencyApplication(rejectedAgency({ can_resubmit: undefined, status: 'cancelled' }), true)).toBe(true)
    expect(canEditAgencyApplication(rejectedAgency({ can_resubmit: undefined, status: 'pending' }), true)).toBe(false)
  })
})

// ========================================
// Create mode
// ========================================

describe('create mode', () => {
  it('stops at the first failed upload and shows its real error', async () => {
    const deps = stubDependencies(['fail', 'ok', 'ok'])
    const { useAgencyApplicationForm } = await loadModule()
    const form = useAgencyApplicationForm('create')
    fillTextAndPhone(form)
    form.state.logo = png('logo.png')
    form.state.idCardFront = png('front.png')
    form.state.idCardBack = png('back.png')

    await form.submit()

    expect(deps.logoSlot.upload).toHaveBeenCalledTimes(1)
    expect(deps.frontSlot.upload).not.toHaveBeenCalled()
    expect(deps.backSlot.upload).not.toHaveBeenCalled()
    expect(deps.submitAgency).not.toHaveBeenCalled()
    expect(deps.toastAdd).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Upload Failed',
      description: 'Too many upload attempts. Please wait a minute and try again.',
    }))
    expect(form.processing.value).toBe(false)
  })

  it('uploads in order, submits once, and stays locked until the delayed redirect', async () => {
    vi.useFakeTimers()
    const deps = stubDependencies()
    const { useAgencyApplicationForm } = await loadModule()
    const form = useAgencyApplicationForm('create')
    fillTextAndPhone(form)
    form.state.logo = png('logo.png')
    form.state.idCardFront = png('front.png')
    form.state.idCardBack = png('back.png')

    await form.submit()

    expect(deps.submitAgency).toHaveBeenCalledTimes(1)
    expect(deps.submitAgency.mock.calls[0]![0]).toMatchObject({
      logo_file_id: 'logo',
      national_id_images: [
        expect.objectContaining({ file_id: 'front', side: 'front' }),
        expect.objectContaining({ file_id: 'back', side: 'back' }),
      ],
      phone_e164: '+923001234567',
    })
    expect(deps.fetchUserAgency).toHaveBeenCalledTimes(1)

    // Locked through the toast → redirect gap; a second tap is ignored.
    expect(form.processing.value).toBe(true)
    await form.submit()
    expect(deps.submitAgency).toHaveBeenCalledTimes(1)

    expect(navigateTo).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1500)
    expect(navigateTo).toHaveBeenCalledWith('/agency/my-agency')
  })

  it('unlocks and shows the backend message when the create request fails', async () => {
    const deps = stubDependencies()
    deps.submitAgency.mockRejectedValueOnce(new Error('Server exploded'))
    const { useAgencyApplicationForm } = await loadModule()
    const form = useAgencyApplicationForm('create')
    fillTextAndPhone(form)
    form.state.logo = png('logo.png')
    form.state.idCardFront = png('front.png')
    form.state.idCardBack = png('back.png')

    await form.submit()

    expect(deps.toastAdd).toHaveBeenCalledWith(expect.objectContaining({ title: 'Error' }))
    expect(form.processing.value).toBe(false)
    expect(navigateTo).not.toHaveBeenCalled()
  })
})

// ========================================
// Edit mode
// ========================================

describe('edit mode', () => {
  it('reuses kept images, uploads only the replaced logo, and redirects immediately', async () => {
    const deps = stubDependencies()
    const { useAgencyApplicationForm } = await loadModule()
    const form = useAgencyApplicationForm('edit')

    form.phone.dialCode = '+92'
    form.prefillFromAgency(rejectedAgency())
    form.state.logo = png('new-logo.png')

    expect(form.phone.phone).toBe('3001234567')
    expect(form.isValid.value).toBe(true)

    await form.submit()

    expect(deps.logoSlot.upload).toHaveBeenCalledTimes(1)
    expect(deps.frontSlot.upload).not.toHaveBeenCalled()
    expect(deps.backSlot.upload).not.toHaveBeenCalled()
    expect(deps.resubmitApplication).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Old Name',
      address: 'Old Address',
      logo_file_id: 'logo',
      national_id_images: [
        { url: 'https://ik.imagekit.io/x/old-front.png', file_id: 'old-front', side: 'front' },
        { url: 'https://ik.imagekit.io/x/old-back.png', file_id: 'old-back', side: 'back' },
      ],
      phone_e164: '+923001234567',
    }))
    expect(navigateTo).toHaveBeenCalledWith('/agency/my-agency')
  })

  it('fills the stored phone once the dial code resolves later', async () => {
    stubDependencies()
    const { useAgencyApplicationForm } = await loadModule()
    const form = useAgencyApplicationForm('edit')

    form.prefillFromAgency(rejectedAgency())
    expect(form.phone.phone).toBe('')

    form.phone.dialCode = '+92'
    await Promise.resolve()

    expect(form.phone.phone).toBe('3001234567')
  })

  it('does not redirect when the resubmit is refused', async () => {
    const deps = stubDependencies()
    deps.resubmitApplication.mockResolvedValueOnce(false)
    const { useAgencyApplicationForm } = await loadModule()
    const form = useAgencyApplicationForm('edit')

    form.phone.dialCode = '+92'
    form.prefillFromAgency(rejectedAgency())

    await form.submit()

    expect(deps.resubmitApplication).toHaveBeenCalledTimes(1)
    expect(navigateTo).not.toHaveBeenCalled()
    expect(form.processing.value).toBe(false)
  })

  it('blocks submit with a toast when a slot has neither a file nor a kept image', async () => {
    const deps = stubDependencies()
    const { useAgencyApplicationForm } = await loadModule()
    const form = useAgencyApplicationForm('edit')

    form.phone.dialCode = '+92'
    form.prefillFromAgency(rejectedAgency({ logo_file_id: null }))

    expect(form.isValid.value).toBe(false)
    await form.submit()

    expect(deps.toastAdd).toHaveBeenCalledWith(expect.objectContaining({ title: 'Missing Logo' }))
    expect(deps.resubmitApplication).not.toHaveBeenCalled()
  })
})

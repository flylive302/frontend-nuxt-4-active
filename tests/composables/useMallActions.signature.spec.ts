/**
 * Unit tests for useMallActions — signature equip / unequip (pretty-id 06).
 *
 * Seam: the shared API composable is mocked; the mall + auth stores and the
 * user-props data composable are real (one pinia).
 *
 * Covers:
 *  - equip signature → the signed-in user's Signature is patched from the
 *    response, and My Props is re-read
 *  - unequip signature → the Signature goes back to the original's number and
 *    the original row (named by `equipped_prop_id`) is marked equipped, so
 *    exactly one signature shows equipped
 *  - the original row has no unequip: refused at the GATE (no request) and a
 *    server 422 `original_signature_locked` maps to the friendly toast
 *  - non-signature props are untouched by the signature path
 *  - `pretty_id_tier` (profile plate) stays correct: cleared with the signature,
 *    and the signed-in user is re-read only when the row now worn is a Pretty ID
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed, readonly } from 'vue'
import type { UserProp } from '../../app/types/mall/prop'
import type { BootstrapUser } from '../../app/types/user/bootstrap'
import {
  ORIGINAL_SIGNATURE_LOCKED_MESSAGE,
} from '../../app/utils/userPropOrigin'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('readonly', readonly)
vi.stubGlobal('piniaPluginPersistedstate', {
  cookies: () => ({}),
  localStorage: () => ({}),
  sessionStorage: () => ({}),
})

vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

// ========================================
// Fixtures
// ========================================

const ORIGINAL_ID = 10
const MALL_SIG_ID = 11
const FRAME_ID = 12
const PRETTY_SIG_ID = 13
const RARE_SIG_ID = 14

function makeUserProp(overrides: Partial<UserProp> & Pick<UserProp, 'id' | 'type'>): UserProp {
  return {
    prop_id: overrides.id + 100,
    name: `Prop ${overrides.id}`,
    thumbnail_url: '',
    asset_url: '',
    purchased_at: '2026-11-01T00:00:00Z',
    expires_at: null,
    is_equipped: false,
    source_type: 'purchase',
    days_remaining: null,
    is_valid: true,
    signature_value: null,
    origin: 'mall',
    ...overrides,
  }
}

/** The list as the server returns it: `equippedId` is the one signature that is equipped. */
function listPayload(equippedId: number) {
  return {
    data: {
      props: [
        makeUserProp({
          id: ORIGINAL_ID, type: 'signature', signature_value: '8123456',
          origin: 'original_signature', source_type: 'system', is_equipped: equippedId === ORIGINAL_ID,
        }),
        makeUserProp({
          id: MALL_SIG_ID, type: 'signature', signature_value: '777777',
          is_equipped: equippedId === MALL_SIG_ID,
        }),
        makeUserProp({
          id: PRETTY_SIG_ID, type: 'signature', signature_value: '123456',
          origin: 'pretty_id', is_equipped: equippedId === PRETTY_SIG_ID,
        }),
        makeUserProp({
          id: RARE_SIG_ID, type: 'signature', signature_value: '007',
          origin: 'rare_id', expires_at: '2026-12-01T00:00:00Z', is_equipped: equippedId === RARE_SIG_ID,
        }),
      ],
      pagination: { next_cursor: null, has_more: false },
    },
  }
}

// ========================================
// Harness
// ========================================

let apiMock = vi.fn()
const toastAdd = vi.fn()
const emitProfileSync = vi.fn()
const syncUser = vi.fn().mockResolvedValue(undefined)

beforeEach(() => {
  vi.resetModules()
  setActivePinia(createPinia())
  apiMock = vi.fn()
  toastAdd.mockClear()
  emitProfileSync.mockClear()
  syncUser.mockClear()
  ;(globalThis as Record<string, unknown>).useApi = () => ({
    api: (...args: unknown[]) => apiMock(...args),
    normalizeError: (e: unknown) => {
      const err = e as { message?: string, status?: number, meta?: Record<string, unknown> }
      return { message: err.message ?? 'Request failed.', status: err.status, meta: err.meta }
    },
  })
  ;(globalThis as Record<string, unknown>).useToast = () => ({ add: toastAdd })
  ;(globalThis as Record<string, unknown>).useProfileActions = () => ({ emitProfileSync })
  ;(globalThis as Record<string, unknown>).useUserSync = () => ({ syncUser })
})

afterEach(() => {
  for (const key of ['useApi', 'useToast', 'useProfileActions', 'useUserSync', 'useMallStore', 'useMallUserProps']) {
    Reflect.deleteProperty(globalThis, key)
  }
})

async function setup(opts: { equippedId: number, prettyIdTier?: 6 | 4 | null, plate?: boolean }) {
  const { useMallStore } = await import('../../app/stores/mall')
  const { useAuthStore } = await import('../../app/stores/auth')
  const { useMallUserProps } = await import('../../app/composables/mall/useMallUserProps')

  const mallStore = useMallStore()
  const authStore = useAuthStore()
  authStore.setUser({
    id: 1,
    signature: opts.equippedId === ORIGINAL_ID ? '8123456' : '777777',
    pretty_id_tier: opts.prettyIdTier ?? null,
    has_pretty_id_plate: opts.plate ?? opts.prettyIdTier != null,
  } as unknown as BootstrapUser)
  ;(globalThis as Record<string, unknown>).useMallStore = () => mallStore
  ;(globalThis as Record<string, unknown>).useMallUserProps = () => useMallUserProps()

  const mallProps = listPayload(opts.equippedId).data.props
  mallStore.setUserPropsItems([
    ...mallProps,
    makeUserProp({ id: FRAME_ID, type: 'frame', is_equipped: true }),
  ])
  mallStore.setEquippedForType('signature', {
    id: opts.equippedId, prop_id: opts.equippedId + 100, name: 'sig', asset_url: '',
  })

  const { useMallActions } = await import('../../app/composables/mall/useMallActions')
  return { mallStore, authStore, actions: useMallActions() }
}

const equippedSignatureIds = (items: UserProp[]) =>
  items.filter(p => p.type === 'signature' && p.is_equipped).map(p => p.id)

// ========================================
// Specs
// ========================================

describe('useMallActions — signature equip', () => {
  it('patches the signed-in user\'s Signature from the response and re-reads My Props', async () => {
    const { mallStore, authStore, actions } = await setup({ equippedId: ORIGINAL_ID })
    apiMock.mockImplementation((url: string) => {
      if (url === `/props/${MALL_SIG_ID}/equip`) {
        return Promise.resolve({ data: { equipped_prop_id: MALL_SIG_ID, type: 'signature', signature: '777777' } })
      }
      if (url === '/user/props') return Promise.resolve(listPayload(MALL_SIG_ID))
      throw new Error(`unexpected url ${url}`)
    })

    const ok = await actions.equipProp(MALL_SIG_ID)

    expect(ok).toBe(true)
    expect(authStore.user?.signature).toBe('777777')
    expect(emitProfileSync).toHaveBeenCalledWith({ signature: '777777' })
    expect(apiMock).toHaveBeenCalledWith('/user/props', expect.anything())
    expect(equippedSignatureIds(mallStore.userProps.items)).toEqual([MALL_SIG_ID])
  })

  it('leaves the Signature alone when the equip is refused', async () => {
    const { mallStore, authStore, actions } = await setup({ equippedId: ORIGINAL_ID })
    apiMock.mockRejectedValue(Object.assign(new Error('Signature taken'), { status: 409 }))

    const ok = await actions.equipProp(MALL_SIG_ID)

    expect(ok).toBe(false)
    expect(authStore.user?.signature).toBe('8123456')
    expect(equippedSignatureIds(mallStore.userProps.items)).toEqual([ORIGINAL_ID])
  })

  it('does not touch the Signature when a non-signature prop is equipped', async () => {
    const { authStore, actions } = await setup({ equippedId: ORIGINAL_ID })
    apiMock.mockResolvedValue({ data: { equipped_prop_id: FRAME_ID, type: 'frame', signature: null } })

    await actions.equipProp(FRAME_ID)

    expect(authStore.user?.signature).toBe('8123456')
    expect(apiMock).not.toHaveBeenCalledWith('/user/props', expect.anything())
  })
})

describe('useMallActions — best-effort follow-up after a successful signature call', () => {
  /** The My Props re-read blows up AFTER the server call succeeded. */
  function breakListReRead(): void {
    ;(globalThis as Record<string, unknown>).useMallUserProps = () => ({
      fetchUserProps: () => Promise.reject(new Error('re-read exploded')),
    })
  }

  it('equip: a throwing list re-read is still a success — success toast, no failure toast, signature patched', async () => {
    const { authStore, actions } = await setup({ equippedId: ORIGINAL_ID })
    breakListReRead()
    apiMock.mockImplementation((url: string) => {
      if (url === `/props/${MALL_SIG_ID}/equip`) {
        return Promise.resolve({ data: { equipped_prop_id: MALL_SIG_ID, type: 'signature', signature: '777777' } })
      }
      throw new Error(`unexpected url ${url}`)
    })

    const ok = await actions.equipProp(MALL_SIG_ID)

    expect(ok).toBe(true)
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ title: 'Prop Equipped' }))
    expect(toastAdd).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Equip Failed' }))
    expect(authStore.user?.signature).toBe('777777')
    expect(emitProfileSync).toHaveBeenCalledWith({ signature: '777777' })
  })

  it('equip: a throwing room emit does not fail the equip either', async () => {
    const { authStore, actions } = await setup({ equippedId: ORIGINAL_ID })
    emitProfileSync.mockImplementationOnce(() => { throw new Error('socket down') })
    apiMock.mockImplementation((url: string) => {
      if (url === `/props/${MALL_SIG_ID}/equip`) {
        return Promise.resolve({ data: { equipped_prop_id: MALL_SIG_ID, type: 'signature', signature: '777777' } })
      }
      if (url === '/user/props') return Promise.resolve(listPayload(MALL_SIG_ID))
      throw new Error(`unexpected url ${url}`)
    })

    const ok = await actions.equipProp(MALL_SIG_ID)

    expect(ok).toBe(true)
    expect(toastAdd).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Equip Failed' }))
    expect(authStore.user?.signature).toBe('777777')
  })

  it('unequip: a throwing list re-read is still a success — success toast, no failure toast, signature patched', async () => {
    const { mallStore, authStore, actions } = await setup({ equippedId: MALL_SIG_ID })
    breakListReRead()
    apiMock.mockImplementation((url: string) => {
      if (url === `/props/${MALL_SIG_ID}/unequip`) {
        return Promise.resolve({
          data: { type: 'signature', prop_id: MALL_SIG_ID + 100, equipped_prop_id: ORIGINAL_ID, signature: '8123456' },
        })
      }
      throw new Error(`unexpected url ${url}`)
    })

    const ok = await actions.unequipProp(MALL_SIG_ID)

    expect(ok).toBe(true)
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ title: 'Prop Unequipped' }))
    expect(toastAdd).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Unequip Failed' }))
    expect(authStore.user?.signature).toBe('8123456')
    expect(mallStore.equipped.signature?.id).toBe(ORIGINAL_ID)
  })
})

describe('useMallActions — pretty_id_tier (profile plate)', () => {
  it('equipping a mall signature clears the tier and does not re-read the user', async () => {
    const { authStore, actions } = await setup({ equippedId: PRETTY_SIG_ID, prettyIdTier: 6 })
    apiMock.mockImplementation((url: string) => {
      if (url === `/props/${MALL_SIG_ID}/equip`) {
        return Promise.resolve({ data: { equipped_prop_id: MALL_SIG_ID, type: 'signature', signature: '777777' } })
      }
      if (url === '/user/props') return Promise.resolve(listPayload(MALL_SIG_ID))
      throw new Error(`unexpected url ${url}`)
    })

    await actions.equipProp(MALL_SIG_ID)

    expect(authStore.user?.pretty_id_tier).toBeNull()
    expect(authStore.user?.has_pretty_id_plate).toBe(false)
    expect(syncUser).not.toHaveBeenCalled()
  })

  it('equipping a Pretty ID drops the stale tier at once, then re-reads the user for the real one', async () => {
    const { authStore, actions } = await setup({ equippedId: ORIGINAL_ID })
    apiMock.mockImplementation((url: string) => {
      if (url === `/props/${PRETTY_SIG_ID}/equip`) {
        return Promise.resolve({ data: { equipped_prop_id: PRETTY_SIG_ID, type: 'signature', signature: '123456' } })
      }
      if (url === '/user/props') return Promise.resolve(listPayload(PRETTY_SIG_ID))
      throw new Error(`unexpected url ${url}`)
    })

    await actions.equipProp(PRETTY_SIG_ID)

    expect(authStore.user?.signature).toBe('123456')
    expect(authStore.user?.pretty_id_tier).toBeNull()
    expect(authStore.user?.has_pretty_id_plate).toBe(false)
    expect(syncUser).toHaveBeenCalledTimes(1)
  })

  it('equipping a Rare ID drops the stale plate at once, then re-reads the user for the real one', async () => {
    const { authStore, actions } = await setup({ equippedId: ORIGINAL_ID })
    apiMock.mockImplementation((url: string) => {
      if (url === `/props/${RARE_SIG_ID}/equip`) {
        return Promise.resolve({ data: { equipped_prop_id: RARE_SIG_ID, type: 'signature', signature: '007' } })
      }
      if (url === '/user/props') return Promise.resolve(listPayload(RARE_SIG_ID))
      throw new Error(`unexpected url ${url}`)
    })

    await actions.equipProp(RARE_SIG_ID)

    expect(authStore.user?.signature).toBe('007')
    expect(authStore.user?.pretty_id_tier).toBeNull()
    expect(authStore.user?.has_pretty_id_plate).toBe(false)
    expect(syncUser).toHaveBeenCalledTimes(1)
  })

  it('switching back to the original clears the tier without a user re-read', async () => {
    const { authStore, actions } = await setup({ equippedId: PRETTY_SIG_ID, prettyIdTier: 6 })
    apiMock.mockImplementation((url: string) => {
      if (url === `/props/${PRETTY_SIG_ID}/unequip`) {
        return Promise.resolve({
          data: { type: 'signature', prop_id: PRETTY_SIG_ID + 100, equipped_prop_id: ORIGINAL_ID, signature: '8123456' },
        })
      }
      if (url === '/user/props') return Promise.resolve(listPayload(ORIGINAL_ID))
      throw new Error(`unexpected url ${url}`)
    })

    await actions.unequipProp(PRETTY_SIG_ID)

    expect(authStore.user?.signature).toBe('8123456')
    expect(authStore.user?.pretty_id_tier).toBeNull()
    expect(authStore.user?.has_pretty_id_plate).toBe(false)
    expect(syncUser).not.toHaveBeenCalled()
  })

  it('a refused equip leaves the tier alone', async () => {
    const { authStore, actions } = await setup({ equippedId: PRETTY_SIG_ID, prettyIdTier: 6 })
    apiMock.mockRejectedValue(Object.assign(new Error('Signature taken'), { status: 409 }))

    await actions.equipProp(MALL_SIG_ID)

    expect(authStore.user?.pretty_id_tier).toBe(6)
    expect(authStore.user?.has_pretty_id_plate).toBe(true)
    expect(syncUser).not.toHaveBeenCalled()
  })
})

describe('useMallActions — signature unequip', () => {
  it('switches back to the original: Signature patched, original row equipped, exactly one equipped', async () => {
    const { mallStore, authStore, actions } = await setup({ equippedId: MALL_SIG_ID })
    apiMock.mockImplementation((url: string) => {
      if (url === `/props/${MALL_SIG_ID}/unequip`) {
        return Promise.resolve({
          data: { type: 'signature', prop_id: MALL_SIG_ID + 100, equipped_prop_id: ORIGINAL_ID, signature: '8123456' },
        })
      }
      if (url === '/user/props') return Promise.resolve(listPayload(ORIGINAL_ID))
      throw new Error(`unexpected url ${url}`)
    })

    const ok = await actions.unequipProp(MALL_SIG_ID)

    expect(ok).toBe(true)
    expect(authStore.user?.signature).toBe('8123456')
    expect(emitProfileSync).toHaveBeenCalledWith({ signature: '8123456' })
    expect(equippedSignatureIds(mallStore.userProps.items)).toEqual([ORIGINAL_ID])
    expect(mallStore.equipped.signature?.id).toBe(ORIGINAL_ID)
  })

  it('mirrors the original into the equipped map even if the re-read fails', async () => {
    const { mallStore, actions } = await setup({ equippedId: MALL_SIG_ID })
    apiMock.mockImplementation((url: string) => {
      if (url === `/props/${MALL_SIG_ID}/unequip`) {
        return Promise.resolve({
          data: { type: 'signature', prop_id: MALL_SIG_ID + 100, equipped_prop_id: ORIGINAL_ID, signature: '8123456' },
        })
      }
      return Promise.reject(new Error('offline'))
    })

    await actions.unequipProp(MALL_SIG_ID)

    // The equipped map names the original without waiting for the re-read.
    expect(mallStore.equipped.signature?.id).toBe(ORIGINAL_ID)
  })

  it('refuses to unequip the original at the GATE — no request is sent', async () => {
    const { authStore, actions } = await setup({ equippedId: ORIGINAL_ID })

    const ok = await actions.unequipProp(ORIGINAL_ID)

    expect(ok).toBe(false)
    expect(apiMock).not.toHaveBeenCalled()
    expect(authStore.user?.signature).toBe('8123456')
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ description: ORIGINAL_SIGNATURE_LOCKED_MESSAGE }))
  })

  it('maps a server 422 original_signature_locked to the friendly toast and keeps state', async () => {
    const { mallStore, authStore, actions } = await setup({ equippedId: MALL_SIG_ID })
    apiMock.mockRejectedValue(Object.assign(new Error('Unprocessable'), {
      status: 422,
      meta: { error_code: 'original_signature_locked' },
    }))

    const ok = await actions.unequipProp(MALL_SIG_ID)

    expect(ok).toBe(false)
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ description: ORIGINAL_SIGNATURE_LOCKED_MESSAGE }))
    expect(authStore.user?.signature).toBe('777777')
    expect(equippedSignatureIds(mallStore.userProps.items)).toEqual([MALL_SIG_ID])
  })
})

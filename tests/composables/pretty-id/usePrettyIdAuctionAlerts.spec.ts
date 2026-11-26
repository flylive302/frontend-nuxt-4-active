import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { readonly, ref } from 'vue'
import { usePrettyIdAuctionAlerts } from '~/composables/pretty-id/usePrettyIdAuctionAlerts'
import { usePrettyIdAuctionAlertsStore } from '~/stores/prettyIdAuctionAlerts'

const apiMock = vi.fn()
const toastAdd = vi.fn()

vi.mock('~/composables/shared/useApi', () => ({
  useApi: () => ({ api: apiMock }),
}))
vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

vi.stubGlobal('ref', ref)
vi.stubGlobal('readonly', readonly)
vi.stubGlobal('useToast', () => ({ add: toastAdd }))

describe('usePrettyIdAuctionAlerts', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    apiMock.mockReset()
    toastAdd.mockReset()
  })

  describe('load', () => {
    it('GETs the saved choice into the store', async () => {
      apiMock.mockResolvedValue({ data: { enabled: false } })
      const store = usePrettyIdAuctionAlertsStore()
      await usePrettyIdAuctionAlerts().load()
      expect(apiMock).toHaveBeenCalledWith('/pretty-id/auction-alerts')
      expect(store.enabled).toBe(false)
      expect(store.isLoaded).toBe(true)
    })

    it('stays on and silent when the GET fails', async () => {
      apiMock.mockRejectedValue(new Error('down'))
      const store = usePrettyIdAuctionAlertsStore()
      await usePrettyIdAuctionAlerts().load()
      expect(store.enabled).toBe(true)
      expect(store.isLoaded).toBe(false)
      expect(toastAdd).not.toHaveBeenCalled()
    })
  })

  describe('setEnabled', () => {
    it('flips at once, PUTs the absolute value and keeps the server answer', async () => {
      let resolvePut: (value: unknown) => void = () => {}
      apiMock.mockReturnValue(new Promise((resolve) => {
        resolvePut = resolve
      }))
      const store = usePrettyIdAuctionAlertsStore()
      const pending = usePrettyIdAuctionAlerts().setEnabled(false)

      expect(store.enabled).toBe(false)
      expect(store.isSaving).toBe(true)
      expect(apiMock).toHaveBeenCalledWith('/pretty-id/auction-alerts', { method: 'PUT', body: { enabled: false } })

      resolvePut({ data: { enabled: false } })
      expect(await pending).toBe(true)
      expect(store.enabled).toBe(false)
      expect(store.isSaving).toBe(false)
      expect(toastAdd).not.toHaveBeenCalled()
    })

    it('rolls back and toasts when the PUT fails', async () => {
      apiMock.mockRejectedValue(new Error('down'))
      const store = usePrettyIdAuctionAlertsStore()
      expect(await usePrettyIdAuctionAlerts().setEnabled(false)).toBe(false)
      expect(store.enabled).toBe(true)
      expect(store.isSaving).toBe(false)
      expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Could not update auction alerts. Please try again.',
        color: 'error',
      }))
    })

    it('ignores a second change while one is saving', async () => {
      apiMock.mockReturnValue(new Promise(() => {}))
      const alerts = usePrettyIdAuctionAlerts()
      void alerts.setEnabled(false)
      expect(await alerts.setEnabled(true)).toBe(false)
      expect(apiMock).toHaveBeenCalledTimes(1)
    })

    it('can turn alerts back on', async () => {
      apiMock.mockResolvedValue({ data: { enabled: true } })
      const store = usePrettyIdAuctionAlertsStore()
      store.setServerEnabled(false)
      expect(await usePrettyIdAuctionAlerts().setEnabled(true)).toBe(true)
      expect(store.enabled).toBe(true)
      expect(apiMock).toHaveBeenCalledWith('/pretty-id/auction-alerts', { method: 'PUT', body: { enabled: true } })
    })
  })
})

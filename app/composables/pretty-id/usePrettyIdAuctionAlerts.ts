/**
 * The "Auction alerts" toggle of the Rare Auction tab.
 *
 * `GET` / `PUT /pretty-id/auction-alerts`: whether the viewer receives the
 * GLOBAL auction pushes (reminders, bid pushes). It never touches personal
 * notifications (won, refunds, expiry), which the server always sends.
 *
 * GATE: one change at a time. EXECUTE: optimistic flip, then the PUT; the
 * server's answer wins. REACT: a failed PUT rolls the switch back and toasts.
 * A failed GET is only logged: the switch simply stays at the server default (on)
 * and a tap still sets the absolute value.
 */

import { useApi } from '~/composables/shared/useApi'
import { usePrettyIdToast } from '~/composables/pretty-id/usePrettyIdToast'
import { usePrettyIdAuctionAlertsStore } from '~/stores/prettyIdAuctionAlerts'
import { createLogger } from '~/utils/logger'

const log = createLogger('[PrettyIdAuctionAlerts]')

const ALERTS_URL = '/pretty-id/auction-alerts'
const SAVE_FAILED_MESSAGE = 'Could not update auction alerts. Please try again.'

interface AlertsEnvelope {
  data: { enabled: boolean }
}

export function usePrettyIdAuctionAlerts() {
  const { api } = useApi()
  const store = usePrettyIdAuctionAlertsStore()
  const toast = usePrettyIdToast()

  /** Reads the saved choice into the store. Quiet on failure. */
  async function load(): Promise<void> {
    try {
      const response = await api<AlertsEnvelope>(ALERTS_URL)
      store.setServerEnabled(response.data.enabled)
    } catch (err) {
      log.warn('GET auction-alerts failed', err)
    }
  }

  /** Saves a new choice. Resolves `true` when the server has it, `false` when it did not (or a save is already running). */
  async function setEnabled(next: boolean): Promise<boolean> {
    // GATE
    if (store.isSaving) return false

    const previous = store.enabled
    store.setSaving(true)
    store.setEnabled(next)

    // EXECUTE
    try {
      const response = await api<AlertsEnvelope>(ALERTS_URL, {
        method: 'PUT',
        body: { enabled: next },
      })
      store.setServerEnabled(response.data.enabled)
      return true
    } catch (err) {
      // REACT
      log.warn('PUT auction-alerts failed — rolling back', err)
      store.setEnabled(previous)
      toast.error(SAVE_FAILED_MESSAGE)
      return false
    } finally {
      store.setSaving(false)
    }
  }

  return { load, setEnabled }
}

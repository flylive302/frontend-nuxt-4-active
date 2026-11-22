/**
 * Dev panel — thin wrapper over the mock backend's test levers.
 *
 * Available only while `usePrettyIdMockControls()` returns controls (it returns
 * `null` once the real API is wired, which hides the panel). After every lever
 * the mirrored `state` is refreshed and the visible data is reloaded, so the
 * page reflects the change at once.
 */

import { usePrettyIdAuctionData } from '~/composables/pretty-id/usePrettyIdAuctionData'
import { usePrettyIdMockControls } from '~/composables/pretty-id/usePrettyIdApi'
import { usePrettyIdData } from '~/composables/pretty-id/usePrettyIdData'
import { usePrettyIdToast } from '~/composables/pretty-id/usePrettyIdToast'
import { usePrettyIdStore } from '~/stores/prettyId'
import { usePrettyIdAuctionStore } from '~/stores/prettyIdAuction'
import type { PrettyIdMockState } from '~/types/pretty-id'
import { formatCoins } from '~/utils/currency'

export function usePrettyIdDevPanel() {
  const controls = usePrettyIdMockControls()
  const store = usePrettyIdStore()
  const auctionStore = usePrettyIdAuctionStore()
  const toast = usePrettyIdToast()
  const { loadMe, loadList } = usePrettyIdData()
  const { loadLots } = usePrettyIdAuctionData()

  const isAvailable = controls !== null
  const state = ref<PrettyIdMockState | null>(controls?.state() ?? null)

  /**
   * Opens the sheet. `state` is per instance and read at creation, and the
   * panel body is mounted only while the sheet is open — so every open shows a
   * fresh reading without this instance having to push one across.
   */
  function open(): void {
    if (!controls) return
    store.setDevPanelOpen(true)
  }

  function close(): void {
    store.setDevPanelOpen(false)
  }

  /** REACT — mirror the mock's state and repaint the visible data. */
  async function refresh(): Promise<void> {
    state.value = controls?.state() ?? null
    await Promise.all([loadMe(), loadList(), loadLots()])
  }

  async function setLevel(level: number): Promise<void> {
    if (!controls) return
    controls.setLevel(level)
    toast.info(`Level set to Lv ${level}`)
    await refresh()
  }

  /** `0` empties the balance. */
  async function addCoins(amount: number): Promise<void> {
    if (!controls) return
    controls.addCoins(amount)
    toast.info(amount === 0 ? 'Coins emptied' : `Added ${formatCoins(amount)} coins`)
    await refresh()
  }

  async function skipHours(hours: number): Promise<void> {
    if (!controls) return
    controls.skipHours(hours)
    toast.info(`Skipped ${hours}h`)
    await refresh()
  }

  async function rivalBidsNow(): Promise<void> {
    if (!controls) return
    const placed = controls.rivalBidsNow()
    toast.info(`${placed} rival bid${placed === 1 ? '' : 's'} placed`)
    await refresh()
  }

  async function endAllAuctions(): Promise<void> {
    if (!controls) return
    controls.endAllAuctions()
    toast.info('All auctions ended')
    await refresh()
  }

  /** Arms / disarms the "next claim is stolen" lever. */
  async function toggleRace(): Promise<void> {
    if (!controls) return
    controls.toggleRace()
    toast.info(controls.state().race_armed ? 'Next claim will be taken by someone else' : 'Race disarmed')
    await refresh()
  }

  async function addChangeToken(): Promise<void> {
    if (!controls) return
    if (!controls.addChangeToken()) {
      toast.error('Claim an ID first')
      return
    }
    toast.info('+1 token on each claimed slot')
    await refresh()
  }

  async function reset(): Promise<void> {
    if (!controls) return
    controls.reset()
    // Local view state (claim target, change mode, filters, lots) belongs to the data just wiped.
    store.reset()
    auctionStore.reset()
    toast.info('Demo data reset')
    await refresh()
  }

  return {
    isAvailable,
    state: readonly(state),
    open,
    close,
    setLevel,
    addCoins,
    skipHours,
    rivalBidsNow,
    endAllAuctions,
    toggleRace,
    addChangeToken,
    reset,
  }
}

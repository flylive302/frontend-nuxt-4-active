/**
 * App-level celebration for a Rare Auction the viewer won while away.
 *
 * `checkUnseenWins` runs on app open, after a login, when the Pretty ID flags
 * turn on, and on every app foreground. It shows the first unseen win not yet
 * celebrated this session, then marks it seen and refreshes the user so the new
 * Signature shows (and tells the room). Every function runs GATE → EXECUTE →
 * REACT; the REACT parts (confetti, mark seen, user refresh) never block the screen.
 *
 * Ships inert: while the bootstrap `pretty_id` event or auction switch is off,
 * no request is made. A 404 or any other failure means "nothing to show": logged,
 * never surfaced. A failed mark-seen is not retried: the win's id is already in
 * the store's shown-wins set, so the celebration cannot come back this session; the server
 * shows it again on the next app open.
 */

import { usePrettyIdAuctionApi } from '~/composables/pretty-id/usePrettyIdAuctionApi'
import { usePrettyIdConfetti } from '~/composables/pretty-id/usePrettyIdConfetti'
import { PRETTY_ID_MY_PROPS_ROUTE } from '~/constants/pretty-id'
import { useUserSync } from '~/composables/shared/useUserSync'
import { useAuthStore } from '~/stores/auth'
import { useBootstrapStore } from '~/stores/bootstrap'
import { usePrettyIdAuctionStore } from '~/stores/prettyIdAuction'
import type { PrettyIdAuctionUnseenWin } from '~/types/pretty-id-auction'
import { createLogger } from '~/utils/logger'
import { toPrettyIdAuctionError } from '~/utils/pretty-id-auction-error'

const log = createLogger('[PrettyIdUnseenWins]')

export function usePrettyIdUnseenWins() {
  const api = usePrettyIdAuctionApi()
  const authStore = useAuthStore()
  const bootstrapStore = useBootstrapStore()
  const store = usePrettyIdAuctionStore()
  const { fireConfetti } = usePrettyIdConfetti()
  const { syncUser } = useUserSync()
  const { emitProfileSync } = useProfileActions()

  /** True while a request may be made: signed in and the event + auction switches are on. */
  function isCheckAllowed(): boolean {
    return authStore.isAuthenticated && bootstrapStore.prettyIdAuctionEnabled
  }

  /** REACT — tells room participants the new Signature. Best-effort, like the claim flow. */
  function emitSignatureToRoom(signature: string): void {
    try {
      emitProfileSync({ signature })
    } catch {
      // Silent — best-effort optimization
    }
  }

  /** REACT — the win is seen for good; the user is refreshed so `signature` shows the Rare ID. */
  async function markSeenAndRefresh(win: PrettyIdAuctionUnseenWin): Promise<void> {
    try {
      await api.markWinSeen(win.auction_id)
    } catch (err) {
      log.warn('Mark win seen failed', { auctionId: win.auction_id, code: toPrettyIdAuctionError(err).code })
    }
    await syncUser()
    const signature = authStore.user?.signature
    if (signature) emitSignatureToRoom(signature)
  }

  async function checkUnseenWins(): Promise<void> {
    // GATE
    if (!isCheckAllowed() || store.isCheckingWins || store.winCelebration !== null) return

    // EXECUTE
    store.setCheckingWins(true)
    let wins: PrettyIdAuctionUnseenWin[]
    try {
      wins = await api.unseenWins()
    } catch (err) {
      const { code } = toPrettyIdAuctionError(err)
      if (code !== 'not_found') log.warn('Unseen wins check failed', { code })
      return
    } finally {
      store.setCheckingWins(false)
    }
    const win = wins.find(candidate => !store.hasShownWin(candidate.auction_id))
    // Logged out or the switch turned off while the request was in flight: nobody to congratulate.
    if (win === undefined || !isCheckAllowed()) return

    // REACT
    store.markWinShown(win.auction_id)
    store.setWinCelebration(win)
    void fireConfetti()
    void markSeenAndRefresh(win)
  }

  /** "Done". */
  function finishWinCelebration(): void {
    store.setWinCelebration(null)
  }

  /** "View in My Props": closes the celebration and opens My Props on the signature tab. */
  async function viewWinInMyProps(): Promise<void> {
    store.setWinCelebration(null)
    await navigateTo(PRETTY_ID_MY_PROPS_ROUTE)
  }

  return { checkUnseenWins, finishWinCelebration, viewWinInMyProps }
}

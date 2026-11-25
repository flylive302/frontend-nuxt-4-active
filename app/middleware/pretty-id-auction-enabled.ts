// ========================================
// Pretty ID Rare Auction Gate
// ========================================
//
// GATE. Auction-only routes 404 unless the event AND its own
// `pretty_id.auction_enabled` switch are on (`prettyIdAuctionEnabled`).
// Same bounded wait-for-bootstrap as pretty-id-enabled; failed / timed-out
// bootstrap counts as off.
//
// NOT attached to `/pretty-id/auction` itself: that tab must stay reachable
// and show its "Coming soon" panel while the auction is off. It is for the
// later auction routes (auction/[id], winners, weekly), which must not open
// before the auction is live.
import { PRETTY_ID_GATE_WAIT_MS } from '~/constants/bootstrap'
import { awaitBootstrapSettled } from '~/utils/await-bootstrap-settled'

export default defineNuxtRouteMiddleware(async () => {
  const bootstrapStore = useBootstrapStore()

  await awaitBootstrapSettled(bootstrapStore, PRETTY_ID_GATE_WAIT_MS)

  if (!bootstrapStore.prettyIdAuctionEnabled) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', fatal: true })
  }
})

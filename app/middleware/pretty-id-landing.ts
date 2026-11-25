// ========================================
// Pretty ID Landing Redirect
// ========================================
//
// GATE (routing). `/pretty-id` is entry-only: it sends the user to the tab the
// event opens on — Rare Auction while the auction is live, else Choose ID.
// Runs after `pretty-id-enabled`, which already waited for bootstrap to settle.
//
// Why a redirect from a dedicated entry path and not "Choose lives at
// /pretty-id": a redirect keyed on `from` would bounce back-navigation from My
// Props / levels onto the auction tab. Choose has its own stable path
// (`/pretty-id/choose`) that never redirects.
import { prettyIdDefaultRoute } from '~/utils/pretty-id-tabs'

export default defineNuxtRouteMiddleware(() => {
  const bootstrapStore = useBootstrapStore()
  return navigateTo(prettyIdDefaultRoute(bootstrapStore.prettyIdAuctionEnabled), { replace: true })
})

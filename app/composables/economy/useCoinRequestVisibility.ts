// ========================================
// Coins page visibility gates
// ========================================
// GATE-only decisions for `pages/coins/request.vue`:
//
// - `showCoinRequests` — the reseller "claim coins" flow. Android native ONLY,
//   and only once in-store purchase is confirmed impossible. Fails CLOSED:
//   the flow is store-review sensitive (Apple 3.1.1; Android mirrors it once
//   Google Play billing is available) and must never appear because of a
//   transient load failure. Web no longer shows it — web buys on the portal.
// - `showRechargePortal` — the link out to the web coin shop. Web ONLY: an
//   outside-purchase link is the same store-review risk on iOS and Android,
//   including an Android shell whose Google catalog is off.
// ========================================

import { isIosNative, storeFor } from '~/utils/native-platform'

export function useCoinRequestVisibility() {
  const store = useCoinPacksStore()

  const showCoinRequests = computed(() => {
    // iOS native: always hidden (App Store 3.1.1 — unconditional).
    if (isIosNative()) return false

    const iapStore = storeFor()
    // Web (no native store): hidden — web users buy on the recharge portal.
    if (iapStore === null) return false

    // Android native: shown ONLY once in-store purchase is definitively
    // impossible — the backend 404s the Google catalog (flag off) or the
    // shell has no billing plugin. Loading, a network/5xx error, or an
    // available catalog resolve to hidden — never show the reseller UI on a guess.
    return store.catalogDisabled
  })

  // Platform never changes at runtime — a plain boolean, not a computed.
  const showRechargePortal = storeFor() === null

  return { showCoinRequests, showRechargePortal }
}

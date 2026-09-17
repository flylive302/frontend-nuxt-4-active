// ========================================
// Coin Request (reseller "claim coins") Visibility
// ========================================
// GATE-only decision: whether `request.vue` may show the reseller
// "claim coins" flow. Fails CLOSED on native — the flow is store-review
// sensitive (Apple 3.1.1; Android mirrors it once Google Play billing is
// available) and must never appear because of a transient load failure.
// ========================================

import { isIosNative, storeFor } from '~/utils/native-platform'

export function useCoinRequestVisibility() {
  const store = useCoinPacksStore()

  const showCoinRequests = computed(() => {
    // iOS native: always hidden (App Store 3.1.1 — unconditional).
    if (isIosNative()) return false

    const iapStore = storeFor()
    // Web (no native store): unchanged, always shown.
    if (iapStore === null) return true

    // Android native: shown ONLY once in-store purchase is definitively
    // impossible — the backend 404s the Google catalog (flag off) or the
    // shell has no billing plugin. Loading, a network/5xx error, or an
    // available catalog resolve to hidden — never show the reseller UI on a guess.
    return store.catalogDisabled
  })

  return { showCoinRequests }
}

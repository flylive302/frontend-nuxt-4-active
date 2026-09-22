/**
 * Balance Seed Plugin — the ONE place `auth.user` identity feeds `balance`.
 *
 * `useBalanceStore` is in-memory only (see its header). It is seeded from the
 * persisted `auth.user` snapshot whenever the authenticated user's identity
 * changes:
 *   - cold start (`immediate`): persisted user restored → last-synced balance
 *     paints instantly; `useUserSync().syncUser()` refreshes it after paint.
 *   - login / user switch: fresh `/auth/*` payload → seed + new watermark.
 *   - logout: reset numbers and the per-user `seq` watermark.
 *
 * A same-user `setUser()` (profile edit, `/auth/user` resync) does NOT pass
 * through here — the balance is not a profile edit's to set, and the resync
 * path seeds explicitly with its own seq race-guard (`useUserSync`).
 * Stores never import stores, so the cross-store hop lives here.
 *
 * @see stores/balance.ts
 * @see composables/shared/useUserSync.ts
 */
export default defineNuxtPlugin(() => {
  const authStore = useAuthStore()
  const balanceStore = useBalanceStore()

  watch(
    () => authStore.user?.id ?? null,
    (id) => {
      if (id === null) {
        balanceStore.reset()
        return
      }
      balanceStore.reset()
      if (authStore.user) balanceStore.seed(authStore.user)
    },
    { immediate: true },
  )
})

// ========================================
// Balance Store — IN-MEMORY ONLY
// ========================================
// The authenticated user's spendable balance and XP: `coins`, `diamonds`,
// `wealth_xp`, `charm_xp`, plus the per-user ledger `seq` watermark.
//
// 🔴 This store must never get a `persist:` block. A lucky-gift combo writes
// the balance once per tap (optimistic debit), once per ack and once per
// `balance.updated` push — hundreds of writes a minute. These fields used to
// live on the persisted `auth` store, where Pinia's persistence watcher is
// `{ deep: true }` over the WHOLE store and ignores `pick`, so every tap
// deep-walked, serialised and re-wrote storage on the main thread — the
// documented root cause of low-end Android freezing under lucky combos
// (docs/issues/lucky-tap-balance-store/, gotchas/frontend.md § "Pinia
// persistence is a hidden per-mutation tax").
//
// Lifecycle: the server owns these numbers. On cold start the store is seeded
// from the persisted `auth.user` snapshot (plugins/balance-seed.client.ts),
// then `useUserSync().syncUser()` refreshes it from `GET /auth/user`.
// Cross-store seeding lives in that plugin and in `useUserSync` — stores never
// import stores.

import { defineStore } from 'pinia'

/** Wire shape shared by `BootstrapUser` and `BalanceUpdatedPayload`. */
export interface BalanceSnapshot {
  coins: string
  diamonds: string
  wealth_xp: string
  charm_xp: string
}

export type BalancePatch = Partial<BalanceSnapshot>

export const useBalanceStore = defineStore('balance', () => {
  // ========================================
  // State — integers as strings, same as the API. `null` = never seeded.
  // ========================================
  const coins = ref<string | null>(null)
  const diamonds = ref<string | null>(null)
  const wealthXp = ref<string | null>(null)
  const charmXp = ref<string | null>(null)
  /**
   * High watermark for `apply` (gift-authority-tick-fanout ticket 13).
   * The `seq` is a monotonic per-user ledger counter minted server-side in
   * Redis (MSAB `domains/gift/ledger.lua-scripts.ts`) — durable across a
   * socket reconnect, so this is reset only on logout / user switch
   * (`reset()`), never on reconnect and never by `seed()`.
   */
  const seq = ref(0)

  // ========================================
  // Getters
  // ========================================
  const isSeeded = computed(() => coins.value !== null)
  const coinsNumber = computed(() => Number(coins.value ?? 0))
  const diamondsNumber = computed(() => Number(diamonds.value ?? 0))
  const wealthXpNumber = computed(() => Number(wealthXp.value ?? 0))
  const charmXpNumber = computed(() => Number(charmXp.value ?? 0))

  // ========================================
  // Setters
  // ========================================

  /**
   * Unconditional snapshot (boot from persisted user, login, `/auth/user`
   * sync). Does NOT touch `seq` — callers that must not roll back a fresher
   * push compare `seq` before and after their fetch (see `useUserSync`).
   */
  function seed(snapshot: BalanceSnapshot): void {
    coins.value = snapshot.coins
    diamonds.value = snapshot.diamonds
    wealthXp.value = snapshot.wealth_xp
    charmXp.value = snapshot.charm_xp
  }

  /**
   * Sequence-guarded setter (gift-authority-tick-fanout ticket 13).
   * A no-op when `seq` is not strictly newer than the last applied one — this
   * is what makes ack-then-push and push-then-ack converge on the same
   * number instead of the later-arriving (but possibly older) message
   * clobbering the fresher one. Only patches the keys actually present, so an
   * ack carrying `coins` alone never wipes diamonds/XP.
   *
   * This is the ONLY setter that should be used once `ackBalance` is
   * advertised — `patch` remains for the legacy (no-capability) path, which
   * never has a `seq` to guard with.
   */
  function apply(balance: BalancePatch & { seq: number }): void {
    if (balance.seq <= seq.value) return
    seq.value = balance.seq
    patch(balance)
  }

  /** Legacy unguarded partial write (optimistic debit/refund, no-seq pushes). */
  function patch(partial: BalancePatch): void {
    if (partial.coins !== undefined) coins.value = partial.coins
    if (partial.diamonds !== undefined) diamonds.value = partial.diamonds
    if (partial.wealth_xp !== undefined) wealthXp.value = partial.wealth_xp
    if (partial.charm_xp !== undefined) charmXp.value = partial.charm_xp
  }

  /** Logout / user switch: clear the numbers AND the per-user watermark. */
  function reset(): void {
    coins.value = null
    diamonds.value = null
    wealthXp.value = null
    charmXp.value = null
    seq.value = 0
  }

  return {
    coins,
    diamonds,
    wealthXp,
    charmXp,
    seq,
    isSeeded,
    coinsNumber,
    diamondsNumber,
    wealthXpNumber,
    charmXpNumber,
    seed,
    apply,
    patch,
    reset,
  }
})

// ========================================
// IAP Restore Bootstrap Plugin
// ========================================
// Thin INTENT trigger (in-app-purchase/09). Pipeline lives in
// `useCoinPurchase().restorePending('auto')` — this file only decides WHEN
// to fire it: app launch (already signed in), the login transition, and
// every foreground resume. All three funnel through the same silent,
// concurrency-guarded call, so a crash or network drop right after the
// store took payment still gets credited without the user doing anything.
//
// It also owns the one app-wide `transactionUpdated` listener
// (`useCoinPurchase().start()`). It used to live in the Buy Coins panel, so
// an Ask to Buy approval landing anywhere else in the app was dropped — and
// on iOS the billing plugin has already finished that transaction.
//
// Native only — `storeFor()` is null on web, where no store purchase exists.
// `@capacitor/app` is a real dependency (not `@capgo/native-purchases`,
// which the adapter dynamic-imports to keep out of the web bundle) — see
// `motionPauseOrchestrator.ts` for the same static-import precedent.
// ========================================

import { App } from '@capacitor/app'
import { storeFor } from '~/utils/native-platform'
import { useCoinPurchase } from '~/composables/economy/useCoinPurchase'
import { scheduleAfterFirstPaint } from '~/utils/schedule-after-first-paint'
import { createLogger } from '~/utils/logger'

const log = createLogger('[IapRestore]')

export default defineNuxtPlugin(() => {
  if (!storeFor()) return

  const authStore = useAuthStore()

  // Built lazily inside the trigger, not at plugin setup — `useCoinPurchase()`
  // resolves `useToast()`, and setup can run before the toast provider (and
  // other plugins) are mounted. Cheap to call repeatedly; no state is lost
  // between calls (all of it lives in `useCoinPacksStore`/`useAuthStore`).
  function triggerAutoRestore(reason: string): void {
    const { restorePending } = useCoinPurchase()
    restorePending('auto').catch(error => log.warn(`Auto restore failed (${reason})`, error))
  }

  // Store-side transaction updates, app-wide, for the app's lifetime. After
  // first paint for the same reason as `triggerAutoRestore` (toast provider).
  scheduleAfterFirstPaint(() => {
    useCoinPurchase().start()
  })

  // Launch with an existing session — deferred past first paint, same as
  // useBootstrapInit's reconcileInbox('bootstrap') call.
  if (authStore.token) {
    scheduleAfterFirstPaint(() => triggerAutoRestore('boot'))
  }

  // Login transition (mirrors bootstrap.client.ts's login watcher).
  watch(
    () => authStore.token,
    (token, prevToken) => {
      if (token && !prevToken) triggerAutoRestore('login')
    },
  )

  // App foreground. Never throws — an older shell without the App plugin
  // (or the billing plugin behind it) just never gets this listener.
  App.addListener('appStateChange', ({ isActive }) => {
    if (isActive && authStore.token) triggerAutoRestore('foreground')
  }).catch(error => log.warn('Failed to attach appStateChange listener', error))
})

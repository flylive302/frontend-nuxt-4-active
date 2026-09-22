// ========================================
// Foreground Sync Plugin
// ========================================
// Thin INTENT trigger. The Laravel→MSAB realtime bridge is at-most-once
// with no replay (see useUserSync, useInboxReconcile): a socket that dies
// while the app is backgrounded loses whatever balance/inbox events fired
// during that gap, and nothing else re-syncs it — boot, socket reconnect,
// and some money pages already resync, but returning to foreground with a
// socket that survived (or reconnected silently) did not.
//
// This plugin only decides WHEN to fire the existing resync pipelines
// (`useUserSync().syncUser()`, `useInboxReconcile().reconcileInbox()`) —
// on native `appStateChange` (precedent: iap-restore.client.ts) and on web
// `visibilitychange` (precedent: bootstrap.client.ts's asset pause/resume).
//
// Debounced to 10s so a rapid tab-switch flurry doesn't hammer both
// endpoints — foreground firing on EVERY resume, no matter how recent the
// last one, would turn app-switching into a refetch storm.

import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { createLogger } from '~/utils/logger'

const log = createLogger('[ForegroundSync]')

const DEBOUNCE_MS = 10_000

export default defineNuxtPlugin(() => {
  const authStore = useAuthStore()

  // Boot already ran syncUser (useBootstrapInit); start the debounce clock
  // here so a foreground inside the first 10s doesn't double-fetch.
  let lastSyncAt = Date.now()

  function onForeground(): void {
    if (!authStore.token) return

    const now = Date.now()
    if (now - lastSyncAt < DEBOUNCE_MS) return
    lastSyncAt = now

    // Resolved inside the trigger, not at plugin setup — mirrors
    // iap-restore.client.ts's `triggerAutoRestore`: setup can run before
    // other plugins (toast provider, etc.) these composables may reach for
    // are mounted. Cheap to call repeatedly; both composables coalesce
    // their own in-flight requests at module scope, so nothing duplicates.
    void useUserSync().syncUser()
    void useInboxReconcile().reconcileInbox('foreground')
  }

  if (Capacitor.isNativePlatform()) {
    // Native — visibilitychange is unreliable after OS-level process
    // suspension (same reasoning as useAudioSocket's visibility fallback).
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) onForeground()
    }).catch(error => log.warn('Failed to attach appStateChange listener', error))
  } else {
    // Web — this file is `.client.ts`, so it only ever runs in the browser.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) onForeground()
    })
  }
})

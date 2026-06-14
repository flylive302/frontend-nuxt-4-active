import { Capacitor } from '@capacitor/core'

/**
 * Native social-auth deep-link bootstrap (Capacitor only).
 *
 * Registers the `appUrlOpen` listener and drains any cold-start launch URL so a
 * `com.flylive.app://callback?code=…` deep link completes sign-in — the app side
 * of native social auth (ADR 0011, capacitor-10).
 *
 * No-ops on the web build; the popup/redirect flow handles OAuth there.
 */
export default defineNuxtPlugin(async () => {
  if (!Capacitor.isNativePlatform()) return

  await useNativeSocialAuth().registerDeepLinkListener()
})

import { Capacitor } from '@capacitor/core'

/**
 * Native social-auth deep-link bootstrap (Capacitor only).
 *
 * Registers the `appUrlOpen` listener and drains any cold-start launch URL so a
 * `com.flylive.app://callback?code=…` deep link completes sign-in — the app side
 * of native social auth (ADR 0011, capacitor-10).
 *
 * No-ops on the web build; the popup/redirect flow handles OAuth there.
 *
 * `parallel: true` (boot-and-asset-delivery 08): it has no ordering dependency on any other
 * plugin, so the native bridge round trips below no longer serialize the plugin chain.
 */
export default defineNuxtPlugin({
  name: 'native-social-auth',
  parallel: true,
  async setup() {
    if (!Capacitor.isNativePlatform()) return

    await useNativeSocialAuth().registerDeepLinkListener()
  },
})

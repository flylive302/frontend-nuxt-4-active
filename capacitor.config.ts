import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitor native-shell config (ADR 0010).
 *
 * The SPA is BUNDLED — `webDir` points at the static `nuxi generate` output and
 * assets ship inside the APK. We deliberately do NOT set `server.url`: the app
 * runs from the local `capacitor://localhost` origin, not a remote page.
 *
 * Remote backend URLs (apiBase / audioServerUrl / reverb*) are baked into the
 * bundle at generate time via NUXT_PUBLIC_* env — see `npm run cap:build`.
 */
const config: CapacitorConfig = {
    appId: 'com.flylive.app',
    appName: 'FlyLive',
    webDir: '.output/public',
}

export default config

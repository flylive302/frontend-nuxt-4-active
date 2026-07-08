/// <reference types="@capacitor-community/safe-area" />

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
    plugins: {
        // OTA live updates (capacitor-07). The native plugin MUST ship in the launch
        // AAB — adding it later would require a second store submission. Manual mode:
        // `autoUpdate: false` means the app never contacts a Capgo backend; the
        // R2/manifest/publish orchestration lands post-launch via the plugin's JS API.
        CapacitorUpdater: {
            autoUpdate: false,
        },
        // Edge-to-edge insets (capacitor-05). targetSdk 36 forces edge-to-edge,
        // and `env(safe-area-inset-*)` is unreliable on Android WebView < Chromium 140.
        // This plugin feeds correct system-bar insets to `env()` (newer WebViews) or
        // pads the WebView natively (older ones). `initialViewportFitCover` applies
        // insets from the first frame since our viewport meta already sets `viewport-fit=cover`.
        SafeArea: {
            initialViewportFitCover: true,
            // Fallback path (WebView < Chromium 140 pads the WebView natively):
            // paint the decor behind the bars BLACK to match the dark UI instead
            // of the default white strip.
            statusBarStyle: 'DARK',
            navigationBarStyle: 'DARK',
        },
        // Capacitor 8's built-in SystemBars insets handling MUST be off — it attaches
        // a second window-insets listener that pads the WebView parent (content can
        // never draw behind the status bar) and conflicts with the SafeArea plugin,
        // which owns all inset handling here (the plugin hard-warns about this).
        SystemBars: {
            insetsHandling: 'disable',
        },
        // Native launch splash (generated via `npx capacitor-assets generate --android`
        // from resources/splash.png). Fixed-duration auto-hide — the bundled SPA mounts
        // fast enough that a manual hide() call isn't needed.
        // `useDialog: true` is required on Android 12+ (API 31, targetSdk 36 here) — the
        // OS-level SplashScreen API only shows the launcher icon on a color field otherwise;
        // the full-screen drawable is rendered as a themed dialog on top of that.
        SplashScreen: {
            launchShowDuration: 2000,
            launchAutoHide: true,
            backgroundColor: '#ffffff',
            androidScaleType: 'CENTER_CROP',
            splashFullScreen: true,
            splashImmersive: true,
            useDialog: true,
        },
    },
}

export default config

/**
 * App head configuration (meta tags, links)
 *
 * Extracted from nuxt.config.ts to keep the main config lean.
 * The manifest <link> is intentionally absent — @vite-pwa/nuxt injects it automatically.
 */
import type { NuxtConfig } from 'nuxt/schema'

type HeadConfig = NonNullable<NonNullable<NuxtConfig['app']>['head']>

export const headConfig: HeadConfig = {
    htmlAttrs: { class: 'dark', lang: 'en' },
    title: 'FlyLive',
    meta: [
        { name: 'theme-color', content: 'black-translucent' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: 'FlyLive' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'description', content: 'FlyLive — live audio rooms, real-time gifting, and social broadcasting. Join thousands of listeners and hosts worldwide.' },
        // Single viewport tag — Unhead dedupes by name (last wins), so `viewport-fit=cover`
        // MUST live here or `env(safe-area-inset-*)` returns 0 on device (capacitor-05).
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover' }
    ],
    link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'icon', type: 'image/png', sizes: '48x48', href: '/pwa-assets/android/launchericon-48x48.png' },
        { rel: 'icon', type: 'image/png', sizes: '72x72', href: '/pwa-assets/android/launchericon-72x72.png' },
        { rel: 'icon', type: 'image/png', sizes: '96x96', href: '/pwa-assets/android/launchericon-96x96.png' },
        { rel: 'icon', type: 'image/png', sizes: '144x144', href: '/pwa-assets/android/launchericon-144x144.png' },
        { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/pwa-assets/android/launchericon-192x192.png' },
        { rel: 'icon', type: 'image/png', sizes: '512x512', href: '/pwa-assets/android/launchericon-512x512.png' },
        // iOS PWA launch splash screens — one entry per device resolution
        { rel: 'apple-touch-icon', href: '/pwa-assets/ios/180.png', sizes: '180x180' },
        { rel: 'apple-touch-startup-image', href: '/pwa-assets/screenshots/720x1280.png', media: '(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' },
        { rel: 'apple-touch-startup-image', href: '/pwa-assets/screenshots/720x1280.png', media: '(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' },
        { rel: 'apple-touch-startup-image', href: '/pwa-assets/screenshots/720x1280.png', media: '(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' },
        { rel: 'apple-touch-startup-image', href: '/pwa-assets/screenshots/720x1280.png', media: '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
        { rel: 'apple-touch-startup-image', href: '/pwa-assets/screenshots/720x1280.png', media: '(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
        { rel: 'apple-touch-startup-image', href: '/pwa-assets/screenshots/720x1280.png', media: '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
        { rel: 'apple-touch-startup-image', href: '/pwa-assets/screenshots/720x1280.png', media: '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
        { rel: 'apple-touch-startup-image', href: '/pwa-assets/screenshots/720x1280.png', media: '(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
        { rel: 'apple-touch-startup-image', href: '/pwa-assets/screenshots/720x1280.png', media: '(device-width: 360px) and (device-height: 780px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
        { rel: 'apple-touch-startup-image', href: '/pwa-assets/screenshots/720x1280.png', media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' },
        { rel: 'apple-touch-startup-image', href: '/pwa-assets/screenshots/720x1280.png', media: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' },
        { rel: 'apple-touch-startup-image', href: '/pwa-assets/screenshots/720x1280.png', media: '(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' },
    ]
}

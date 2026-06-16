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
        { rel: 'apple-touch-icon', href: '/pwa-assets/ios/180.png', sizes: '180x180' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/pwa-assets/ios/32.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/pwa-assets/ios/16.png' },
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        // iOS PWA launch splash screens — one entry per device resolution
        { rel: 'apple-touch-startup-image', href: '/pwa-assets/ios/splash/2048x2732.png', media: '(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' },
        { rel: 'apple-touch-startup-image', href: '/pwa-assets/ios/splash/1668x2388.png', media: '(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' },
        { rel: 'apple-touch-startup-image', href: '/pwa-assets/ios/splash/1536x2048.png', media: '(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' },
        { rel: 'apple-touch-startup-image', href: '/pwa-assets/ios/splash/1290x2796.png', media: '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
        { rel: 'apple-touch-startup-image', href: '/pwa-assets/ios/splash/1284x2778.png', media: '(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
        { rel: 'apple-touch-startup-image', href: '/pwa-assets/ios/splash/1179x2556.png', media: '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
        { rel: 'apple-touch-startup-image', href: '/pwa-assets/ios/splash/1170x2532.png', media: '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
        { rel: 'apple-touch-startup-image', href: '/pwa-assets/ios/splash/1125x2436.png', media: '(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
        { rel: 'apple-touch-startup-image', href: '/pwa-assets/ios/splash/1080x2340.png', media: '(device-width: 360px) and (device-height: 780px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
        { rel: 'apple-touch-startup-image', href: '/pwa-assets/ios/splash/828x1792.png', media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' },
        { rel: 'apple-touch-startup-image', href: '/pwa-assets/ios/splash/750x1334.png', media: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' },
        { rel: 'apple-touch-startup-image', href: '/pwa-assets/ios/splash/640x1136.png', media: '(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' },
    ]
}

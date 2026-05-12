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
        { name: 'viewport', content: 'initial-scale=1, viewport-fit=cover, width=device-width' },
        { name: 'theme-color', content: 'black-translucent' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: 'FlyLive' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'description', content: 'FlyLive — live audio rooms, real-time gifting, and social broadcasting. Join thousands of listeners and hosts worldwide.' },
    ],
    link: [
        { rel: 'apple-touch-icon', href: '/pwa-assets/ios/180.png', sizes: '180x180' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/pwa-assets/ios/32.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/pwa-assets/ios/16.png' },
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
    ]
}

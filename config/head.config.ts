/**
 * App head configuration (meta tags, links)
 *
 * Extracted from nuxt.config.ts to keep the main config lean.
 * No web-app manifest — the PWA layer was removed entirely (ADR 0020).
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
        // favicon.ico alone (32 + 48 px inside). The six PNG launcher-icon links pointed at the
        // retired PWA asset folder and cost the Android WebView ~12 uncached requests on every
        // route change (boot-and-asset-delivery 01/02).
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }
    ]
}

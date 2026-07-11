/**
 * PWA configuration for @vite-pwa/nuxt
 *
 * Extracted from nuxt.config.ts to keep the main config lean.
 * This generates /manifest.webmanifest at build time.
 */
import type { ModuleOptions } from '@vite-pwa/nuxt'

export const pwaConfig: ModuleOptions = {
    registerType: 'autoUpdate',
    injectRegister: 'auto',
    includeAssets: [
        'favicon.ico',
        'pwa-assets/android/launchericon-192x192.png',
        'pwa-assets/android/launchericon-512x512.png',
    ],
    manifest: {
        name: 'FlyLive',
        short_name: 'FlyLive',
        description: 'Live audio streaming and social platform',
        theme_color: '#ff2465',
        background_color: '#000000',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone'],
        orientation: 'portrait',
        categories: ['entertainment', 'music', 'social'],
        id: '/',
        start_url: '/welcome',
        scope: '/',
        handle_links: 'preferred',
        icons: [
            { src: '/pwa-assets/android/launchericon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/pwa-assets/android/launchericon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/pwa-assets/maskable-icon.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ],
        screenshots: [
            { src: '/pwa-assets/screenshots/720x1280.webp', sizes: '720x1280', type: 'image/webp', form_factor: 'narrow', label: 'FlyLive Home - Live Audio Rooms' },
        ]
    },
    devOptions: {
        enabled: false,
        suppressWarnings: true,
    },
    workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MiB
        // Disable navigateFallback – Cloudflare Pages handles SPA routing.
        navigateFallback: undefined,
        navigateFallbackDenylist: [/^\/api/],
        globPatterns: ['**/*.{js,css,png,svg,ico,woff,woff2,webp}'],
        // HTML pages are SSR-rendered (dynamic) — precaching them causes 500s when the
        // dev server or backend is unavailable, and stale HTML in production breaks navigation.
        globIgnores: ['**/*.html'],
        // LT-1: Include custom asset download handler in generated SW
        importScripts: ['/sw-env.js', '/sw-asset-handler.js'],
        runtimeCaching: [
            // NOTE: no rule for gift videos (.webm/.mov) — they are persisted in
            // 'flylive-assets-v1' by the bootstrap downloader + giftAssetCache and
            // played from blob URLs. A CacheFirst rule here only duplicated every
            // multi-MB WebM into a second bucket (and served range requests badly).
            // R2 CDN Assets – SVGA animations (30 days)
            {
                urlPattern: /(?:assets\.flyliveapp\.com)\/.*\.svga$/i,
                handler: 'CacheFirst',
                options: {
                    cacheName: 'svga-cache',
                    expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }
                }
            },
            // CDN Images – CacheFirst (7 days). ImageKit URLs are immutable per
            // transform variant; SWR fired a revalidation request per image per
            // drawer remount, which swamped mobile radio for zero benefit.
            {
                urlPattern: /^https:\/\/ik\.imagekit\.io/,
                handler: 'CacheFirst',
                options: {
                    cacheName: 'cdn-images',
                    expiration: { maxEntries: 500, maxAgeSeconds: 7 * 24 * 60 * 60 }
                }
            },
            // API – Network First (1 hour cache fallback)
            {
                urlPattern: /\/api\//,
                handler: 'NetworkFirst',
                options: {
                    cacheName: 'api-cache',
                    expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 }
                }
            }
        ]
    }
}

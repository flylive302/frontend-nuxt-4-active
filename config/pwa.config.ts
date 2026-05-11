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
        'pwa-assets/icon-192x192.png',
        'pwa-assets/icon.png',
        'pwa-assets/apple-touch-icon-180x180.png'
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
        start_url: '/?fullscreen=true',
        scope: '/',
        handle_links: 'preferred',
        icons: [
            { src: '/pwa-assets/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/pwa-assets/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/pwa-assets/maskable-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
            { src: '/pwa-assets/maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ],
        screenshots: [
            { src: '/screenshots/desktop.jpeg', sizes: '1024x1024', type: 'image/jpeg', form_factor: 'wide', label: 'FlyLive Home - Live Audio Rooms' },
            { src: '/screenshots/mobile.jpeg', sizes: '1024x1024', type: 'image/jpeg', form_factor: 'narrow', label: 'FlyLive Mobile - Discover Rooms' }
        ]
    },
    devOptions: {
        enabled: true,
        type: 'module',
        suppressWarnings: true
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
        importScripts: ['/sw-asset-handler.js'],
        runtimeCaching: [
            // R2 CDN Assets – Gift videos (30 days)
            {
                urlPattern: /(?:assets\.flyliveapp\.com|\/room)\/.*\.(webm|mov)$/i,
                handler: 'CacheFirst',
                options: {
                    cacheName: 'gift-videos',
                    expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }
                }
            },
            // R2 CDN Assets – SVGA animations (30 days)
            {
                urlPattern: /(?:assets\.flyliveapp\.com)\/.*\.svga$/i,
                handler: 'CacheFirst',
                options: {
                    cacheName: 'svga-cache',
                    expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }
                }
            },
            // CDN Images – Stale While Revalidate (7 days)
            {
                urlPattern: /^https:\/\/ik\.imagekit\.io/,
                handler: 'StaleWhileRevalidate',
                options: {
                    cacheName: 'cdn-images',
                    expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 }
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

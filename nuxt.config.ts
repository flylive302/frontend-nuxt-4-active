// https://nuxt.com/docs/api/configuration/nuxt-config
import { defineNuxtConfig } from 'nuxt/config'
export default defineNuxtConfig({
    compatibilityDate: '2025-02-03',
    ssr: false,
    devtools: { enabled: false },
    css: ['~/assets/css/main.css'],
    modules: ['@vite-pwa/nuxt', '@nuxt/eslint', '@nuxt/image', '@nuxt/scripts', '@nuxt/test-utils', '@nuxt/ui', '@vueuse/nuxt', '@pinia/nuxt', 'pinia-plugin-persistedstate/nuxt'],
    pwa: {
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['favicon.ico', 'logos/apple-touch-icon-180x180.png', 'logos/pwa-64x64.png', 'logos/pwa-192x192.png', 'logos/pwa-512x512.png', 'logos/maskable-icon-192x192.png', 'logos/maskable-icon-512x512.png'],
        manifest: {
            name: 'FlyLive',
            short_name: 'FlyLive',
            description: 'Live audio streaming and social platform',
            theme_color: '#000000',
            background_color: '#000000',
            display: 'standalone',
            display_override: ['window-controls-overlay', 'standalone'],
            orientation: 'portrait',
            // PWA identity and scope
            id: '/',
            start_url: '/?fullscreen=true',
            scope: '/',
            // Preferred link handling (keeps external links in app)
            handle_links: 'preferred',
            icons: [
                { src: '/logos/pwa-64x64.png', sizes: '64x64', type: 'image/png', purpose: 'any' },
                { src: '/logos/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
                { src: '/logos/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
                { src: '/logos/maskable-icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
                { src: '/logos/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
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
            // Disable navigateFallback - Cloudflare Pages handles SPA routing.
            // Without this, @vite-pwa auto-adds navigateFallback:'/' causing non-precached-url error.
            navigateFallback: undefined,
            navigateFallbackDenylist: [/^\/api/],
            // Explicit glob patterns to avoid dev mode warnings
            globPatterns: ['**/*.{js,css,html,png,svg,ico,woff,woff2,webp}'],
            // LT-1: Include custom asset download handler in generated SW
            importScripts: ['/sw-asset-handler.js'],
            runtimeCaching: [
                // R2 CDN Assets - Gift videos (30 days)
                {
                    urlPattern: /(?:assets\.flyliveapp\.com|\/room)\/.*\.(webm|mov)$/i,
                    handler: 'CacheFirst',
                    options: {
                        cacheName: 'gift-videos',
                        expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }
                    }
                },
                // R2 CDN Assets - SVGA animations (30 days)
                {
                    urlPattern: /(?:assets\.flyliveapp\.com)\/.*\.svga$/i,
                    handler: 'CacheFirst',
                    options: {
                        cacheName: 'svga-cache',
                        expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }
                    }
                },
                // CDN Images - Stale While Revalidate (7 days)
                {
                    urlPattern: /^https:\/\/ik\.imagekit\.io/,
                    handler: 'StaleWhileRevalidate',
                    options: {
                        cacheName: 'cdn-images',
                        expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 }
                    }
                },
                // API - Network First (1 hour cache fallback)
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
    },
    components: [
        { path: '~/components/common', pathPrefix: false },
        '~/components',
    ],
    pinia: {
        storesDirs: ['./stores/**'],
    },
    imports: {
        dirs: [
            'composables',
            'composables/shared',
            'composables/profile',
            'composables/auth',
            'composables/room',
            'composables/room/audio',
            'composables/gift',
            'composables/lucky',
            'composables/agency',
            'composables/economy',
            'composables/progression',
            'composables/user',
            'composables/notification',
            'composables/income',
            'composables/mediasoup',
            'composables/vip',
            'composables/mall',
        ],
    },
    app: {
        head: {
            htmlAttrs: { class: 'dark' },
            title: 'FlyLive',
            meta: [
                {
                    name: 'viewport',
                    content: 'initial-scale=1, viewport-fit=cover, width=device-width'
                },
                { name: 'theme-color', content: '#000000' },
                { name: 'mobile-web-app-capable', content: 'yes' },
                { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
                { name: 'apple-mobile-web-app-title', content: 'FlyLive' }
            ],
            link: [
                { rel: 'manifest', href: '/manifest.webmanifest' },
                { rel: 'apple-touch-icon', href: '/logos/apple-touch-icon-180x180.png', sizes: '180x180' },
                { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
                // Apple splash screens – portrait (iPhone)
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-1320x2868.png', media: '(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-1206x2622.png', media: '(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-1260x2736.png', media: '(device-width: 420px) and (device-height: 912px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-1290x2796.png', media: '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-1179x2556.png', media: '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-1284x2778.png', media: '(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-1170x2532.png', media: '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-1125x2436.png', media: '(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-1242x2688.png', media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-828x1792.png', media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' },
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-1242x2208.png', media: '(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-750x1334.png', media: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' },
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-640x1136.png', media: '(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' },
                // Apple splash screens – portrait (iPad)
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-2064x2752.png', media: '(device-width: 1032px) and (device-height: 1376px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' },
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-2048x2732.png', media: '(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' },
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-1668x2420.png', media: '(device-width: 834px) and (device-height: 1210px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' },
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-1668x2388.png', media: '(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' },
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-1640x2360.png', media: '(device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' },
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-1668x2224.png', media: '(device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' },
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-1620x2160.png', media: '(device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' },
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-1536x2048.png', media: '(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' },
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-1488x2266.png', media: '(device-width: 744px) and (device-height: 1133px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' },
                // Apple splash screens – landscape (iPhone)
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-2868x1320.png', media: '(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)' },
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-2622x1206.png', media: '(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)' },
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-2736x1260.png', media: '(device-width: 420px) and (device-height: 912px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)' },
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-2796x1290.png', media: '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)' },
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-2556x1179.png', media: '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)' },
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-2778x1284.png', media: '(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)' },
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-2532x1170.png', media: '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)' },
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-2436x1125.png', media: '(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)' },
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-2688x1242.png', media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)' },
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-1792x828.png', media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)' },
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-2208x1242.png', media: '(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)' },
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-1334x750.png', media: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)' },
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-1136x640.png', media: '(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)' },
                // Apple splash screens – landscape (iPad)
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-2752x2064.png', media: '(device-width: 1032px) and (device-height: 1376px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)' },
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-2732x2048.png', media: '(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)' },
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-2420x1668.png', media: '(device-width: 834px) and (device-height: 1210px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)' },
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-2388x1668.png', media: '(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)' },
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-2360x1640.png', media: '(device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)' },
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-2224x1668.png', media: '(device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)' },
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-2160x1620.png', media: '(device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)' },
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-2048x1536.png', media: '(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)' },
                { rel: 'apple-touch-startup-image', href: '/pwa-assets/splash-2266x1488.png', media: '(device-width: 744px) and (device-height: 1133px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)' },
                // Preconnect to critical domains for faster resource loading
                { rel: 'preconnect', href: 'https://ik.imagekit.io', crossorigin: '' },
                { rel: 'dns-prefetch', href: 'https://ik.imagekit.io' },
                { rel: 'preconnect', href: 'https://assets.flyliveapp.com', crossorigin: '' },
                { rel: 'dns-prefetch', href: 'https://assets.flyliveapp.com' }
            ]
        },
        pageTransition: { name: 'page', mode: 'out-in' }
    },
    ui: {
        colorMode: false,
        theme: {
            colors: ['primary', 'secondary', 'tertiary', 'info', 'success', 'warning', 'error']
        }
    },
    image: {},
    vite: {
        optimizeDeps: {
            include: ['svga/dist/index.esm.min.js']
        },
        build: {
            chunkSizeWarningLimit: 500,
            rollupOptions: {
                onwarn(warning, warn) {
                    if (warning.code === 'EVAL' && warning.id?.includes('svga')) {
                        return
                    }
                    warn(warning)
                },
                output: {
                    /**
                     * Granular vendor chunking strategy.
                     *
                     * Splits node_modules into purpose-based chunks so users only download
                     * code for the features they actually use on the current page.
                     *
                     * Core chunks load at app init. Feature chunks load on demand.
                     */
                    manualChunks(id: string) {
                        if (!id.includes('node_modules')) return

                        // ── Core: loaded at app init / login ──
                        if (id.includes('socket.io'))              return 'core-realtime'
                        if (id.includes('zod'))                    return 'core-validation'

                        // ── Room: loaded when user joins a room ──
                        if (id.includes('mediasoup'))              return 'room-audio'
                        if (id.includes('svga'))                   return 'room-animations'

                        // ── Feature: loaded on specific pages ──
                        if (id.includes('vue-advanced-cropper'))   return 'feature-cropper'
                        if (id.includes('libphonenumber'))         return 'feature-phone'
                        if (id.includes('internationalized/date')) return 'feature-dates'
                        if (id.includes('vue-virtual-scroller'))   return 'feature-scroller'

                        // Let Vite handle remaining deps organically via its
                        // module graph analysis (vue, pinia, nuxt, vueuse, etc.)
                    }
                }
            }
        }
    },  
    nitro: {
        rollupConfig: {
            moduleContext: {
                'node_modules/mime/dist/src/Mime.js': 'undefined'
            }
        },
        // Cloudflare Pages deployment
        preset: 'cloudflare_pages'
    },
    runtimeConfig: {
        public: {
            apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8000/api/v1',
            apiRoot: process.env.NUXT_PUBLIC_API_ROOT || 'http://localhost:8000',
            audioServerUrl: process.env.NUXT_PUBLIC_AUDIO_SERVER_URL || 'wss://localhost:3030'
        }
    },
})
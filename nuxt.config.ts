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
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon-192x192.png', 'icon-512x512.png'],
        manifest: {
            name: 'FlyLive',
            short_name: 'FlyLive',
            description: 'Live audio streaming and social platform',
            theme_color: '#ff2465',
            background_color: '#000000',
            display: 'standalone',
            orientation: 'portrait',
            // PWA identity and scope
            id: '/',
            start_url: '/',
            scope: '/',
            // Preferred link handling (keeps external links in app)
            handle_links: 'preferred',
            // Display override for better fallback control
            display_override: ['standalone', 'minimal-ui'],
            icons: [
                { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
                { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
                { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
            ],
            screenshots: [
                { src: '/screenshots/desktop.png', sizes: '1024x1024', type: 'image/png', form_factor: 'wide', label: 'FlyLive Home - Live Audio Rooms' },
                { src: '/screenshots/mobile.png', sizes: '1024x1024', type: 'image/png', form_factor: 'narrow', label: 'FlyLive Mobile - Discover Rooms' }
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
                { name: 'theme-color', content: '#ff2465' },
                { name: 'mobile-web-app-capable', content: 'yes' },
                { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
                { name: 'apple-mobile-web-app-title', content: 'FlyLive' }
            ],
            link: [
                { rel: 'manifest', href: '/manifest.webmanifest' },
                { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
                { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
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
            audioServerUrl: process.env.NUXT_PUBLIC_AUDIO_SERVER_URL || 'ws://localhost:3030'
        }
    },
})
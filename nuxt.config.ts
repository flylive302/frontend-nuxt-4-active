// https://nuxt.com/docs/api/configuration/nuxt-config
import { defineNuxtConfig } from 'nuxt/config'
export default defineNuxtConfig({
    compatibilityDate: '2025-02-03',
    ssr: false,
    devtools: { enabled: false },
    css: ['~/assets/css/main.css'],
    modules: ['@vite-pwa/nuxt', '@nuxthub/core', '@nuxt/eslint', '@nuxt/image', '@nuxt/scripts', '@nuxt/test-utils', '@nuxt/ui', '@vueuse/nuxt', '@pinia/nuxt', 'pinia-plugin-persistedstate/nuxt'],
    pwa: {
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon-192x192.png', 'icon-512x512.png'],
        manifest: {
            name: 'FlyLive',
            short_name: 'FlyLive',
            description: 'Live audio streaming and social platform',
            theme_color: '#ff2465',
            background_color: '#0A0A0A',
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
            type: 'module'
        },
        workbox: {
            // Note: navigateFallback removed - not compatible with SPA.
            // For SPAs, the cached index.html serves all routes, then Vue Router handles /offline
            navigateFallbackDenylist: [/^\/api/],
            // Explicit glob patterns to avoid dev mode warnings
            globPatterns: ['**/*.{js,css,html,png,svg,ico,woff,woff2,webp}'],
            runtimeCaching: [
                // Gift videos - Cache First (30 days)
                {
                    urlPattern: /\/room\/gifts\/.*\.(webm|mp4)$/i,
                    handler: 'CacheFirst',
                    options: {
                        cacheName: 'gift-videos',
                        expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }
                    }
                },
                // SVGA JSON - Cache First (30 days)
                {
                    urlPattern: /\/parsedAnimations\/.*\.json$/i,
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
    pinia: {
        storesDirs: ['./stores/**'],
    },
    imports: {
        dirs: [
            'composables',
            'composables/agency',
            'composables/room',
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
                { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }
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
    image: {
        imagekit: {
            baseURL: 'https://ik.imagekit.io/flylive'
        }
    },
    vite: {
        optimizeDeps: {
            include: ['svga/dist/index.esm.min.js']
        },
        build: {
            chunkSizeWarningLimit: 2000,
            rollupOptions: {
                onwarn(warning, warn) {
                    if (warning.code === 'EVAL' && warning.id?.includes('svga')) {
                        return
                    }
                    warn(warning)
                },
                output: {
                    manualChunks(id: string) {
                        if (id.includes('node_modules')) {
                            if (id.includes('svga')) return 'svga'
                            if (id.includes('mapbox') || id.includes('googlemaps')) return 'maps'
                            return 'vendor'
                        }
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
        // Cloudflare Pages compatibility
        preset: 'cloudflare-pages',
        cloudflare: {
            pages: {
                routes: {
                    exclude: ['/api/*']
                }
            }
        }
    },
    hub: {
        // Enable Node.js compatibility for Cloudflare Workers
        bindings: {
            compatibilityFlags: ['nodejs_compat']
        }
    },
    runtimeConfig: {
        public: {
            apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8000/api/v1',
            apiRoot: process.env.NUXT_PUBLIC_API_ROOT || 'http://localhost:8000',
            audioServerUrl: process.env.NUXT_PUBLIC_AUDIO_SERVER_URL || 'ws://localhost:3030'
        }
    },
})
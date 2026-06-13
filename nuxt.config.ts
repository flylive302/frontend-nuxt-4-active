// https://nuxt.com/docs/api/configuration/nuxt-config
import { defineNuxtConfig } from 'nuxt/config'
import { visualizer } from 'rollup-plugin-visualizer'
import { pwaConfig } from './config/pwa.config'
import { headConfig } from './config/head.config'

const bundleAnalyze = process.env.NUXT_ANALYZE === 'true' || process.env.ANALYZE === 'true'

export default defineNuxtConfig({
    compatibilityDate: '2025-02-03',
    ssr: false,
    spaLoadingTemplate: true,
    devtools: { enabled: false },
    features: {
        inlineStyles: false,
    },
    css: ['~/assets/css/main.css'],
    modules: ['@sentry/nuxt/module', '@vite-pwa/nuxt', '@nuxt/eslint', '@nuxt/image', '@nuxt/scripts', '@nuxt/test-utils', '@nuxt/ui', '@vueuse/nuxt', '@pinia/nuxt', 'pinia-plugin-persistedstate/nuxt'],
    pwa: pwaConfig,
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
            'composables/vap',
            'composables/mall',
            'composables/inbox',
            'composables/recharge',
            'composables/slide',
        ],
    },
    app: {
        head: headConfig,
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
        },
        quality: 75,
        format: ['webp'],
        densities: [1, 2],
        screens: {
            xs: 320,
            sm: 375,
            md: 428,
        },
    },
    vite: {
        plugins: bundleAnalyze
            ? [
                visualizer({
                    filename: '.nuxt/bundle-stats.html',
                    gzipSize: true,
                    brotliSize: true,
                    open: false,
                    template: 'treemap',
                }),
            ]
            : [],
        // Dev-only: same-origin proxy so fetches to R2 avoid browser CORS on localhost (Lighthouse / AssetDownloader).
        server: {
            proxy: {
                '/__r2': {
                    target: 'https://assets.flyliveapp.com',
                    changeOrigin: true,
                    rewrite: (path) => path.replace(/^\/__r2/, '') || '/',
                },
            },
        },
        build: {
            sourcemap: false,
            chunkSizeWarningLimit: 1000,
            rollupOptions: {
                onwarn(warning, warn) {
                    if (warning.code === 'EVAL' && warning.id?.includes('svga')) {
                        return
                    }
                    if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && warning.message.includes('"use client"')) {
                        return
                    }
                    warn(warning)
                },
                output: {}
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
        preset: 'cloudflare-pages',
        prerender: {
            autoSubfolderIndex: false,
        },
        cloudflare: {
            pages: {
                routes: {
                    exclude: ['/sw.js', '/workbox-*']
                }
            }
        },
    },
    runtimeConfig: {
        playStoreUrl: process.env.NUXT_PLAY_STORE_URL ?? 'https://play.google.com/store/apps/details?id=com.flylive.app',
        public: {
            apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8000/api/v1',
            apiRoot: process.env.NUXT_PUBLIC_API_ROOT || 'http://localhost:8000',
            audioServerUrl:
                process.env.NUXT_PUBLIC_AUDIO_SERVER_URL
                || (process.env.NODE_ENV === 'development' ? 'ws://localhost:3030' : 'wss://localhost:3030'),
            reverbAppKey: process.env.NUXT_PUBLIC_REVERB_APP_KEY || '',
            reverbHost: process.env.NUXT_PUBLIC_REVERB_HOST || 'localhost',
            reverbPort: process.env.NUXT_PUBLIC_REVERB_PORT || '8080',
            reverbScheme: process.env.NUXT_PUBLIC_REVERB_SCHEME || 'http',
            vapidPublicKey: process.env.NUXT_PUBLIC_VAPID_PUBLIC_KEY || '',
            sentry: {
                dsn: process.env.NUXT_PUBLIC_SENTRY_DSN || '',
                environment: process.env.NUXT_PUBLIC_SENTRY_ENVIRONMENT || 'production',
                // CF_PAGES_COMMIT_SHA is set automatically by Cloudflare Pages at build time
                release: process.env.NUXT_PUBLIC_SENTRY_RELEASE || process.env.CF_PAGES_COMMIT_SHA || '',
            },
        }
    },
})
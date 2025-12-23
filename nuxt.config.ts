// https://nuxt.com/docs/api/configuration/nuxt-config
import { defineNuxtConfig } from 'nuxt/config'
export default defineNuxtConfig({
    compatibilityDate: '2025-02-03',
    ssr: false,
    devtools: { enabled: false },
    css: ['~/assets/css/main.css'],
    modules: ['@nuxthub/core', '@nuxt/eslint', '@nuxt/image', '@nuxt/scripts', '@nuxt/test-utils', '@nuxt/ui', '@vueuse/nuxt', '@pinia/nuxt', 'pinia-plugin-persistedstate/nuxt'],
    pinia: {
        storesDirs: ['./stores/**'],
    },
    app: {
        head: {
            htmlAttrs: { class: 'dark' },
            meta: [
                {
                    name: 'viewport',
                    content: 'initial-scale=1, viewport-fit=cover'
                }
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
                output: {
                    manualChunks(id: string) {
                        if (id.includes('node_modules')) {
                            if (id.includes('svga')) return 'svga'
                            if (id.includes('mapbox') || id.includes('googlemaps')) return 'maps'
                            if (id.includes('@nuxt/ui')) return 'ui'
                            if (id.includes('headlessui')) return 'headless'
                            if (id.includes('radix-ui')) return 'radix'
                            if (id.includes('zod')) return 'zod'
                            if (id.includes('@internationalized/date')) return 'i18n-date'
                            if (id.includes('@vueuse')) return 'vueuse'
                            if (id.includes('vue') || id.includes('nuxt')) return 'framework'
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
        }
    },
    runtimeConfig: {
        public: {
            apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8000/api/v1',
            apiRoot: process.env.NUXT_PUBLIC_API_ROOT || 'http://localhost:8000',
            audioServerUrl: process.env.NUXT_PUBLIC_AUDIO_SERVER_URL || 'ws://localhost:3030'
        }
    }
})
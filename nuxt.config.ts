// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: '2025-07-15',
    ssr: false,
    devtools: { enabled: true },
    css: ['~/assets/css/main.css'],
    modules: ['@nuxt/eslint', '@nuxt/image', '@nuxt/scripts', '@nuxt/test-utils', '@nuxt/ui', '@vueuse/nuxt', '@pinia/nuxt', 'pinia-plugin-persistedstate/nuxt'],
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
            rollupOptions: {
                output: {
                    manualChunks(id) {
                        if (id.includes('node_modules')) {
                            if (id.includes('svga')) return 'svga'
                            if (id.includes('mapbox') || id.includes('googlemaps')) return 'maps'
                            if (id.includes('vue') || id.includes('nuxt')) return 'framework'
                            return 'vendor'
                        }
                    }
                }
            }
        }
    },
    runtimeConfig: {
        public: {
            apiBase: 'http://localhost:8000/api'
        }
    }
})
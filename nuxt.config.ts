// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: '2025-07-15',
    devtools: { enabled: true },
    css: ['~/assets/css/main.css'],
    modules: ['@nuxt/eslint', '@nuxt/image', '@nuxt/scripts', '@nuxt/test-utils', '@nuxt/ui', '@vueuse/nuxt', '@pinia/nuxt', '@nuxt/hints'],
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
            include: ['svga/dist/index.esm.min.js'],
            exclude: ['@nuxt/hints']
        },
        build: {
            rollupOptions: {
                output: { manualChunks: { svga: ['svga/dist/index.esm.min.js'] } }
            }
        }
    },
    runtimeConfig: {
        public: {
            apiBase: 'https://www.laravel-backend.com/api'
        }
    }
})
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    ssr: false,
    compatibilityDate: '2025-07-15',
    devtools: { enabled: true },
    css: ['~/assets/css/main.css'],
    modules: ['@nuxt/eslint', '@nuxt/image', '@nuxt/scripts', '@nuxt/test-utils', '@nuxt/ui'],
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

    spaLoadingTemplate: 'app/spa-loading-template.html',
    vite: {
        optimizeDeps: { include: ['svga/dist/index.esm.min.js'] },
        build: {
            rollupOptions: {
                output: { manualChunks: { svga: ['svga/dist/index.esm.min.js'] } }
            }
        }
    }
})
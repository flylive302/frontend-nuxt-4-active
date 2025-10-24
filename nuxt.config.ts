// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    ssr: false,
    compatibilityDate: '2025-07-15',
    devtools: { enabled: true },
    css: ['~/assets/css/main.css'],
    modules: ['@nuxt/eslint', '@nuxt/image', '@nuxt/scripts', '@nuxt/test-utils', '@nuxt/ui', '@vueuse/nuxt'],
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
        optimizeDeps: { include: ['svga/dist/index.esm.min.js'] },
        build: {
            rollupOptions: {
                output: { manualChunks: { svga: ['svga/dist/index.esm.min.js'] } }
            }
        }
    }
})
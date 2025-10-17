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
    // app: {
    //     head: {
    //         link: [
    //             // Early connection to ImageKit (and CORS if you serve images cross-origin)
    //             { rel: 'preconnect', href: 'https://ik.imagekit.io/flylive' },
    //         ]
    //     }
    // },
    image: {
        imagekit: {
            baseURL: 'https://ik.imagekit.io/flylive'
        }
    },
})
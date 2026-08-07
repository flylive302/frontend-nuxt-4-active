// https://nuxt.com/docs/api/configuration/nuxt-config
import { defineNuxtConfig } from 'nuxt/config'
import { visualizer } from 'rollup-plugin-visualizer'
import { headConfig } from './config/head.config'

const bundleAnalyze = process.env.NUXT_ANALYZE === 'true' || process.env.ANALYZE === 'true'

export default defineNuxtConfig({
    compatibilityDate: '2025-02-03',
    ssr: false,
    spaLoadingTemplate: true,
    devtools: { enabled: false },
    // Client source maps for readable Sentry stack traces. 'hidden' emits the
    // maps but strips the //# sourceMappingURL comment, so nothing references
    // them publicly; the @sentry/nuxt module uploads then deletes them
    // (filesToDeleteAfterUpload below) so no .map ships to CF Pages / the APK.
    sourcemap: { client: 'hidden' },
    // Build-time source map upload. Only runs when SENTRY_AUTH_TOKEN is present
    // (CF Pages env for web, .env.capacitor for the native cap:build) — a
    // tokenless local/dev build skips upload but still deletes the maps.
    sentry: {
        org: process.env.SENTRY_ORG || 'flylive',
        project: process.env.SENTRY_PROJECT || 'javascript-vue',
        authToken: process.env.SENTRY_AUTH_TOKEN,
        sourcemaps: {
            filesToDeleteAfterUpload: ['.output/**/public/**/*.map', './**/*.map'],
        },
    },
    features: {
        inlineStyles: false,
    },
    css: ['~/assets/css/main.css'],
    modules: ['@sentry/nuxt/module', '@nuxt/eslint', '@nuxt/image', '@nuxt/scripts', '@nuxt/test-utils', '@nuxt/ui', '@vueuse/nuxt', '@pinia/nuxt', 'pinia-plugin-persistedstate/nuxt'],
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
            'composables/events',
        ],
    },
    // Native View Transitions API drives ALL page/layout animation (one system,
    // no dual-mount). `app.viewTransition: true` below makes every navigation a
    // VT by default; the directional slide + shared-element morphs are gated on
    // <html> attributes in main.css. Nuxt no-ops the whole thing where
    // `document.startViewTransition` is missing (WebViews < Chrome 111 / Safari
    // < 18 / Firefox < 129 → instant swap, still functional) and under reduced
    // motion.
    experimental: {
        viewTransition: true,
    },
    app: {
        head: headConfig,
        // Vue's page/layout transitions are OFF: they keep the old view mounted
        // during a swap, which collides with the View Transition snapshot (dual
        // `view-transition-name` → abort) and can't be both wrapped (for a slide
        // exit) and unwrapped (for a clean morph) on the same page. All animation
        // now runs through the native VT below instead.
        pageTransition: false,
        layoutTransition: false,
        // Every navigation is a View Transition. Directional root slide + the
        // room-card / profile-avatar morphs are all expressed as CSS on the VT
        // pseudo-elements (main.css), gated on <html data-nav|data-room-transition
        // |data-profile-avatar> set by the nav-direction plugin + transition
        // middleware. Pages need no per-route `viewTransition` meta.
        viewTransition: true,
    },
    // @nuxt/icon comes in via @nuxt/ui. With no collection installed and no
    // clientBundle config it resolves EVERY icon at runtime from
    // api.iconify.design — a third party in the render path of every session,
    // which does not self-heal after a network blip (failed lookups stay
    // cached for the life of the page). The collections are now installed and
    // bundled at build time instead.
    //
    // ⚠️ `provider: 'none'` is deliberately NOT set. `app/utils/flag-icon.ts`
    // builds `i-flag-${code}-4x3` from runtime country data (245 codes); the
    // whole set is 1587KB uncompressed / 416KB brotli in an eagerly imported
    // chunk, which is not payable on a mobile-first product. Flags therefore
    // still resolve remotely — tracked in
    // docs/pending-issues/frontend-offline-resilience/03.
    icon: {
        clientBundle: {
            scan: {
                // Default globs (@nuxt/icon 2.2.2 module.mjs:666) PLUS ts/js.
                // Specifying this key replaces the default list, so the
                // original patterns are repeated here verbatim. Icon names in
                // this app live in plain TS maps (NOTIFICATION_TYPE_CONFIG,
                // PROP_TYPE_ICONS, AGENCY_STATUS_CONFIG, the gender map …) —
                // the stock globs cover only .vue and would leave every one of
                // those icons resolving over the network.
                globInclude: ['**/*.{vue,jsx,tsx,md,mdc,mdx,yml,yaml,ts,js}'],
            },
            // @nuxt/ui's own default icons live inside node_modules, which the
            // scan excludes — chevrons, the modal close X, the loading spinner
            // and the toast icons would all be remote without these.
            icons: [
                'lucide:arrow-down',
                'lucide:arrow-left',
                'lucide:arrow-right',
                'lucide:arrow-up',
                'lucide:arrow-up-right',
                'lucide:check',
                'lucide:chevron-down',
                'lucide:chevron-left',
                'lucide:chevron-right',
                'lucide:chevron-up',
                'lucide:chevrons-left',
                'lucide:chevrons-right',
                'lucide:circle-alert',
                'lucide:circle-check',
                'lucide:circle-x',
                'lucide:copy',
                'lucide:copy-check',
                'lucide:ellipsis',
                'lucide:eye',
                'lucide:eye-off',
                'lucide:file',
                'lucide:folder',
                'lucide:folder-open',
                'lucide:grip-vertical',
                'lucide:hash',
                'lucide:info',
                'lucide:lightbulb',
                'lucide:loader-circle',
                'lucide:menu',
                'lucide:minus',
                'lucide:monitor',
                'lucide:moon',
                'lucide:panel-left-close',
                'lucide:panel-left-open',
                'lucide:plus',
                'lucide:rotate-ccw',
                'lucide:search',
                'lucide:square',
                'lucide:sun',
                'lucide:triangle-alert',
                'lucide:upload',
                'lucide:x',
            ],
            // Build-time tripwire: fails the build if the bundled icon payload
            // grows past this. Keep it — it is what stops a fat family (flags,
            // emoji, logos) being added without anyone noticing.
            sizeLimitKb: 256,
        },
    },
    ui: {
        colorMode: false,
        theme: {
            colors: ['primary', 'secondary', 'tertiary', 'info', 'success', 'warning', 'error']
        }
    },
    image: {
        // Capacitor bundle has no server, so default-provider (ipx) URLs like
        // /_ipx/... 404 inside the APK. .env.capacitor sets NUXT_IMAGE_PROVIDER=none
        // to pass src through untouched; web builds keep ipx (undefined = default).
        provider: process.env.NUXT_IMAGE_PROVIDER || undefined,
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
            // 'hidden' (not false) so the client build actually emits .map files
            // for @sentry/nuxt to upload; kept in sync with the top-level
            // sourcemap.client above. Maps are deleted post-upload, none ship.
            sourcemap: 'hidden',
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
                    // /sw.js is the self-destructing service worker (public/sw.js)
                    // that unregisters the retired PWA layer — must be served static.
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
            // OTA live-update manifest (capacitor-07). Absolute URL of the static
            // `manifest.json` on Cloudflare R2. Empty ⇒ the native OTA check no-ops
            // (web build never reads it). Baked into the bundle at generate time.
            otaManifestUrl: process.env.NUXT_PUBLIC_OTA_MANIFEST_URL || '',
            // Whole-app maintenance wall. `true` makes middleware/maintenance.global.ts
            // redirect every route to /maintenance and skips the bootstrap fetch +
            // socket connect entirely, so the wall holds with Laravel and MSAB down.
            // Baked into the bundle at build time (ssr: false), so flipping it costs a
            // CF Pages redeploy on web and an OTA push for the native shell — it is a
            // deploy-scoped switch, NOT a runtime toggle.
            maintenanceMode: process.env.NUXT_PUBLIC_MAINTENANCE_MODE === 'true',
            sentry: {
                dsn: process.env.NUXT_PUBLIC_SENTRY_DSN || '',
                environment: process.env.NUXT_PUBLIC_SENTRY_ENVIRONMENT || 'production',
                // Two build paths, both resolving to a git SHA so web and native
                // releases are directly comparable in Sentry:
                //   web    → CF_PAGES_COMMIT_SHA, set automatically by Cloudflare Pages.
                //   native → NUXT_PUBLIC_SENTRY_RELEASE, set by `cap:build` (package.json).
                // Do NOT put NUXT_PUBLIC_SENTRY_RELEASE in .env.capacitor — cap:build
                // computes it per build; a pinned value would stamp every bundle alike.
                release: process.env.NUXT_PUBLIC_SENTRY_RELEASE || process.env.CF_PAGES_COMMIT_SHA || '',
            },
        }
    },
})
<script lang="ts" setup>
import { defineAsyncComponent } from 'vue'

const route = useRoute()

// Auth routes are prerendered + lightweight. They don't need the room/wake-lock/
// media-session lifecycle, persistent room socket, or the system modal stack —
// skipping that work here is the largest TBT/render-delay win on /log-in/, /sign-up/,
// /forgot-password/.
const isAuthRoute = computed(() => /^\/(log-in|sign-up|forgot-password)(\/|$)/.test(route.path))

// Preconnect to image CDN + R2 only on routes that actually fetch from them.
// Auth routes have no images from these origins; emitting the preconnect there
// burned TLS handshake budget for no gain (Lighthouse: "unused preconnect").
useHead(() => isAuthRoute.value ? {} : {
    link: [
        { rel: 'preconnect', href: 'https://ik.imagekit.io', crossorigin: 'anonymous' },
        { rel: 'dns-prefetch', href: 'https://ik.imagekit.io' },
        { rel: 'preconnect', href: 'https://assets.flyliveapp.com', crossorigin: 'anonymous' },
        { rel: 'dns-prefetch', href: 'https://assets.flyliveapp.com' },
    ]
})

const GlobalShell = defineAsyncComponent(() => import('~/components/system/global-shell.client.vue'))

// Maintenance wall: the whole app is one static page, so GlobalShell must not
// mount. It owns the room lifecycle (which would try to rejoin a persisted room
// over a socket that is intentionally never opened) and the asset-download gate,
// a `fixed inset-0` overlay that would render ON TOP of the maintenance page.
const { maintenanceMode } = useRuntimeConfig().public
</script>

<template>
  <UApp>
    <NuxtRouteAnnouncer />
    <NuxtLoadingIndicator />
    <!-- All page/layout animation runs through the native View Transition API
         (main.css), which snapshots old + new roots — no grid-stack wrappers
         needed for overlap. -->
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>

    <GlobalShell v-if="!isAuthRoute && !maintenanceMode" />
  </UApp>
</template>

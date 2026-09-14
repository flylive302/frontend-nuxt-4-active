<script setup lang="ts">

defineOptions({ name: 'DiscoverAllEvents' })

definePageMeta({
  layout: 'home',
  middleware: 'auth'
})

const { banners, pending, error } = useEventBanners()

/** Cached banners stay painted during a silent refresh; only a cold, empty load shows the skeleton. */
const showSkeleton = computed(() => pending.value && banners.value.length === 0)
const showError = computed(() => !pending.value && banners.value.length === 0 && error.value != null)
const showEmpty = computed(() => !pending.value && banners.value.length === 0 && !showError.value)

/** Rows that fit a phone viewport on first paint; the rest load as they scroll in. */
const EAGER_BANNER_COUNT = 3

// Room-targeted banners cannot be opened by a plain link — see useBannerActions.
const { enterRoom, showPasswordPrompt, pendingRoom, onPasswordSuccess } = useRoomEntry()
const { openBanner, opening } = useBannerActions(enterRoom)

</script>

<template>
  <main>
    <SectionTitle class="px-3">Discover all events</SectionTitle>
    <!-- Loading: 3 rows at the banner's 3:1 box so the real list lands with no jump -->
    <div v-if="showSkeleton" class="flex flex-col gap-4 px-3 mt-6 pb-24" aria-busy="true">
      <USkeleton v-for="n in 3" :key="n" class="w-full aspect-[3/1] rounded-lg" />
    </div>

    <div v-else-if="showError" class="px-3 mt-6 pb-24">
      <UAlert
          color="error"
          variant="subtle"
          icon="i-lucide-alert-circle"
          title="Couldn't load events"
          description="Check your connection and try again."
      />
    </div>

    <p v-else-if="showEmpty" class="px-3 mt-6 pb-24 text-center text-sm text-muted">
      No events right now — check back soon.
    </p>

    <div v-else class="flex flex-col gap-4 px-3 mt-6 pb-24">
      <!-- `custom` is load-bearing — see useBannerActions: without it RouterLink
           navigates before a room destination can be intercepted. -->
      <NuxtLink
          v-for="(item, index) in banners"
          :key="item.id"
          v-slot="{ href, navigate }"
          :to="item.navigateTo"
          custom
      >
        <a
            :href="href"
            :aria-busy="opening"
            class="block"
            @click="openBanner(item.navigateTo, $event, navigate)"
        >
          <img
              :src="item.banner"
              alt=""
              aria-hidden="true"
              width="360"
              height="120"
              :loading="index < EAGER_BANNER_COUNT ? 'eager' : 'lazy'"
              decoding="async"
              class="h-full w-full rounded-lg"
              :class="opening && 'opacity-60'"
          >
        </a>
      </NuxtLink>
    </div>

    <!-- Password Prompt Modal (for banners pointing at a password-protected room) -->
    <RoomPasswordPromptModal
        v-if="showPasswordPrompt && pendingRoom"
        v-model:open="showPasswordPrompt"
        :room="pendingRoom"
        @success="onPasswordSuccess"
    />
  </main>
</template>

<script setup lang="ts">

defineOptions({ name: 'DiscoverAllEvents' })

definePageMeta({
  layout: 'home',
  middleware: 'auth'
})

const { banners } = useEventBanners()

// Room-targeted banners cannot be opened by a plain link — see useBannerActions.
const { enterRoom, showPasswordPrompt, pendingRoom, onPasswordSuccess } = useRoomEntry()
const { openBanner, opening } = useBannerActions(enterRoom)

</script>

<template>
  <main>
    <SectionTitle class="px-3">Discover all events</SectionTitle>
    <div class="flex flex-col gap-4 px-3 mt-6 pb-24">
      <!-- `custom` is load-bearing — see useBannerActions: without it RouterLink
           navigates before a room destination can be intercepted. -->
      <NuxtLink
          v-for="item in banners"
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

<script setup lang="ts">
import { ASSETS } from '~/constants/assets'
// ========================================
// Home Following Carousel
// ========================================
// Displays ranked following users in a draggable horizontal carousel.
// Each card links to /profile/{signature}.
// Uses UCarousel (Embla) with dragFree for momentum scrolling.

import { NuxtLink } from '#components'
import type { FollowingCard } from '~/composables/user/useFollowingData'
import MarqueeName from "~/components/common/marquee-name.vue";

defineOptions({ name: 'HomeFollowingCarousel' })

const props = withDefaults(
  defineProps<{
    users: FollowingCard[]
    /** 'profile' (default) links cards to /profile/{signature}; 'chat' emits `chat` so inbox surfaces can open a DM thread instead. */
    tapAction?: 'profile' | 'chat'
  }>(),
  { tapAction: 'profile' },
)

const emit = defineEmits<{
  /** Card tapped in 'chat' mode — parent starts/opens the DM thread. */
  chat: [user: FollowingCard]
}>()

const isChatMode = computed(() => props.tapAction === 'chat')

function onCardTap(user: FollowingCard): void {
  if (isChatMode.value) emit('chat', user)
}

// Presence dot — strip already renders online-only contacts (see callers),
// but derive from the store rather than assuming so the dot stays correct
// if this component is ever reused for a mixed list.
const presenceStore = usePresenceStore()
</script>

<template>
  <section aria-label="Following">
    <!-- Embla output differs from SSR — fallback keeps hydration aligned -->
    <ClientOnly>
      <template #fallback>
        <div class="flex gap-2 overflow-x-auto px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <component
            :is="isChatMode ? 'button' : NuxtLink"
            v-for="(item, index) in users"
            :key="item.signature"
            :to="isChatMode ? undefined : `/profile/${item.signature}`"
            class="following-card flex shrink-0 basis-24 flex-col items-center gap-1 active:scale-95 transition-transform duration-150"
            :style="{ animationDelay: `${index * 50}ms` }"
            @click="onCardTap(item)"
          >
            <div class="relative shrink-0">
              <UserAvatar
                :animated="true"
                defer-frame-animation
                :frame-id="item.frame_id"
                :img="item.avatar ?? ASSETS.AVATAR_PLACEHOLDER"
                class="w-14"
              />
              <span
                v-if="presenceStore.onlineByUserId[item.id] === true"
                class="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-success ring-2 ring-default"
                aria-label="Online"
              />
            </div>
            <div class="marquee-container w-fit -mt-2">
              <span class="text-xs text-center font-semibold w-full leading-tight marquee-text">
                {{ item.name }}
              </span>
            </div>
          </component>
        </div>
      </template>
      <UCarousel
        :items="users"
        :drag-free="true"
        :align="'start'"
        :contain-scroll="'trimSnaps'"
        :ui="{ item: 'basis-24' }"
      >
        <template #default="{ item, index }">
          <component
            :is="isChatMode ? 'button' : NuxtLink"
            :to="isChatMode ? undefined : `/profile/${item.signature}`"
            class="following-card w-full flex flex-col py-2 bg-primary/10 rounded-xl items-center gap-1 active:scale-95 transition-transform duration-150 "
            :style="{ animationDelay: `${index * 50}ms` }"
            @click="onCardTap(item)"
          >
            <div class="relative shrink-0">
              <UserAvatar
                :animated="true"
                defer-frame-animation
                :frame-id="item.frame_id"
                :img="item.avatar ?? ASSETS.AVATAR_PLACEHOLDER"
                class="w-14"
              />
              <span
                v-if="presenceStore.onlineByUserId[item.id] === true"
                class="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-success ring-2 ring-default"
                aria-label="Online"
              />
            </div>
            <MarqueeName
                class="mx-auto max-w-16"
                text-class="text-xs leading-none font-bold"
                :name="item.name"
                delay="0.5s"
            />
          </component>
        </template>
      </UCarousel>
    </ClientOnly>
  </section>
</template>

<style scoped>
/* Staggered fade-in on mount — each card enters with a slight delay */
.following-card {
  opacity: 0;
  animation: card-enter 300ms ease-out forwards;
}

@keyframes card-enter {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>

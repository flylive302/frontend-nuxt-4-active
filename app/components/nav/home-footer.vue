<script setup>
import { ASSETS } from '~/constants/assets'
import { createLogger } from '~/utils/logger';

const log = createLogger('[HomeFooter]');

const authStore = useAuthStore();
const roomStore = useRoomStore();
const inboxStore = useInboxStore();
const route = useRoute();
const room = useRoom();
const { enterRoom: doRoomEntry } = useRoomEntry();
const { resolvePropAsset } = usePropLookup();
const isClientHydrated = ref(false);

const createRoomOpen = ref(false);

onMounted(() => {
  isClientHydrated.value = true;
});

const navItems = [
  { to: '/', index: 0 },
  { to: '/discover-all-events', index: 1 },
  { to: null, index: 2 },
  { to: '/inbox', index: 3 },
  { to: '/profile', index: 4 },
];

const activeIndex = computed(() => {
  const p = route.path;
  // Chat icon: any inbox page
  if (p.startsWith('/inbox')) return 3;
  // Exact match for remaining items
  const match = navItems.find(item => item.to && p === item.to);
  return match?.index ?? 2;
});

async function handleMyRoomClick() {
  try {
    await room.fetchUserRoom();
    if (roomStore.userRoom) {
      doRoomEntry(roomStore.userRoom);
    } else {
      createRoomOpen.value = true;
    }
  } catch (error) {
  }
}
const inboxBadge = computed(() => {
  const count = inboxStore.dmUnread
  if (count === 0) return null
  return count > 99 ? '99+' : String(count)
})

const profileFrameAssetUrl = computed(() =>
  isClientHydrated.value ? (resolvePropAsset(authStore?.user?.frame_id) ?? undefined) : undefined
)

const profileAvatarImg = computed(() =>
  isClientHydrated.value ? (authStore.user?.avatar ?? ASSETS.AVATAR_PLACEHOLDER) : ASSETS.AVATAR_PLACEHOLDER
)
</script>

<template>
  <footer aria-label="Primary" class="fixed inset-x-2 z-50 bottom-4">
    <div class="grid grid-cols-5 items-center gap-6 px-2 py-1 touch-manipulation select-none rounded-xl backdrop-blur-lg">
      <UButton 
        to="/" class="flex-middle"
        aria-label="Home"
        :variant="activeIndex === 0 ? 'solid' : 'ghost'"
        square
        size="xl"
      >
        <UIcon class="size-8 drop-shadow-md" :name="activeIndex === 0 ? 'i-iconamoon-home-fill' : 'i-iconamoon-home-duotone'" />
      </UButton>
      <UButton 
        to="/discover-all-events" class="flex-middle" 
        aria-label="Discover events"
        :variant="activeIndex === 1 ? 'solid' : 'ghost'"
        square
        size="xl"
      >
        <UIcon class="size-8 drop-shadow-md" :name="activeIndex === 1 ? 'i-solar-emoji-funny-square-bold' : 'i-solar-emoji-funny-square-bold-duotone'" />
      </UButton>
      <UButton 
        class="flex-middle" 
        aria-label="My room"
        :variant="activeIndex === 2 ? 'solid' : 'ghost'" 
        size="xl"
        square
        @click="handleMyRoomClick"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="size-8 drop-shadow-md" width="14" height="14" viewBox="0 0 14 14">
          <g fill="none">
            <path fill="#333248" fill-rule="evenodd" d="M2.708 3.507a5.662 5.662 0 1 0 8.218 2.74l-.222-.073a1.65 1.65 0 0 1-.541.911a1.65 1.65 0 0 1-1.577.314h-.002l-1.258-.405a1.64 1.64 0 0 1-1.08-1.117l-.339-1.163l-2.413-.777a2 2 0 0 1-.786-.43" clip-rule="evenodd"/>
            <path fill="#ff2465" fill-rule="evenodd" d="M2.708 3.507A5.66 5.66 0 0 0 .173 9.73h3.195a1.36 1.36 0 0 0 1.359-1.36V7.25a1.36 1.36 0 0 1 1.359-1.404q.075 0 .149-.008l-.328-1.123l-2.413-.777a2 2 0 0 1-.786-.43Zm8.33 6.614l-.947-.694a2.8 2.8 0 0 0-1.239-.31H7.215a1.35 1.35 0 0 0 0 2.688a.953.953 0 0 1 .962.95v.657a5.68 5.68 0 0 0 2.86-3.29Z" clip-rule="evenodd"/>
            <path fill="#ff2465" d="M13.772 1.527L12.7 1.163a.364.364 0 0 0-.418.139l-.782 1.21L7.213.37a2.668 2.668 0 0 0-3.868 1.403a.73.73 0 0 0 .503.965l2.797.9l.279.097l.525 1.8a.39.39 0 0 0 .257.268l1.265.407a.397.397 0 0 0 .514-.44l-.278-1.339h.182l2.732.89a.72.72 0 0 0 .911-.44l.965-2.968a.364.364 0 0 0-.225-.386"/>
          </g>
        </svg>
      </UButton>
      <UButton 
        to="/inbox" class="flex-middle relative" 
        :aria-label="isClientHydrated && inboxBadge ? `Inbox, ${inboxBadge} unread` : 'Inbox'"
        :variant="activeIndex === 3 ? 'solid' : 'ghost'"
        square
        size="xl"
      >
        <UIcon class="size-8 drop-shadow-md" :name="activeIndex === 3 ? 'i-lucide-message-circle' : 'i-lucide-message-circle'" />
        <span
            v-if="isClientHydrated && inboxBadge"
            class="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-error text-white text-xs font-bold rounded-full flex items-center justify-center"
        >
          {{ inboxBadge }}
        </span>
      </UButton>
      <NuxtLink to="/profile" aria-label="Profile" class="justify-self-end">
        <UserAvatar
            class="w-13"
            :animated="true"
            defer-frame-animation
            :frame-asset-url="profileFrameAssetUrl"
            :img="profileAvatarImg"
        />
      </NuxtLink>
    </div>

    <UDrawer v-model:open="createRoomOpen" title="Create your Room" description="Start your journey by creating your own room.">
      <template #content>
        <div class="safe-area-bottom p-4 pb-8">
          <RoomCreate @success="createRoomOpen = false" />
        </div>
      </template>
    </UDrawer>
  </footer>
</template>
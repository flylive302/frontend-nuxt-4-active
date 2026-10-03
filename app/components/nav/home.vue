<script setup lang="ts">
import {ASSETS} from "~/constants/assets";

const open = defineModel < boolean > ('open', { default: false })
const inboxStore = useInboxStore()
const isClientHydrated = ref(false)
const topSentinel = ref<HTMLElement | null>(null)
const { isScrolled } = useScrolledFromTop(topSentinel)

onMounted(() => {
  isClientHydrated.value = true
})

const officialBadge = computed(() => {
  const count = inboxStore.officialUnreadCount
  if (count === 0) return null
  return count > 99 ? '99+' : String(count)
})
</script>
<template>
  <!-- Scroll sentinel: absolute with no insets, so it sits at the document top
       and scrolls with it. Its height IS the scroll distance before the header
       tints (h-2 = 8px). -->
  <div ref="topSentinel" aria-hidden="true" class="absolute h-2 w-px pointer-events-none" />

  <!-- Tint + border live on ::before and fade via opacity only — compositor-only,
       no repaint per frame. Don't move them back onto the header, don't
       transition background-color, don't add backdrop-filter. -z-10 keeps the
       layer under the logo/buttons (fixed z-50 = own stacking context). -->
  <header
      class="nav-home-header fixed inset-x-0 top-0 z-50 px-2 pb-1 safe-area-top flex items-center justify-between before:absolute before:inset-0 before:-z-10 before:pointer-events-none before:bg-neutral-950/80 before:border-b before:border-white/10 before:transition-opacity before:duration-300 before:ease-out before:will-change-[opacity] motion-reduce:before:transition-none"
      :class="isScrolled ? 'before:opacity-100' : 'before:opacity-0'"
  >
    <!-- Brand -->
    <NuxtImg
        :src="ASSETS.LOGO_MAIN"
        alt="FlyLive"
        preload
        fetchpriority="high"
        class="h-10 min-w-auto mt-1"
    />

    <!-- Actions -->
    <div class="flex items-center gap-1.5">
      <!---->
      <UButton
          aria-label="Leaderboard"
          size="md"
          variant="ghost"
          to="/rank"
      >
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            fill="none"
            viewBox="0 0 20 20"
        >
          <path
              fill="#fff"
              d="M11.056 2.115 10.32.248c-.122-.325-.503-.336-.638 0l-.737 1.867-1.635.293c-.29.054-.415.503-.2.773l1.188 1.445-.281 2.035c-.044.363.256.645.525.477l1.465-.969 1.457.953c.268.168.571-.113.525-.476l-.282-2.035 1.188-1.43c.212-.266.09-.715-.2-.773l-1.635-.293ZM8 10c-.553 0-1 .558-1 1.25v7.5C7 19.44 7.447 20 8 20h4c.553 0 1-.559 1-1.25v-7.5c0-.69-.447-1.25-1-1.25H8Zm-7 2.5c-.553 0-1 .558-1 1.25v5C0 19.44.447 20 1 20h4c.553 0 1-.559 1-1.25v-5c0-.69-.447-1.25-1-1.25H1Zm13 3.75v2.5c0 .69.447 1.249 1 1.249h4c.553 0 1-.559 1-1.25v-2.5c0-.691-.447-1.25-1-1.25h-4c-.553 0-1 .559-1 1.25Z"
          />
        </svg>
      </UButton>
      <UButton
          :aria-label="isClientHydrated && officialBadge ? `Official messages, ${officialBadge} unread` : 'Official messages'"
          size="md"
          variant="ghost"
          to="/inbox/official"
          class="relative"
      >
        <UIcon name="i-lucide-bell" class="size-5 text-white" aria-hidden="true" />
        <span
            v-if="isClientHydrated && officialBadge"
            aria-hidden="true"
            class="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-0.5 bg-error text-white text-[10px] font-bold rounded-full flex items-center justify-center"
        >
          {{ officialBadge }}
        </span>
      </UButton>
      <UButton aria-label="Search" icon="i-lucide-search" size="xl" color="primary" variant="ghost" @click="() => { open = true }" />
      <UserSearchDrawer v-model:open="open" title="Search User" description="Search users and visit their Profile." />
    </div>
  </header>
</template>
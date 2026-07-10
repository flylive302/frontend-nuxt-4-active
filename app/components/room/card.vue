<script setup lang="ts">
// ========================================
// Room Card
// ========================================
//
// Displays a room in the room grid.
// Password-protected rooms show a prompt before entering.
// ========================================

import type { Room } from '~/types/room/room'
import { ASSETS } from '~/constants/assets'
import { roomBackgroundImageSrc } from '~/utils/imagekit'

defineOptions({
  inheritAttrs: false
})

// ========================================
// Props
// ========================================

const props = withDefaults(defineProps<{
  room: Room
  /** Eager decode for likely-LCP carousel cells (may be multiple while Embla settles). */
  priorityLcp?: boolean
  /** Only one carousel cell should use fetchpriority=high (true LCP candidate). */
  highFetchPriority?: boolean
  /** Controls responsive `sizes` for ImageKit — carousel vs 2-col grid */
  cardLayout?: 'carousel' | 'grid'
}>(), {
  priorityLcp: false,
  cardLayout: 'grid',
})

// ========================================
// Dependencies
// ========================================

const { enterRoom, showPasswordPrompt, pendingRoom, entering, onPasswordSuccess } = useRoomEntry()
const { roomExpandStyleForRoom } = useRoomExpandTransition()

// ========================================
// Computed
// ========================================

const effectiveHighFetchPriority = computed(
  () => props.highFetchPriority ?? props.priorityLcp,
)

/** Live badge label */
const badgeDisplay = computed(() => {
  if (!props.room.is_live) return null
  return `Live / ${props.room.participant_count}`
})


const roomBackgroundSrc = computed(() =>
  roomBackgroundImageSrc(
    props.room.background ?? ASSETS.ROOM_BG_PLACEHOLDER,
    props.cardLayout,
    effectiveHighFetchPriority.value,
  ),
)

/** Match tailwind h-72 / h-56 + max-w-60 / max-w-40 for aspect box + ImageKit requests */
const roomImageWidth = computed(() => (props.cardLayout === 'carousel' ? 240 : 160))
const roomImageHeight = computed(() => (props.cardLayout === 'carousel' ? 288 : 224))

// ========================================
// Navigation
// ========================================

/**
 * Handle room card click.
 * Delegates to useRoomEntry for password-protected room handling. The URL this
 * card already painted becomes the room page's first frame, so the card expands
 * into a real background rather than an empty box.
 */
function handleRoomClick(): void {
  void enterRoom(props.room, roomBackgroundSrc.value)
}
</script>

<template>
  <!-- While the join round-trip is in flight (`entering`), the card pulses in
       place so the tap reads as "loading" instead of dead. The pulse stops the
       instant navigation resolves, handing straight off to the expand morph. -->
  <article
    v-bind="$attrs"
    class="relative rounded-3xl squircle overflow-hidden"
    :class="{ 'room-card-loading': entering }"
    :style="roomExpandStyleForRoom(props.room.id)"
    @click="handleRoomClick"
  >
    <figure class="h-full w-full">
      <img
        :src="roomBackgroundSrc"
        :alt="props.room.name ?? undefined"
        :width="roomImageWidth"
        :height="roomImageHeight"
        :sizes="props.cardLayout === 'carousel' ? '(max-width: 640px) 72vw, 240px' : '(max-width: 640px) 45vw, 160px'"
        class="h-full min-h-0 w-full object-cover"
        :loading="props.priorityLcp ? 'eager' : 'lazy'"
        :fetchpriority="effectiveHighFetchPriority ? 'high' : undefined"
        decoding="async"
      >
      <figcaption class="sr-only">{{ props.room.name }}</figcaption>
    </figure>

    <div class="absolute z-10 top-0 inset-x-0 p-1 pr-2 flex justify-end">
      <div class="w-fit flex items-center justify-end gap-2 backdrop-blur-2xl rounded rounded-tr-2xl px-2 border border-primary/10 shadow-md">
        <img :src="ASSETS.COIN_ICON+`?tr=w-24,q-80,f-webp`" class="size-5" alt="room xp indicator">
        <p class="font-bold text-lg text-white">{{formatXp(props.room.room_xp)}}</p>
      </div>
    </div>

    <!-- Overlay content -->
    <aside class="absolute inset-0 p-2 flex items-end">

      <div class="backdrop-blur-sm shadow-md border border-primary/10 rounded-t-xl rounded-b-3xl p-2 w-full flex items-end justify-between">
        <div class="flex items-center gap-1">
          <img
            :src="`${props.room.logo ?? ASSETS.AVATAR_PLACEHOLDER}?tr=w-24,q-60,f-webp`"
            alt="Live"
            width="24"
            height="24"
            class="size-6 object-cover rounded-full ring-2 ring-primary"
            loading="lazy"
            decoding="async"
          >

          <!-- Text -->
          <p class="text-sm font-bold max-w-24 leading-none">
            {{ props.room.name }}
          </p>
        </div>

        <div class="flex items-center gap-1">
          <!-- Live dot -->
          <span v-if="badgeDisplay" class="relative inline-flex mr-1">
            <span class="absolute inline-block size-2 rounded-full bg-success animate-ping"/>
            <span class="relative inline-block size-2 rounded-full bg-success"/>
          </span>
          <UIcon name="i-fluent-people-team-20-filled" />
          <p class="font-bold text-lg text-white">{{props.room.participant_count}}</p>
        </div>
      </div>

    </aside>

    <!-- Password lock indicator (top-right) -->
    <div v-if="props.room.is_password_protected" class="absolute top-0 right-0 bg-primary size-8 flex-middle rounded-bl-lg shadow-lg">
      <UIcon name="i-lucide-lock" class="size-4 text-white drop-shadow-lg" />
    </div>

  </article>

  <!-- Password Prompt Modal -->
  <RoomPasswordPromptModal
    v-if="showPasswordPrompt && pendingRoom"
    v-model:open="showPasswordPrompt"
    :room="pendingRoom"
    @success="onPasswordSuccess"
  />
</template>
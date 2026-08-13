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
import { ROOM_CARD_OWNER_AVATAR_WIDTH } from '~/constants/room'
import { roomBackgroundImageSrc, roomLogoCardSrc, avatarImageSrc } from '~/utils/imagekit'
import MarqueeName from "~/components/common/marquee-name.vue";

defineOptions({
  inheritAttrs: false
})

// ========================================
// Props
// ========================================

const props = withDefaults(defineProps<{
  room: Room
  /** Eager decode for likely-LCP carousel cells (maybe multiple while Embla settles). */
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
const { roomExpandStyleForRoom, registerRoomCard, claimRoomExpand } = useRoomExpandTransition()

// The same room can render in several cards at once (carousel + grid); only
// the arbitration winner may carry the shared view-transition-name.
const cardInstanceKey = registerRoomCard(props.room.id)

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


/**
 * The card's main image — the room LOGO, cropped to the card box by the CDN.
 *
 * Not the background: that is the room PAGE's image, and painting it here made
 * every card in the grid a preview of a wallpaper rather than of a room.
 * `ROOM_BG_PLACEHOLDER` stays the fallback (not the avatar placeholder) because
 * it is the only card-shaped one.
 */
const roomLogoSrc = computed(() =>
  roomLogoCardSrc(props.room.logo ?? ASSETS.ROOM_BG_PLACEHOLDER),
)

/**
 * Owner avatars are NOT all ImageKit URLs — `users.avatar` may hold a Google
 * OAuth URL (`lh3.googleusercontent.com/...`) that never touched our CDN, which
 * `withImageKitTransform` correctly passes through untouched. Google expires
 * those when the account photo changes, and the dead ones 400, so a card would
 * paint a broken-image icon.
 *
 * The room logo this chip used to show was always an ImageKit URL and could not
 * fail this way, so the fallback is new with the switch to owner avatars.
 * Mirrors `components/user/avatar.vue` — same reset-on-change so a recycled card
 * retries the new owner's URL instead of staying stuck on the placeholder.
 */
const hasOwnerAvatarError = ref(false)
watch(() => props.room.owner?.avatar, () => { hasOwnerAvatarError.value = false })

/**
 * Room owner's avatar for the footer chip.
 *
 * Free of extra requests by construction: the rooms-list query already eager
 * loads the owner and `avatar` is a plain column on it, so this rides along in
 * the payload the grid was fetching anyway.
 *
 * ⚠️ `owner` on a LIST room is a trimmed snippet, and the list response is
 * edge-cached (`s-maxage=15, stale-while-revalidate=60`) — responses predating
 * the backend field keep serving for ~75s after a deploy. The placeholder
 * fallback is what covers that window, so do not drop it.
 */
const ownerAvatarSrc = computed(() => {
  if (hasOwnerAvatarError.value) return avatarImageSrc(ASSETS.AVATAR_PLACEHOLDER)
  return avatarImageSrc(props.room.owner?.avatar ?? ASSETS.AVATAR_PLACEHOLDER, {
    w: ROOM_CARD_OWNER_AVATAR_WIDTH,
  })
})

/**
 * Low-res seed handed to the room page so its background has something to paint
 * during the expand morph. The card no longer renders this, so it is a warm
 * *prefetch* rather than an already-decoded bitmap — still a faster first frame
 * than waiting on the full-resolution background, at ~8 kB.
 */
const roomBackgroundSeedSrc = computed(() =>
  roomBackgroundImageSrc(
    props.room.background ?? ASSETS.ROOM_BG_PLACEHOLDER,
    props.cardLayout,
    effectiveHighFetchPriority.value,
  ),
)

/** Match tailwind h-72 / h-56 + max-w-60 / max-w-40 so the box reserves space before load. */
const roomImageWidth = computed(() => (props.cardLayout === 'carousel' ? 240 : 160))
const roomImageHeight = computed(() => (props.cardLayout === 'carousel' ? 288 : 224))

// ========================================
// Navigation
// ========================================

/**
 * Handle room card click.
 * Delegates to useRoomEntry for password-protected room handling. The low-res
 * background URL seeds the room page's first frame, so the card expands into a
 * real background rather than an empty box.
 */
function handleRoomClick(): void {
  claimRoomExpand(cardInstanceKey)
  void enterRoom(props.room, roomBackgroundSeedSrc.value)
}

</script>

<template>
  <!-- While the join round-trip is in flight (`entering`), the card smoothly
       shrinks once and holds so the tap reads as "loading" instead of dead. It
       hands straight off to the expand morph the instant navigation resolves. -->
  <article
    v-bind="$attrs"
    class="relative rounded-3xl squircle overflow-hidden"
    :class="{ 'room-card-loading': entering }"
    :style="roomExpandStyleForRoom(props.room.id, cardInstanceKey)"
    @click="handleRoomClick"
  >
    <figure class="h-full w-full">
      <img
        :src="roomLogoSrc"
        :alt="props.room.name ?? undefined"
        :width="roomImageWidth"
        :height="roomImageHeight"
        class="h-full min-h-0 w-full object-cover"
        :loading="props.priorityLcp ? 'eager' : 'lazy'"
        :fetchpriority="effectiveHighFetchPriority ? 'high' : undefined"
        decoding="async"
      >
      <figcaption class="sr-only">{{ props.room.name }}</figcaption>
    </figure>

    <div class="absolute z-10 top-0 inset-x-0 p-1 pr-2 gap-2 flex justify-end">
      <!-- Password lock indicator (top-right) -->
      <div v-if="props.room.is_password_protected" class="bg-primary size-8 flex-middle rounded-md shadow-lg">
        <UIcon name="i-lucide-lock" class="size-4 text-white drop-shadow-lg" />
      </div>

      <CountryFlag :code="props.room.country" class="size-6 rounded-md drop-shadow-lg" />

      <div class="w-fit flex items-center justify-end gap-2 backdrop-blur-2xl rounded rounded-tr-2xl px-2 border border-primary/10 shadow-md">
        <img :src="ASSETS.COIN_ICON" class="size-5" alt="room xp indicator">
        <p class="font-bold text-lg text-white">{{formatXp(props.room.daily_xp)}}</p>
      </div>
    </div>

    <!-- Overlay content -->
    <aside class="absolute inset-0 p-2 flex items-end">

      <div class="backdrop-blur-sm shadow-md border border-primary/10 rounded-t-xl rounded-b-3xl p-2 w-full flex items-end justify-between">
        <div class="flex items-center gap-1 max-w-8/12">
          <img
            :src="ownerAvatarSrc"
            alt="Room owner"
            width="24"
            height="24"
            class="size-6 object-cover rounded-full ring-2 ring-primary"
            referrerpolicy="no-referrer"
            loading="lazy"
            decoding="async"
            @error="hasOwnerAvatarError = true"
          >

          <!-- Text -->
          <MarqueeName
              text-class="text-sm font-bold leading-none"
              :name="props.room.name"
          />
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

  </article>

  <!-- Password Prompt Modal -->
  <RoomPasswordPromptModal
    v-if="showPasswordPrompt && pendingRoom"
    v-model:open="showPasswordPrompt"
    :room="pendingRoom"
    @success="onPasswordSuccess"
  />
</template>
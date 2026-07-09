<script setup lang="ts">
/**
 * ChatMessage - Individual chat message component
 * Displays a single ephemeral chat message with user info.
 *
 * Resolves avatar/frame/name from the live participants Map (same pattern as seat.vue)
 * so profile updates are reflected immediately across all messages.
 * Falls back to snapshot fields for users who have left the room.
 */
import type { ChatMessageEvent } from '~/types/room/audio';
import MarqueeName from "~/components/common/marquee-name.vue";

const props = defineProps<{
  message: ChatMessageEvent;
}>();

const { getLevelFromXp } = useLevelLookup()

const participantsStore = useRoomParticipantsStore();
const { resolvePropAsset, resolvePropThumbnail } = usePropLookup();

// Resolve live participant data first, then fall back to the message author
// snapshot. Cross-region/rejoin races can deliver chat before participant sync.
const participant = computed(() => participantsStore.participants.get(props.message.userId));
const displayName = computed(() => participant.value?.name ?? props.message.userName ?? 'Unknown');
const displayAvatar = computed(() => participant.value?.avatar ?? props.message.userAvatar ?? undefined);
const displayFrame = computed(() => resolvePropAsset(participant.value?.frame_id ?? props.message.userFrameId) ?? undefined);

const chatBubbleId = computed(() => participant.value?.chat_bubble_id ?? props.message.userChatBubbleId ?? null);
// Chat bubble props store the frame image in thumbnail_url (asset_url is empty for this type).
// Falls back to the default bubble so the frame is always visible.
const DEFAULT_BUBBLE_URL = 'https://ik.imagekit.io/flylive/vip/15/chat_bubble.png';
const chatBubbleImage = computed(() => {
  const url = chatBubbleId.value ? resolvePropThumbnail(chatBubbleId.value) : null;
  return url || DEFAULT_BUBBLE_URL; // `||` so an empty string also falls back
});

const bubbleStyle = computed(() => ({
  borderImageSource: `url(${chatBubbleImage.value})`,
}));

// Format timestamp to relative time
const formattedTime = computed(() => {
  const now = Date.now();
  const diff = now - props.message.timestamp;
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
});

const seatsStore = useRoomSeatsStore();

// Open the view-only profile drawer for this message's author. No-op when the
// author has left the room (no live participant to build the card from).
function handleAvatarClick() {
  if (!participant.value) return;
  seatsStore.openProfile(props.message.userId);
}

const wealthLevel = computed(() =>
    getLevelFromXp(participant?.value?.wealth_xp, 'wealth')
)

const charmLevel = computed(() =>
    getLevelFromXp(participant?.value?.charm_xp, 'charm')
)
</script>

<template>
  <div class="flex py-3">
    <!-- Avatar -->
    <UserAvatar :img="displayAvatar" :frame-asset-url="displayFrame" :animated="true" class="shrink-0 size-12" @click="handleAvatarClick" />
    <div class="min-w-0">

      <div class="flex items-center w-fit ml-1.5 px-2 gap-1.5 backdrop-blur-lg bg-primary-30 ring ring-primary rounded-md">
        <MarqueeName
            class="flex-1 max-w-24 mx-auto"
            text-class="text-sm font-bold leading-none"
            :name="displayName"
            delay="0s"
        />
        <span class="text-xs text-gray-white shrink-0">{{ formattedTime }}</span>
      </div>
      <div class="flex items-center mt-1 ml-2">
        <UIcon
            :name="`i-flag-${participant?.country.toLowerCase().trim()}-4x3`"
            class="rounded overflow-hidden h-5 size-6 shadow-lg"
        />
        <img
            v-if="participant?.vip_level"
            :src="`https://ik.imagekit.io/flylive/vip/${participant?.vip_level}/badge.png`"
            class="w-10"
            alt=""
        >
        <img v-if="wealthLevel.badge" :src="wealthLevel.badge.image_url" class="h-5" alt="users wealth badge">

        <img v-if="charmLevel.badge" :src="charmLevel.badge.image_url" class="h-4" alt="users charm badge">
      </div>

      <BadgesEquippedBadgeMarquee
        v-if="participant?.equipped_badges?.length"
        :equipped-badges="participant.equipped_badges"
        class="ml-1.5 mt-0.5 max-w-48"
      />

      <div v-if="participant?.vip_level" class="bubble" :style="bubbleStyle">
        <p class="text-sm wrap-break-word font-semibold">{{ message.content }}</p>
      </div>
      <div v-else class="w-fit p-2 rounded-md bg-primary/10 ring ring-primary my-2 backdrop-blur-xs max-w-10/12 ml-2">
        <p class="text-sm wrap-break-word font-semibold">{{message.content}}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bubble {
  width: fit-content;
  max-width: 100%;
  border-style: solid;
  border-width: 46px 79px;
  border-image-slice: 49% fill;
  border-image-width: 1;
  border-image-repeat: stretch;
}
.bubble p {
  margin: -16px -40px;
}
</style>

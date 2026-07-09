<script setup lang="ts">
/**
 * Reaction Card — INTENT only. Static WebP thumbnail button for one manifest
 * entry. Never renders a live Lottie player (grid stays cheap to scroll).
 */
import { getReactionThumbnailUrl } from '~/constants/reactions';
import type { ReactionManifestEntry } from '~/constants/reactions-manifest';

defineProps<{
  entry: ReactionManifestEntry;
}>();

const emit = defineEmits<{
  select: [code: string];
}>();
</script>

<template>
  <button
    type="button"
    class="flex flex-col items-center justify-center gap-1 rounded-lg p-2 hover:bg-white/10 active:bg-white/20 transition-colors"
    :aria-label="entry.name"
    @click="emit('select', entry.code)"
  >
    <img
      :src="getReactionThumbnailUrl(entry.code)"
      :alt="entry.name"
      loading="lazy"
      width="48"
      height="48"
      class="size-12 object-contain"
    >
    <span class="text-xs text-white/70 truncate w-full text-center">{{ entry.name }}</span>
  </button>
</template>

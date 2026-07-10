<script setup lang="ts">
/**
 * Reaction Card — INTENT only. Static SVG thumbnail button for one manifest
 * entry. Never renders a live Lottie player, and never an animated raster
 * (see getReactionThumbnailUrl) — the grid stays cheap to scroll.
 */
import { getReactionThumbnailFallbackUrl, getReactionThumbnailUrl } from '~/constants/reactions';
import type { ReactionManifestEntry } from '~/constants/reactions-manifest';

const props = defineProps<{
  entry: ReactionManifestEntry;
}>();

const emit = defineEmits<{
  select: [code: string];
}>();

/**
 * Thumbnail source, degraded in one step: ImageKit mirror → Google Noto
 * hotlink → nothing (a few catalog entries have no asset at all, e.g. ©️/®️).
 * Retrying the hotlink keeps the grid usable if the bundle ships before the
 * mirror upload, instead of rendering 609 broken icons.
 */
const src = ref(getReactionThumbnailUrl(props.entry.code));
const failed = ref(false);

function handleError(): void {
  const fallback = getReactionThumbnailFallbackUrl(props.entry.code);
  if (src.value === fallback) {
    failed.value = true;
    return;
  }
  src.value = fallback;
}
</script>

<template>
  <button
    type="button"
    class="flex flex-col items-center justify-center gap-1 rounded-lg p-2 hover:bg-white/10 active:bg-white/20 transition-colors"
    :aria-label="entry.name"
    @click="emit('select', entry.code)"
  >
    <img
      v-if="!failed"
      :src="src"
      :alt="entry.name"
      loading="lazy"
      decoding="async"
      width="48"
      height="48"
      class="size-12 object-contain"
      @error="handleError"
    >
    <div v-else class="size-12" />
    <span class="text-xs text-white/70 truncate w-full text-center">{{ entry.name }}</span>
  </button>
</template>

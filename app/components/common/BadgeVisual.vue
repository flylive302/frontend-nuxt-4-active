<script setup lang="ts">
/**
 * BadgeVisual
 *
 * Shared badge renderer: static image always, animated asset overlay only when
 * `assetUrl` is present AND the badge is on-screen. Unmounts the animated layer
 * off-screen to free canvas/video resources. No business logic beyond visibility
 * gating — the animated/static decision itself lives in `resolveBadgeAsset`.
 */
import { BADGE_VISUAL_INTERSECTION_THRESHOLD } from '~/constants/badges';
import { resolveBadgeAsset } from '~/utils/badgeVisual';

const props = withDefaults(
  defineProps<{
    imageUrl: string;
    assetUrl?: string | null;
    alt?: string;
    imgClass?: string;
  }>(),
  {
    assetUrl: undefined,
    alt: '',
    imgClass: undefined,
  }
);

const rootRef = ref<HTMLElement | null>(null);
const isVisible = ref(false);

const resolved = computed(() => resolveBadgeAsset(props.imageUrl, props.assetUrl));
const showAnimated = computed(() => resolved.value.animated && isVisible.value);

useIntersectionObserver(
  rootRef,
  ([entry]) => {
    isVisible.value = entry?.isIntersecting ?? false;
  },
  { threshold: BADGE_VISUAL_INTERSECTION_THRESHOLD }
);
</script>

<template>
  <div ref="rootRef" class="relative inline-block">
    <img
      :src="resolved.src"
      :alt="alt"
      loading="lazy"
      :class="[imgClass, { 'opacity-0': showAnimated }]"
    >
    <AssetPlayer
      v-if="showAnimated"
      :src="assetUrl as string"
      :thumbnail-src="resolved.src"
      :loop="0"
      muted
      class="absolute inset-0"
    />
  </div>
</template>

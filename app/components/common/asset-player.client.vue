<script setup lang="ts">
/**
 * Shared Asset Player
 *
 * Single switch for animated/static media (video / svga / vap / image).
 * Asset type comes from an explicit `assetType` or is inferred from the URL.
 * Frame / signature / room_theme are NOT media — they stay in their callers.
 *
 * Uses the common (canvas) svga/vap players with `height: auto` so the asset
 * renders at its intrinsic aspect ratio inside height-less preview containers.
 */
import type { GiftAssetType } from '~/types/gift/gift';
import { inferAssetType } from '~/utils/asset';
import { resolveVideoUrl } from '~/utils/platform';

interface PlayerController {
  restart?: () => void;
  reload?: () => void;
}

const props = withDefaults(
  defineProps<{
    src: string;
    assetType?: GiftAssetType;
    thumbnailSrc?: string;
    loop?: number;
    muted?: boolean;
    autoplay?: boolean;
    /** If set, the image branch auto-completes after N ms; else plain image. */
    autoCompleteMs?: number;
  }>(),
  {
    assetType: undefined,
    thumbnailSrc: undefined,
    loop: 0,
    muted: true,
    autoplay: true,
    autoCompleteMs: undefined,
  }
);

const emit = defineEmits<{
  complete: [];
}>();

const resolvedType = computed<GiftAssetType>(
  () => props.assetType ?? inferAssetType(props.src)
);

const videoSrc = computed(() => resolveVideoUrl(props.src));

const activePlayer = ref<PlayerController | null>(null);

function restart(): void {
  const p = activePlayer.value;
  if (p?.restart) p.restart();
  else p?.reload?.();
}

defineExpose({ restart });
</script>

<template>
  <div class="w-full flex items-center justify-center">
    <RoomGiftVideoPlayer
      v-if="resolvedType === 'video'"
      ref="activePlayer"
      class="w-full"
      :src="videoSrc"
      @ended="emit('complete')"
      @error="emit('complete')"
    />

    <SvgaPlayer
      v-else-if="resolvedType === 'svga'"
      ref="activePlayer"
      class="relative w-full z-10"
      :name="src"
      height="auto"
      :loop="loop"
      :autoplay="autoplay"
    />

    <VapPlayer
      v-else-if="resolvedType === 'vap'"
      ref="activePlayer"
      :name="src"
      :loop="loop"
      :muted="muted"
      :autoplay="autoplay"
      @complete="emit('complete')"
    />

    <RoomGiftStaticDisplay
      v-else-if="autoCompleteMs !== undefined"
      ref="activePlayer"
      class="w-full"
      :src="thumbnailSrc ?? src"
      :duration-ms="autoCompleteMs"
      @timeout="emit('complete')"
    />

    <NuxtImg
      v-else
      :src="thumbnailSrc ?? src"
      class="w-full h-auto object-contain"
      format="webp"
      loading="eager"
    />
  </div>
</template>

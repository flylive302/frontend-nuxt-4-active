<script setup lang="ts">
// ========================================
// Imports
// ========================================

// ========================================
// Constants
// ========================================

/** Default padding when no frame is equipped */
const DEFAULT_PADDING = '16%'

// ========================================
// Props
// ========================================

const props = withDefaults(defineProps<{
  frameName?: string
  /** Full CDN URL — provided by backend (e.g. https://assets.flyliveapp.com/frames/7.svga) */
  frameAssetUrl?: string
  img?: string | undefined | null
  animated?: boolean
}>(), {
  frameName: '',
  frameAssetUrl: 'https://assets.flyliveapp.com/frames/7.svga',
  img: undefined,
  animated: false,
});

// ========================================
// Computed
// ========================================

/**
 * Parse frameName into display config and resolve SVGA source URL.
 *
 * frameName format: `{name}-{scale}-{padding}-{top}-{left}`
 * e.g. `vip_1_frame-100-26-0%-0%`
 *
 * The SVGA source URL is resolved from the `frameAssetUrl` prop,
 * which contains the full CDN URL from the backend database.
 */
const frameConfig = computed(() => {
  const parts = props.frameName?.split('-') ?? []

  // Custom format: name-girth-padding-top-left
  if (parts.length === 5) {
    const [, girth, padd, top, left] = parts

    // frameAssetUrl must be provided — full URL from backend DB
    if (!props.frameAssetUrl) return null

    return {
      name: props.frameAssetUrl,
      padding: `${padd}%`,
      style: {
        transform: `scale(${+(girth || 100) / 100})`,
        top: top || '0%',
        left: left || '0%',
      },
    }
  }

  // frameName or frameAssetUrl provided — use the full URL directly
  if (props.frameAssetUrl) {
    return {
      name: props.frameAssetUrl,
      padding: DEFAULT_PADDING,
      style: {
        transform: `scale(${110 / 100})`,
        top: '0%',
        left: '0%',
      },
    }
  }

  // No frame data at all
  return null
})
</script>

<template>
  <div class="relative aspect-square cursor-pointer">
    <div class="relative" :style="{ padding: frameConfig?.padding ?? DEFAULT_PADDING }">
      <!-- Avatar Image -->
      <NuxtImg
        class="aspect-square rounded-full object-contain w-full"
        :src="props.img ?? 'https://ik.imagekit.io/flylive/siteAssets/seats/default-seat.webp'" alt="avatar"
        :width="96"
        :height="96"
        format="webp"
        densities="x1 x2"
        sizes="96px"
        loading="lazy"
      />
      <!-- Frame layer (on top) -->
      <SvgaPlayer
        v-if="props.animated && frameConfig?.name"
        class="absolute" height="auto"
        :name="frameConfig.name"
        :style="frameConfig.style"
      />
    </div>
  </div>
</template>

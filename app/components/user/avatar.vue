<script setup lang="ts">
// ========================================
// Imports
// ========================================

// ========================================
// Constants
// ========================================

/** CDN base for parsed SVGA animation JSON files */
const ANIMATION_CDN_BASE = 'https://assets.flyliveapp.com/parsedAnimations'

/** Default padding when no frame is equipped */
const DEFAULT_PADDING = '16%'

// ========================================
// Props
// ========================================

const props = withDefaults(defineProps<{
  frameName?: string
  /** Full CDN URL override — when provided, bypasses short-name resolution */
  frameAssetUrl?: string
  img?: string | undefined | null
  animated?: boolean
}>(), {
  frameName: '',
  frameAssetUrl: '',
  img: undefined,
  animated: false,
});

// ========================================
// Helpers
// ========================================

/**
 * Resolve a short SVGA animation name to the full CDN URL.
 * If the name is already a full URL (starts with http), returns it as-is.
 */
function resolveAnimationUrl(name: string): string {
  if (!name) return ''
  if (name.startsWith('http')) return name
  return `${ANIMATION_CDN_BASE}/${name}.json`
}

// ========================================
// Computed
// ========================================

/**
 * Parse frameName into display config and resolve SVGA source URL.
 *
 * frameName format: `{name}-{scale}-{padding}-{top}-{left}`
 * e.g. `vip_1_frame-100-26-0%-0%`
 *
 * The SVGA source URL is resolved in order:
 * 1. `frameAssetUrl` prop (full CDN URL from mall/equipped data)
 * 2. Short name extracted from frameName → resolved via CDN base
 */
const frameConfig = computed(() => {
  const parts = props.frameName?.split('-') ?? []

  // Custom format: name-girth-padding-top-left
  if (parts.length === 5) {
    const [name, girth, padd, top, left] = parts
    if (!name) return null

    // Prefer explicit asset URL, fall back to resolving the short name
    const svgaUrl = props.frameAssetUrl || resolveAnimationUrl(name)

    return {
      name: svgaUrl,
      padding: `${padd}%`,
      style: {
        transform: `scale(${+(girth || 100) / 100})`,
        top: top || '0%',
        left: left || '0%',
      },
    }
  }

  // frameName without display params — resolve as plain animation name
  if (props.frameName || props.frameAssetUrl) {
    const svgaUrl = props.frameAssetUrl || resolveAnimationUrl(props.frameName)
    if (!svgaUrl) return null

    return {
      name: svgaUrl,
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

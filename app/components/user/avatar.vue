<script setup lang="ts">
import { useIntersectionObserver } from '@vueuse/core'
import { ASSETS } from '~/constants/assets'
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
  frameAssetUrl?: string
  img?: string | undefined | null
  animated?: boolean
  /**
   * When true with `animated`, SVGA frame loads only after the avatar enters
   * the viewport (or near it). Cuts main-thread decode work for off-screen carousels.
   */
  deferFrameAnimation?: boolean
}>(), {
  frameName: '',
  frameAssetUrl: ASSETS.DEFAULT_FRAME,
  img: undefined,
  animated: false,
  deferFrameAnimation: false,
});

const rootRef = ref<HTMLElement | null>(null)
const svgaAllowed = ref(!props.deferFrameAnimation)

// Track load errors so we can fall back to AVATAR_PLACEHOLDER.
// Reset on every src change so a seat user-swap retries the new URL.
const hasImgError = ref(false)
watch(() => props.img, () => { hasImgError.value = false })

const resolvedImgSrc = computed(() => {
  if (hasImgError.value) return ASSETS.AVATAR_PLACEHOLDER  // occupied + failed → person silhouette
  return props.img ?? ASSETS.DEFAULT_SEAT_IMG               // no img → red chair (empty seat)
})

function onImgError() { hasImgError.value = true }

useIntersectionObserver(
  rootRef,
  ([entry]) => {
    if (entry?.isIntersecting) {
      svgaAllowed.value = true
    }
  },
  { rootMargin: '100px', threshold: 0.01 },
)

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
  <div ref="rootRef" class="relative aspect-square cursor-pointer">
    <div class="relative" :style="{ padding: frameConfig?.padding ?? DEFAULT_PADDING }">
      <img
        class="aspect-square rounded-full object-contain w-full"
        :src="resolvedImgSrc"
        alt="avatar"
        referrerpolicy="no-referrer"
        @error="onImgError"
      >
      <!-- Frame layer (on top) -->
      <SvgaPlayer
        v-if="props.animated && frameConfig?.name && svgaAllowed"
        class="absolute" height="auto"
        :name="frameConfig.name"
        :style="frameConfig.style"
      />
    </div>
  </div>
</template>

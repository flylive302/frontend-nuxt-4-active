<script setup lang="ts">
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
   * When true with `animated`, the SVGA frame player mounts only while the
   * avatar is on-screen (or near it) and unmounts — pausing the canvas loop
   * — the moment it scrolls out. Parsed SVGA entity stays cached in the svga
   * plugin, so remount on re-entry is cheap.
   */
  deferFrameAnimation?: boolean
  /**
   * Render the frame as a static still (first SVGA frame, rendered once per
   * unique frame URL and cached) instead of an animated SvgaPlayer instance.
   * For high-count, low-visual-value contexts like chat messages. Takes
   * precedence over `animated`.
   */
  staticFrame?: boolean
  /**
   * ImageKit variant width override for surfaces rendered dramatically larger
   * than the shared 256px default (e.g. the profile-header avatar). Leave
   * unset everywhere else so all small surfaces share one cached variant.
   */
  imgWidth?: number
}>(), {
  frameName: '',
  frameAssetUrl: undefined,
  img: undefined,
  animated: false,
  deferFrameAnimation: false,
  staticFrame: false,
  imgWidth: undefined,
});

const rootRef = ref<HTMLElement | null>(null)

const { isVisible: svgaAllowed } = useDeferredVisibility(rootRef, () => props.deferFrameAnimation)

// Track load errors so we can fall back to AVATAR_PLACEHOLDER.
// Reset on every src change so a seat user-swap retries the new URL.
const hasImgError = ref(false)
watch(() => props.img, () => { hasImgError.value = false })

const resolvedImgSrc = computed(() => {
  if (hasImgError.value) return avatarImageSrc(ASSETS.AVATAR_PLACEHOLDER)  // occupied + failed → person silhouette
  return avatarImageSrc(props.img ?? ASSETS.DEFAULT_SEAT_IMG, props.imgWidth ? { w: props.imgWidth } : undefined) // no img → red chair (empty seat)
})

function onImgError() { hasImgError.value = true }

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

const staticFrameUrl = computed(() => (props.staticFrame ? frameConfig.value?.name : undefined))
const { stillUrl } = useAvatarStillFrame(staticFrameUrl)
</script>

<template>
  <div ref="rootRef" class="relative aspect-square cursor-pointer">
    <div class="relative" :style="{ padding: frameConfig?.padding ?? DEFAULT_PADDING }">
      <img
        class="aspect-square rounded-full object-contain w-full"
        :src="resolvedImgSrc"
        alt="avatar"
        referrerpolicy="no-referrer"
        loading="lazy"
        decoding="async"
        @error="onImgError"
      >
      <!-- Frame layer (on top): static still (chat) or animated SvgaPlayer (seats) -->
      <!-- w-full h-auto mirrors SvgaPlayer's canvas sizing (width 100%, height auto)
           so the still occupies the identical box; without it the data-URL image
           renders at its natural SVGA viewBox size and overflows small avatars. -->
      <img
        v-if="props.staticFrame && frameConfig?.name && stillUrl"
        class="absolute w-full h-auto"
        :src="stillUrl"
        :style="frameConfig.style"
        alt=""
      >
      <SvgaPlayer
        v-else-if="props.animated && !props.staticFrame && frameConfig?.name && svgaAllowed"
        class="absolute" height="auto"
        :name="frameConfig.name"
        :style="frameConfig.style"
      />
    </div>
  </div>
</template>

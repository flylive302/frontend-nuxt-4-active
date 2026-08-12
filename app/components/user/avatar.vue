<script setup lang="ts">
import type { FrameDisplayConfig } from '~/types/user/bootstrap'
import { ASSETS } from '~/constants/assets'
import { DEFAULT_FRAME_DISPLAY, NO_FRAME_PADDING } from '~/constants/frame'

// ========================================
// Props
// ========================================

const props = withDefaults(defineProps<{
  /**
   * Preferred API: the equipped frame prop's ID. Resolves both the SVGA URL
   * and its authored geometry (scale / padding / offsets) in one step, so no
   * call site has to remember to thread display config through separately.
   */
  frameId?: number | null
  /**
   * Explicit SVGA URL, for surfaces that render a frame they haven't equipped
   * (mall and VIP previews). Overrides whatever `frameId` resolves to.
   */
  frameAssetUrl?: string
  /** Explicit geometry override. Wins over the prop's authored config. */
  frameDisplay?: FrameDisplayConfig
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
  frameId: undefined,
  frameAssetUrl: undefined,
  frameDisplay: undefined,
  img: undefined,
  animated: false,
  deferFrameAnimation: false,
  staticFrame: false,
  imgWidth: undefined,
});

// ========================================
// State
// ========================================

const rootRef = ref<HTMLElement | null>(null)

// Track load errors so we can fall back to AVATAR_PLACEHOLDER.
// Reset on every src change so a seat user-swap retries the new URL.
const hasImgError = ref(false)
watch(() => props.img, () => { hasImgError.value = false })

// ========================================
// Composables
// ========================================

const { isVisible: svgaAllowed } = useDeferredVisibility(rootRef, () => props.deferFrameAnimation)
const { resolveFrameConfig } = usePropLookup()

// ========================================
// Computed
// ========================================

const resolvedImgSrc = computed(() => {
  if (hasImgError.value) return avatarImageSrc(ASSETS.AVATAR_PLACEHOLDER)  // occupied + failed → person silhouette
  return avatarImageSrc(props.img ?? ASSETS.DEFAULT_SEAT_IMG, props.imgWidth ? { w: props.imgWidth } : undefined) // no img → red chair (empty seat)
})

/**
 * Resolve the frame's SVGA URL and its overlay geometry.
 *
 * Precedence: explicit props win over whatever `frameId` resolves to, so a
 * preview surface can pin an asset or hand-tune positioning without the
 * catalog's authored values leaking in.
 */
const frameConfig = computed(() => {
  const resolved = resolveFrameConfig(props.frameId)
  const assetUrl = props.frameAssetUrl ?? resolved?.assetUrl

  if (!assetUrl) return null

  const display = props.frameDisplay ?? resolved?.display ?? DEFAULT_FRAME_DISPLAY

  return {
    name: assetUrl,
    padding: `${display.padding}%`,
    style: {
      transform: `scale(${display.scale / 100})`,
      top: display.top,
      left: display.left,
    },
  }
})

const staticFrameUrl = computed(() => (props.staticFrame ? frameConfig.value?.name : undefined))
const { stillUrl } = useAvatarStillFrame(staticFrameUrl)

// ========================================
// Handlers
// ========================================

function onImgError() { hasImgError.value = true }
</script>

<template>
  <div ref="rootRef" class="relative aspect-square cursor-pointer">
    <div class="relative" :style="{ padding: frameConfig?.padding ?? NO_FRAME_PADDING }">
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

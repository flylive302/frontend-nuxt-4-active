<script setup lang="ts">
import type { FrameDisplayConfig } from '~/types/user/bootstrap'
import { ASSETS } from '~/constants/assets'
import {
  DEFAULT_FRAME_DISPLAY,
  FRAME_TEXT_COLOR,
  FRAME_TEXT_FONT_FAMILY,
  FRAME_TEXT_FONT_WEIGHT,
  FRAME_TEXT_LINE_HEIGHT,
  FRAME_TEXT_MAX_FONT_SIZE,
  FRAME_TEXT_MAX_LINES,
  FRAME_TEXT_MIN_FONT_SIZE,
  FRAME_TEXT_PADDING_X,
  NO_FRAME_PADDING,
} from '~/constants/frame'
import { renderSvgaTextCanvas } from '~/utils/svga-text-canvas'

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
  /**
   * Display name of the avatar's owner. Only needed for frames whose SVGA
   * carries a `username` text slot — pass it wherever such a frame can appear;
   * frames without text ignore it entirely.
   */
  userName?: string | null
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
  userName: undefined,
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
    texts: display.texts ?? [],
    style: {
      transform: `scale(${display.scale / 100})`,
      top: display.top,
      left: display.left,
    },
  }
})

/**
 * Render the frame's text slots to canvases for SvgaPlayer's `dynamicElements`.
 *
 * A frame's only runtime variable is the wearer's name, which the client
 * already holds — so unlike slides there is no server-resolved payload here.
 * A `username` slot with no `userName` passed resolves to nothing and is
 * skipped, leaving the baked artwork visible rather than a blank box.
 *
 * Undefined when the frame declares no text, so the common case allocates
 * nothing and SvgaPlayer's prop stays unset.
 */
const frameTextElements = computed<
  Record<string, (width: number, height: number) => HTMLCanvasElement | null> | undefined
>(() => {
  const specs = frameConfig.value?.texts
  if (!specs?.length || !import.meta.client) return undefined

  const out: Record<string, (width: number, height: number) => HTMLCanvasElement | null> = {}

  for (const spec of specs) {
    const text = spec.source === 'static' ? spec.value : props.userName
    if (!text) continue

    // Sized to the SVGA slot by default. The lib draws dynamic elements
    // unscaled, so a mismatched canvas is clipped away entirely — the explicit
    // width/height overrides exist only for artwork whose baked slot is the
    // wrong shape for its visible banner.
    out[spec.key] = (slotWidth, slotHeight) => {
      const width = spec.width ?? slotWidth
      const height = spec.height ?? slotHeight

      return renderSvgaTextCanvas(text, {
        width,
        height,
        color: spec.color ?? FRAME_TEXT_COLOR,
        fontFamily: FRAME_TEXT_FONT_FAMILY,
        fontWeight: FRAME_TEXT_FONT_WEIGHT,
        // Frame banners are short strips; the fitter only checks width on the
        // single-line path, so cap by the slot height too or tall glyphs clip.
        maxFontSize: Math.max(
          FRAME_TEXT_MIN_FONT_SIZE,
          Math.min(FRAME_TEXT_MAX_FONT_SIZE, Math.floor(height * 0.75)),
        ),
        minFontSize: FRAME_TEXT_MIN_FONT_SIZE,
        maxLines: FRAME_TEXT_MAX_LINES,
        lineHeight: FRAME_TEXT_LINE_HEIGHT,
        paddingX: FRAME_TEXT_PADDING_X,
      })
    }
  }

  return Object.keys(out).length ? out : undefined
})

/**
 * Identity of the currently-resolved text, used to force a SvgaPlayer remount.
 *
 * `useSvgaPlayer` reads `dynamicElements` once when the player loads and only
 * watches `name`/`loop`/`autoplay` — so canvases that appear later (the prop
 * index resolves asynchronously, or the seat swaps user) would never reach it.
 * Re-keying rebuilds the player with the current canvases.
 *
 * Empty for the overwhelming majority of frames, which declare no text, so the
 * key is constant there and nothing ever remounts.
 */
const frameTextSignature = computed(() => {
  const specs = frameConfig.value?.texts
  if (!specs?.length) return ''

  return specs
    .map(spec => `${spec.key}=${spec.source === 'static' ? spec.value : props.userName ?? ''}`)
    .join('|')
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
      <!-- The still is pre-rendered per frame URL and cached across users, so it
           cannot carry per-user text; text frames only animate. -->
      <img
        v-if="props.staticFrame && frameConfig?.name && stillUrl"
        class="absolute w-full h-auto"
        :src="stillUrl"
        :style="frameConfig.style"
        alt=""
      >
      <SvgaPlayer
        v-else-if="props.animated && !props.staticFrame && frameConfig?.name && svgaAllowed"
        :key="frameTextSignature"
        class="absolute" height="auto"
        :name="frameConfig.name"
        :style="frameConfig.style"
        :dynamic-element-factories="frameTextElements"
      />
    </div>
  </div>
</template>

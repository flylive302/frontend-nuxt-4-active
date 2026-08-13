<script setup lang="ts">
/**
 * One active slide overlay (INTENT). Builds the SVGA dynamic elements —
 * canvases from `texts`, images loaded from `replaceElements` URLs — then
 * renders a single SvgaPlayer. Self-removes via @complete. Pass-through unless
 * the slide is clickable, in which case it captures pointer events for the link.
 */
import type { ActiveSlide } from '~/types/slide'
import {
  SLIDE_TEXT_CANVAS_WIDTH,
  SLIDE_TEXT_CANVAS_HEIGHT,
  SLIDE_TEXT_FONT_FAMILY,
  SLIDE_TEXT_FONT_WEIGHT,
  SLIDE_TEXT_MAX_FONT_SIZE,
  SLIDE_TEXT_MIN_FONT_SIZE,
  SLIDE_TEXT_MAX_LINES,
  SLIDE_TEXT_LINE_HEIGHT,
  SLIDE_TEXT_PADDING_X,
} from '~/constants/slide'
import { buildSvgaTextCanvases } from '~/utils/svga-text-canvas'

const props = defineProps<{ slide: ActiveSlide }>()
const emit = defineEmits<{ complete: []; click: [] }>()

const images = ref<Record<string, HTMLImageElement>>({})
const textElements = shallowRef<Record<string, HTMLCanvasElement> | undefined>()
const ready = ref(false)

const clickable = computed(() => props.slide.link.type !== 'none')

// Render `texts` to canvases (dynamicElements). Canvas dimensions must match the
// placeholder layer dimensions baked into the .svga file by the designer, so
// long text is fitted (shrink, then wrap) inside the fixed box instead.
function buildTextElements(): Record<string, HTMLCanvasElement> | undefined {
  return buildSvgaTextCanvases(props.slide.texts ?? {}, {
    width: SLIDE_TEXT_CANVAS_WIDTH,
    height: SLIDE_TEXT_CANVAS_HEIGHT,
    color: '#ffffff',
    fontFamily: SLIDE_TEXT_FONT_FAMILY,
    fontWeight: SLIDE_TEXT_FONT_WEIGHT,
    maxFontSize: SLIDE_TEXT_MAX_FONT_SIZE,
    minFontSize: SLIDE_TEXT_MIN_FONT_SIZE,
    maxLines: SLIDE_TEXT_MAX_LINES,
    lineHeight: SLIDE_TEXT_LINE_HEIGHT,
    paddingX: SLIDE_TEXT_PADDING_X,
  })
}

// Load each replaceElements URL into an HTMLImageElement. A broken image is
// skipped (safe fallback) rather than blocking the whole slide.
async function loadImages(): Promise<void> {
  const entries = Object.entries(props.slide.replaceElements ?? {})
  const loaded: Record<string, HTMLImageElement> = {}

  await Promise.all(
    entries.map(([key, url]) =>
      new Promise<void>((resolve) => {
        if (!url) return resolve()
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          loaded[key] = img
          resolve()
        }
        img.onerror = () => resolve()
        img.src = url
      }),
    ),
  )

  images.value = loaded
}

onMounted(async () => {
  textElements.value = buildTextElements()
  await loadImages()
  ready.value = true
})
</script>

<template>
  <div
    class="slide-overlay-item"
    :class="{ 'is-clickable': clickable }"
    @click="clickable && emit('click')"
  >
    <SvgaPlayer
      v-if="ready"
      :name="slide.svgaUrl"
      :loop="1"
      :motion-pause="false"
      :replace-elements="images"
      :dynamic-elements="textElements"
      :width="`${slide.height}px`"
      class="w-auto"
      @complete="emit('complete')"
    />
  </div>
</template>

<style scoped>
.slide-overlay-item {
  width: 100%;
  height: auto;
  pointer-events: none;
}

.is-clickable {
  pointer-events: auto;
  cursor: pointer;
}
</style>

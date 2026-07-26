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
import { fitSlideText } from '~/utils/slide-text-fit'

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
  const out: Record<string, HTMLCanvasElement> = {}
  for (const [key, text] of Object.entries(props.slide.texts ?? {})) {
    if (!text) continue
    const c = document.createElement('canvas')
    c.width = SLIDE_TEXT_CANVAS_WIDTH
    c.height = SLIDE_TEXT_CANVAS_HEIGHT
    const ctx = c.getContext('2d')
    if (!ctx) continue

    const fit = fitSlideText(
      text,
      {
        maxWidth: c.width - SLIDE_TEXT_PADDING_X * 2,
        maxHeight: c.height,
        maxFontSize: SLIDE_TEXT_MAX_FONT_SIZE,
        minFontSize: SLIDE_TEXT_MIN_FONT_SIZE,
        maxLines: SLIDE_TEXT_MAX_LINES,
        lineHeight: SLIDE_TEXT_LINE_HEIGHT,
      },
      (t, size) => {
        ctx.font = slideFont(size)
        return ctx.measureText(t).width
      },
    )

    ctx.font = slideFont(fit.fontSize)
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const lineStep = fit.fontSize * SLIDE_TEXT_LINE_HEIGHT
    const firstY = c.height / 2 - ((fit.lines.length - 1) * lineStep) / 2
    fit.lines.forEach((line, i) => {
      ctx.fillText(line, c.width / 2, firstY + i * lineStep)
    })
    out[key] = c
  }
  return Object.keys(out).length ? out : undefined
}

function slideFont(size: number): string {
  return `${SLIDE_TEXT_FONT_WEIGHT} ${size}px ${SLIDE_TEXT_FONT_FAMILY}`
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
      :height="`${slide.height}px`"
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

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
  SLIDE_TEXT_FONT,
} from '~/constants/slide'

const props = defineProps<{ slide: ActiveSlide }>()
const emit = defineEmits<{ complete: []; click: [] }>()

const images = ref<Record<string, HTMLImageElement>>({})
const textElements = shallowRef<Record<string, HTMLCanvasElement> | undefined>()
const ready = ref(false)

const clickable = computed(() => props.slide.link.type !== 'none')

// Render `texts` to canvases (dynamicElements). Canvas dimensions must match the
// placeholder layer dimensions baked into the .svga file by the designer.
function buildTextElements(): Record<string, HTMLCanvasElement> | undefined {
  const out: Record<string, HTMLCanvasElement> = {}
  for (const [key, text] of Object.entries(props.slide.texts ?? {})) {
    if (!text) continue
    const c = document.createElement('canvas')
    c.width = SLIDE_TEXT_CANVAS_WIDTH
    c.height = SLIDE_TEXT_CANVAS_HEIGHT
    const ctx = c.getContext('2d')
    if (!ctx) continue
    ctx.font = SLIDE_TEXT_FONT
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, c.width / 2, c.height / 2)
    out[key] = c
  }
  return Object.keys(out).length ? out : undefined
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
      :replace-elements="images"
      :dynamic-elements="textElements"
      :height="`${slide.height}px`"
      width="auto"
      @complete="emit('complete')"
    />
  </div>
</template>

<style scoped>
.slide-overlay-item {
  width: min(90vw, 480px);
  height: auto;
  pointer-events: none;
}

.is-clickable {
  pointer-events: auto;
  cursor: pointer;
}
</style>

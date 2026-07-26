<script setup lang="ts">
/**
 * One cashback win animation (INTENT). Picks the authored .svga for the
 * multiplier's prize tier and draws the fixed label + coins-won amount into its
 * two text placeholders, then renders a single SvgaPlayer. Renders nothing for
 * a ×0 bust — a losing draw has no animation at all.
 */
import {
  LUCKY_CASHBACK_LABEL_KEY,
  LUCKY_CASHBACK_COINS_KEY,
  LUCKY_CASHBACK_SVGA_HEIGHT_PX,
  LUCKY_CASHBACK_TEXT_CANVAS_WIDTH,
  LUCKY_CASHBACK_TEXT_CANVAS_HEIGHT,
  LUCKY_CASHBACK_TEXT_FONT_FAMILY,
  LUCKY_CASHBACK_TEXT_FONT_WEIGHT,
  LUCKY_CASHBACK_TEXT_COLOR,
  LUCKY_CASHBACK_LABEL_TEXT,
  LUCKY_CASHBACK_LABEL_FONT_SIZE,
  LUCKY_CASHBACK_COINS_FONT_SIZE,
  LUCKY_CASHBACK_COINS_MIN_FONT_SIZE,
  LUCKY_CASHBACK_TEXT_MAX_LINES,
  LUCKY_CASHBACK_TEXT_LINE_HEIGHT,
  LUCKY_CASHBACK_TEXT_PADDING_X,
} from '~/constants/lucky'
import { resolveCashbackSvgaUrl } from '~/utils/lucky-cashback'
import { fitSlideText } from '~/utils/slide-text-fit'

const props = withDefaults(defineProps<{
  multiplier: number
  coinsWon: number
  width?: number
}>(), { width: LUCKY_CASHBACK_SVGA_HEIGHT_PX })

const emit = defineEmits<{ complete: [] }>()

const textElements = shallowRef<Record<string, HTMLCanvasElement> | undefined>()
const ready = ref(false)

const svgaUrl = computed(() => resolveCashbackSvgaUrl(props.multiplier))

/**
 * Draw one value onto a fixed-size canvas matching the SVGA placeholder box.
 * Numbers are drawn raw (no abbreviation) so the coin amount stays exact.
 */
function buildTextCanvas(
  value: string | number,
  fontSize: number,
  minFontSize: number = fontSize,
): HTMLCanvasElement | null {
  const text = typeof value === 'number' ? String(value) : value
  const canvas = document.createElement('canvas')
  canvas.width = LUCKY_CASHBACK_TEXT_CANVAS_WIDTH
  canvas.height = LUCKY_CASHBACK_TEXT_CANVAS_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const fit = fitSlideText(
    text,
    {
      maxWidth: canvas.width - LUCKY_CASHBACK_TEXT_PADDING_X * 2,
      maxHeight: canvas.height,
      maxFontSize: fontSize,
      minFontSize,
      maxLines: LUCKY_CASHBACK_TEXT_MAX_LINES,
      lineHeight: LUCKY_CASHBACK_TEXT_LINE_HEIGHT,
    },
    (t, size) => {
      ctx.font = cashbackFont(size)
      return ctx.measureText(t).width
    },
  )

  ctx.font = cashbackFont(fit.fontSize)
  ctx.fillStyle = LUCKY_CASHBACK_TEXT_COLOR
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const lineStep = fit.fontSize * LUCKY_CASHBACK_TEXT_LINE_HEIGHT
  const firstY = canvas.height / 2 - ((fit.lines.length - 1) * lineStep) / 2
  fit.lines.forEach((line, i) => {
    ctx.fillText(line, canvas.width / 2, firstY + i * lineStep)
  })

  return canvas
}

function cashbackFont(size: number): string {
  return `${LUCKY_CASHBACK_TEXT_FONT_WEIGHT} ${size}px ${LUCKY_CASHBACK_TEXT_FONT_FAMILY}`
}

function buildTextElements(): Record<string, HTMLCanvasElement> | undefined {
  const out: Record<string, HTMLCanvasElement> = {}

  // Static label — fixed size (min == max), so it is never re-fitted.
  const labelCanvas = buildTextCanvas(LUCKY_CASHBACK_LABEL_TEXT, LUCKY_CASHBACK_LABEL_FONT_SIZE)
  if (labelCanvas) out[LUCKY_CASHBACK_LABEL_KEY] = labelCanvas

  // Variable-length amount — shrinks from MAX toward MIN until it fits.
  const coinsCanvas = buildTextCanvas(
    props.coinsWon,
    LUCKY_CASHBACK_COINS_FONT_SIZE,
    LUCKY_CASHBACK_COINS_MIN_FONT_SIZE,
  )
  if (coinsCanvas) out[LUCKY_CASHBACK_COINS_KEY] = coinsCanvas

  return Object.keys(out).length ? out : undefined
}

onMounted(() => {
  if (!svgaUrl.value) return
  textElements.value = buildTextElements()
  ready.value = true
})
</script>

<template>
  <SvgaPlayer
    v-if="ready && svgaUrl"
    :name="svgaUrl"
    :loop="1"
    :motion-pause="false"
    :dynamic-elements="textElements"
    :width="`${width}px`"
    class="h-auto pointer-events-none"
    @complete="emit('complete')"
  />
</template>

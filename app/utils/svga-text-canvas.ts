// Renders a string onto an offscreen canvas sized to an SVGA text placeholder.
//
// SVGA files bake a fixed-size layer for each text slot, so the canvas
// dimensions are dictated by the artwork, not the content — text is auto-fitted
// (shrink, then wrap, then ellipsize) inside that box by `fitSlideText`.
//
// Shared by the slide overlay and by avatar frames; both inject the resulting
// canvases through SvgaPlayer's `dynamicElements` prop.

import { fitSlideText } from '~/utils/slide-text-fit'

export interface SvgaTextCanvasOptions {
  width: number
  height: number
  color: string
  fontFamily: string
  fontWeight: string
  maxFontSize: number
  minFontSize: number
  maxLines: number
  /** Line height as a multiplier of font size. */
  lineHeight: number
  paddingX: number
}

/**
 * Draw `text` centred on a canvas of the requested size.
 * Returns null for blank text or when a 2D context can't be acquired.
 */
export function renderSvgaTextCanvas(
  text: string,
  options: SvgaTextCanvasOptions,
): HTMLCanvasElement | null {
  if (!text) return null

  const canvas = document.createElement('canvas')
  canvas.width = options.width
  canvas.height = options.height

  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const font = (size: number): string => `${options.fontWeight} ${size}px ${options.fontFamily}`

  const fit = fitSlideText(
    text,
    {
      maxWidth: canvas.width - options.paddingX * 2,
      maxHeight: canvas.height,
      maxFontSize: options.maxFontSize,
      minFontSize: options.minFontSize,
      maxLines: options.maxLines,
      lineHeight: options.lineHeight,
    },
    (t, size) => {
      ctx.font = font(size)
      return ctx.measureText(t).width
    },
  )

  ctx.font = font(fit.fontSize)
  ctx.fillStyle = options.color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const lineStep = fit.fontSize * options.lineHeight
  const firstY = canvas.height / 2 - ((fit.lines.length - 1) * lineStep) / 2

  fit.lines.forEach((line, i) => {
    ctx.fillText(line, canvas.width / 2, firstY + i * lineStep)
  })

  return canvas
}

/**
 * Render a map of `svgaKey -> text` into canvases, skipping blank entries.
 * Returns undefined when nothing was rendered, so callers can bind straight to
 * SvgaPlayer's optional `dynamicElements` prop.
 */
export function buildSvgaTextCanvases(
  texts: Record<string, string | null | undefined>,
  options: SvgaTextCanvasOptions,
): Record<string, HTMLCanvasElement> | undefined {
  const out: Record<string, HTMLCanvasElement> = {}

  for (const [key, text] of Object.entries(texts)) {
    if (!text) continue
    const canvas = renderSvgaTextCanvas(text, options)
    if (canvas) out[key] = canvas
  }

  return Object.keys(out).length ? out : undefined
}

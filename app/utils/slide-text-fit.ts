// Pure fit/wrap algorithm for slide overlay text canvases. Given a text
// measurer (injected so the logic stays canvas-free and testable), picks the
// largest font size that fits the box: single line preferred, then wrapped
// onto up to `maxLines`, then ellipsized at the minimum size as a last resort.

export interface SlideTextFitOptions {
  maxWidth: number
  maxHeight: number
  maxFontSize: number
  minFontSize: number
  maxLines: number
  /** Line height as a multiplier of font size. */
  lineHeight: number
}

export interface SlideTextFit {
  fontSize: number
  lines: string[]
}

/** Returns the pixel width of `text` rendered at `fontSize`. */
export type TextMeasurer = (text: string, fontSize: number) => number

const ELLIPSIS = '…'

export function fitSlideText(
  text: string,
  options: SlideTextFitOptions,
  measure: TextMeasurer,
): SlideTextFit {
  const trimmed = text.trim().replace(/\s+/g, ' ')
  if (!trimmed) return { fontSize: options.maxFontSize, lines: [] }

  // Largest size where the whole text fits on a single line.
  for (let size = options.maxFontSize; size >= options.minFontSize; size--) {
    if (measure(trimmed, size) <= options.maxWidth) {
      return { fontSize: size, lines: [trimmed] }
    }
  }

  // Largest size where a greedy wrap fits within maxLines and maxHeight.
  for (let size = options.maxFontSize; size >= options.minFontSize; size--) {
    if (size * options.lineHeight * options.maxLines > options.maxHeight) continue
    const lines = wrapGreedy(trimmed, size, options.maxWidth, measure)
    if (
      lines.length <= options.maxLines &&
      lines.every((line) => measure(line, size) <= options.maxWidth)
    ) {
      return { fontSize: size, lines }
    }
  }

  // Nothing fits: wrap at the minimum size, keep maxLines, ellipsize the last.
  const size = options.minFontSize
  const wrapped = wrapGreedy(trimmed, size, options.maxWidth, measure)
  const lines = wrapped.slice(0, options.maxLines)
  const last = lines.length - 1
  if (last >= 0 && wrapped.length > lines.length) {
    lines[last] = ellipsize(lines[last]! + ELLIPSIS, size, options.maxWidth, measure)
  }
  return { fontSize: size, lines }
}

// Greedy word wrap; a single word wider than maxWidth is broken by characters
// (covers no-space scripts and long usernames).
function wrapGreedy(
  text: string,
  fontSize: number,
  maxWidth: number,
  measure: TextMeasurer,
): string[] {
  const lines: string[] = []
  let current = ''

  for (const word of text.split(' ')) {
    const candidate = current ? `${current} ${word}` : word
    if (measure(candidate, fontSize) <= maxWidth) {
      current = candidate
      continue
    }
    if (current) lines.push(current)
    if (measure(word, fontSize) <= maxWidth) {
      current = word
    } else {
      const broken = breakByChars(word, fontSize, maxWidth, measure)
      lines.push(...broken.slice(0, -1))
      current = broken[broken.length - 1] ?? ''
    }
  }

  if (current) lines.push(current)
  return lines
}

function breakByChars(
  word: string,
  fontSize: number,
  maxWidth: number,
  measure: TextMeasurer,
): string[] {
  const lines: string[] = []
  let current = ''
  for (const char of word) {
    const candidate = current + char
    if (current && measure(candidate, fontSize) > maxWidth) {
      lines.push(current)
      current = char
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)
  return lines
}

function ellipsize(
  line: string,
  fontSize: number,
  maxWidth: number,
  measure: TextMeasurer,
): string {
  if (measure(line, fontSize) <= maxWidth) return line
  let kept = line
  while (kept.length > 1 && measure(kept + ELLIPSIS, fontSize) > maxWidth) {
    kept = kept.slice(0, -1).trimEnd()
  }
  return kept + ELLIPSIS
}

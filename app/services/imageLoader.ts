// ========================================
// Image Loader Service
// ========================================
// Services = Low-level infra. No store imports, no Vue reactivity.
//
// Loads a `{ key: url }` map into decoded HTMLImageElements for SVGA image
// placeholders (SvgaPlayer `replaceElements`). Lifted out of
// slide/OverlayItem.vue so every SvgaPlayer consumer shares one loader.

/**
 * Load each URL into an HTMLImageElement. Empty URLs and broken images are
 * omitted (safe fallback — the baked SVGA layer shows through) rather than
 * failing the whole map.
 */
export async function loadImageMap(
  urls: Record<string, string | null | undefined>,
): Promise<Record<string, HTMLImageElement>> {
  const loaded: Record<string, HTMLImageElement> = {}

  await Promise.all(
    Object.entries(urls).map(async ([key, url]) => {
      const img = url ? await loadImage(url) : null
      if (img) loaded[key] = img
    }),
  )

  return loaded
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

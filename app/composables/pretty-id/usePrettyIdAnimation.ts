// ========================================
// Pretty ID — looping event animation source
// ========================================
//
// Resolves a Pretty ID .svga constant into what <SvgaPlayer> can load, and
// reports when it has parsed so a poster underneath can be faded out.
//
// Two things the shared player does not do on its own:
//
// 1. The assets are root-relative while bundled (constants/assets.ts,
//    `PID_SVGA`). The svga parser fetches from a blob-URL worker, where a
//    relative URL cannot be resolved — so the path is made absolute here. An
//    absolute http(s) URL also takes the read-through Cache Storage path
//    (services/svgaAssetCache), same as every R2-hosted animation.
// 2. <SvgaPlayer> has no "ready" emit. `$svga.fetchAnimation` is the SAME
//    cached promise the player awaits, so awaiting it here costs nothing and
//    resolves at the moment the first frame can be drawn.

import type { MaybeRefOrGetter } from 'vue'
import type { SvgaPlugin } from '~/types/asset/svga'
import { normalizeAssetUrl } from '~/utils/asset-url'
import { createLogger } from '~/utils/logger'

const log = createLogger('[PrettyIdAnimation]')

export function usePrettyIdAnimation(src: MaybeRefOrGetter<string>) {
  const svga = useNuxtApp().$svga as SvgaPlugin

  const url = computed(() => normalizeAssetUrl(toValue(src)))
  const isReady = ref(false)

  watch(
    url,
    async (next) => {
      isReady.value = false
      try {
        await svga.fetchAnimation(next)
        // A newer source may have replaced this one while it was parsing.
        if (url.value === next) isReady.value = true
      } catch (error) {
        log.warn('Animation failed to load — the poster stays up', error)
      }
    },
    { immediate: true },
  )

  return { url, isReady: readonly(isReady) }
}

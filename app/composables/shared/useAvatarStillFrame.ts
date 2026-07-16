/**
 * useAvatarStillFrame
 *
 * Reactive bridge between `UserAvatar`'s `staticFrame` mode and the
 * `svgaStillFrame` service: resolves the SVGA plugin handle from
 * `useNuxtApp()` (services must not import Nuxt runtime themselves — see
 * `services/giftAssetCache.ts`'s `SvgaPlugin` pattern) and re-renders the
 * still whenever the frame URL changes.
 */
import { ref, watch, type Ref } from 'vue'
import { getSvgaStillFrame, type SvgaStillPlugin } from '~/services/svgaStillFrame'
import { createLogger } from '~/utils/logger'

const log = createLogger('[useAvatarStillFrame]')

export interface UseAvatarStillFrame {
  /** Data-URL still of the frame's first SVGA frame, or null while loading/unavailable. */
  stillUrl: Ref<string | null>
}

export function useAvatarStillFrame(frameUrl: Ref<string | null | undefined>): UseAvatarStillFrame {
  const stillUrl = ref<string | null>(null)
  const nuxtApp = useNuxtApp() as unknown as { $svga?: SvgaStillPlugin }

  watch(
    frameUrl,
    async (url) => {
      stillUrl.value = null
      if (!url || !nuxtApp.$svga) return

      try {
        const rendered = await getSvgaStillFrame(url, nuxtApp.$svga)
        // Guard against a stale response landing after `frameUrl` moved on.
        if (frameUrl.value === url) stillUrl.value = rendered
      } catch (error) {
        log.warn('Failed to resolve avatar still frame', url, error)
      }
    },
    { immediate: true },
  )

  return { stillUrl }
}

/**
 * useAvatarStillFrame
 *
 * Reactive bridge between `UserAvatar`'s `staticFrame` mode and the
 * `svgaStillFrame` service: resolves the SVGA plugin handle from
 * `useNuxtApp()` (services must not import Nuxt runtime themselves — see
 * `services/giftAssetCache.ts`'s `SvgaPlugin` pattern) and re-renders the
 * still whenever the frame URL changes to a DIFFERENT frame.
 *
 * Never blanks a still it already holds for the same frame: a seat flipping
 * animated → still (budget/tier, android-client-performance/16) briefly
 * re-requests the same URL, and clearing it first flashed an empty frame.
 * The caller hides the still while it is not in static mode, so a retained
 * value is never shown out of turn. A different URL still clears first — one
 * user must never wear another's frame, even for a tick.
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
  /** Frame URL the current `stillUrl` was rendered for. */
  let renderedFor: string | null = null
  const nuxtApp = useNuxtApp() as unknown as { $svga?: SvgaStillPlugin }

  watch(
    frameUrl,
    async (url) => {
      // No frame / static mode off: keep the last still for a cheap, flash-free
      // return to the same frame. The template gates display on static mode.
      if (!url) return
      if (url === renderedFor && stillUrl.value) return

      stillUrl.value = null
      renderedFor = null
      if (!nuxtApp.$svga) return

      try {
        const rendered = await getSvgaStillFrame(url, nuxtApp.$svga)
        // Guard against a stale response landing after `frameUrl` moved on.
        if (frameUrl.value === url) {
          stillUrl.value = rendered
          renderedFor = rendered ? url : null
        }
      } catch (error) {
        log.warn('Failed to resolve avatar still frame', url, error)
      }
    },
    { immediate: true },
  )

  return { stillUrl }
}

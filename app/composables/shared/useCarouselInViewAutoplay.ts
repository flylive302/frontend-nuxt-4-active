import { useIntersectionObserver } from '@vueuse/core'
import type { MaybeElement } from '@vueuse/core'
import type { Ref } from 'vue'
import { nextAutoplayAction } from '~/utils/carousel-autoplay'

/** The slice of Embla's autoplay plugin this composable touches. */
interface AutoplayLike {
  play: () => void
  stop: () => void
  isPlaying: () => boolean
}

/** The slice of the Embla instance the home page and this composable use. */
export interface EmblaApiLike {
  plugins: () => { autoplay?: AutoplayLike }
  selectedScrollSnap: () => number
}

/** What `UCarousel` exposes — `emblaApi` is a ref to the Embla instance. */
export interface CarouselExposeLike {
  emblaApi?: Ref<EmblaApiLike | undefined> | undefined
}

/**
 * Pause a `UCarousel`'s autoplay while `targetRef` is off-screen and resume it
 * on re-entry (home-page-runtime-audit/1, reused by step 5 for the banners).
 *
 * Drives the plugin's own `play()` / `stop()` instead of toggling the
 * `autoplay` prop. `@nuxt/ui`'s Carousel watches that prop and on any change
 * re-imports every plugin and calls `emblaApi.reInit()` — twice, because
 * `embla-carousel-vue` watches the plugin list too. That is a synchronous
 * re-measure of every slide, fired exactly while the user scrolls past the
 * carousel. Keep the prop stable after first paint; use this for pausing.
 *
 * Swipe rule: a carousel the user stopped by hand stays stopped across
 * scroll-away / scroll-back (`nextAutoplayAction`).
 *
 * Known gap, accepted: if autoplay is enabled while the target is already
 * off-screen (user scrolled away within two frames of paint) it ticks until
 * the next viewport crossing pauses it.
 */
export function useCarouselInViewAutoplay(
  carouselRef: Ref<CarouselExposeLike | null>,
  targetRef: Ref<MaybeElement>,
) {
  const inView = ref(true)
  let resumeOnEnter = false

  useIntersectionObserver(targetRef, ([entry]) => {
    inView.value = entry?.isIntersecting ?? false
  })

  watch(inView, (visible) => {
    const autoplay = unref(carouselRef.value?.emblaApi)?.plugins().autoplay
    if (!autoplay) return
    const decision = nextAutoplayAction(visible, autoplay.isPlaying(), resumeOnEnter)
    resumeOnEnter = decision.resumeOnEnter
    if (decision.action === 'play') autoplay.play()
    else if (decision.action === 'stop') autoplay.stop()
  })

  return { inView }
}

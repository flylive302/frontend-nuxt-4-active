// ========================================
// Room Background Image
// ========================================
//
// Resolves the room page's background `src` in two steps:
//  1. the low-res URL the room card already painted — already cached, so the
//     expanding card lands on a real image rather than an empty box;
//  2. the full-resolution URL, swapped in only once it has decoded off-screen.
//
// Decoding off-screen keeps the swap off the transition's critical path — the
// user just sees the background sharpen.
// ========================================

import type { MaybeRefOrGetter } from 'vue'
import { ASSETS } from '~/constants/assets'
import { ROOM_BACKGROUND_QUALITY, ROOM_BACKGROUND_WIDTH } from '~/constants/room'
import { withImageKitTransform } from '~/utils/imagekit'

export function useRoomBackground(background: MaybeRefOrGetter<string | null | undefined>) {
  const { seedSrc } = useRoomExpandTransition()

  const fullSrc = computed(() =>
    withImageKitTransform(toValue(background) ?? ASSETS.ROOM_BG_PLACEHOLDER, {
      w: ROOM_BACKGROUND_WIDTH,
      q: ROOM_BACKGROUND_QUALITY,
    }),
  )

  const src = ref(seedSrc.value || fullSrc.value)

  /** In-flight decode; kept so a room switch (or unmount) can orphan its callback. */
  let preloader: HTMLImageElement | null = null

  function releasePreloader(): void {
    if (!preloader) return
    preloader.onload = null
    preloader = null
  }

  function upgradeToFullResolution(target: string): void {
    releasePreloader()
    if (!import.meta.client || !target) {
      src.value = target
      return
    }

    const image = new Image()
    preloader = image
    image.decoding = 'async'
    image.onload = () => {
      if (preloader !== image) return
      src.value = target
      releasePreloader()
    }
    image.src = target
  }

  watch(fullSrc, (target) => {
    // A room switch invalidates the seed — fall back to the previous frame until
    // the new full-res image lands rather than flashing an unrelated background.
    upgradeToFullResolution(target)
  }, { immediate: true })

  onScopeDispose(releasePreloader)

  return { src }
}

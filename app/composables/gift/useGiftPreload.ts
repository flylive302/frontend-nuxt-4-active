/**
 * Gift Preload Composable
 *
 * Watches gift selection state and triggers debounced preload
 * for both local asset cache and recipient preparation.
 *
 * Extracted from gift store to keep store free of side-effects (SRP fix).
 * Should be initialized once in the room context (e.g., useRoomGifts or room page).
 */
import { watch, type Ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import type { Gift } from '~/types/gift'

// ========================================
// Module-level Cached Composables
// ========================================

let _giftAssetCache: ReturnType<typeof useGiftAssetCache> | null = null
let _roomAudio: { prepareGift: (giftId: number, recipientIds: number[]) => void } | null = null

/**
 * Initialize gift preload watcher.
 * Debounces selection changes and triggers local cache + recipient preparation.
 *
 * @param selectedGift - Reactive ref to the currently selected gift
 * @param selectedRecipients - Reactive ref to the selected recipient IDs
 */
export function useGiftPreload(
  selectedGift: Ref<Gift | null>,
  selectedRecipients: Ref<number[]>
): void {
  const debouncedPreload = useDebounceFn(
    async (gift: Gift, recipients: number[]) => {
      // Initialize cached composables on first call
      if (!_giftAssetCache) _giftAssetCache = useGiftAssetCache()
      if (!_roomAudio) _roomAudio = useRoomAudio()

      // 1. Preload locally for sender (instant playback)
      await _giftAssetCache.preloadGift(gift)

      // 2. Send prepare signal to recipients
      _roomAudio.prepareGift(gift.id, recipients)
    },
    300
  )

  watch(
    [selectedGift, () => selectedRecipients.value.length],
    ([gift, _count]) => {
      if (!gift || selectedRecipients.value.length === 0) return
      debouncedPreload(gift, selectedRecipients.value)
    }
  )
}

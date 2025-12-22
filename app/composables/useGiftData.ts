/**
 * Gift Data Composable
 *
 * Handles gift data fetching, caching, and category grouping.
 * Currently uses mock data; will integrate with API later.
 */
import { ref, computed } from 'vue';
import type { Gift, GiftCategory, GiftCategoryGroup } from '~/types/gift';
import { GIFT_CATEGORY_CONFIG } from '~/types/gift';
import { MOCK_GIFTS } from '~/mock/gifts';

// Shared state across all component instances
const gifts = ref<Gift[]>([]);
const isLoading = ref(false);
const isInitialized = ref(false);

export function useGiftData() {
  // ========================================
  // Computed: Category Groups
  // ========================================

  /**
   * Group gifts by category for tab display
   */
  const giftsByCategory = computed<GiftCategoryGroup[]>(() => {
    const categories = Object.keys(GIFT_CATEGORY_CONFIG) as GiftCategory[];

    return categories
      .map((category) => {
        const config = GIFT_CATEGORY_CONFIG[category];
        const categoryGifts = gifts.value
          .filter((g) => g.category === category && g.is_available)
          .sort((a, b) => a.sort_order - b.sort_order);

        return {
          category,
          label: config.label,
          icon: config.icon,
          gifts: categoryGifts,
        };
      })
      .filter((group) => group.gifts.length > 0); // Only show categories with gifts
  });

  // ========================================
  // Methods
  // ========================================

  /**
   * Get a gift by ID
   */
  function getGiftById(id: number): Gift | undefined {
    return gifts.value.find((g) => g.id === id);
  }

  /**
   * Fetch gifts from API (currently uses mock data)
   */
  async function fetchGifts(): Promise<void> {
    if (isLoading.value) return;

    isLoading.value = true;

    try {
      // TODO: Replace with actual API call
      // const response = await useApi().get<Gift[]>('/gifts');
      // gifts.value = response;

      // Using mock data for now
      await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate network delay
      gifts.value = MOCK_GIFTS;
      isInitialized.value = true;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Initialize gift data if not already loaded
   */
  async function ensureLoaded(): Promise<void> {
    if (!isInitialized.value) {
      await fetchGifts();
    }
  }

  /**
   * Format gift price for display
   */
  function formatGiftPrice(gift: Gift): string {
    if (gift.price_diamonds) {
      return `💎 ${gift.price_diamonds.toLocaleString()}`;
    }
    return `🪙 ${gift.price_coins.toLocaleString()}`;
  }

  // ========================================
  // Return
  // ========================================
  return {
    gifts,
    giftsByCategory,
    isLoading,
    isInitialized,
    getGiftById,
    fetchGifts,
    ensureLoaded,
    formatGiftPrice,
  };
}

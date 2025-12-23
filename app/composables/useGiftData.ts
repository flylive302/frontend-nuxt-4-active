/**
 * Gift Data Composable
 *
 * Handles gift data fetching, caching, and category grouping.
 * Uses backend API: GET /api/v1/gifts/all
 * Falls back to mock data if API is unavailable.
 */
import { ref, computed } from 'vue';
import type { Gift, GiftCategory, GiftCategoryGroup } from '~/types/gift';
import { GIFT_CATEGORY_CONFIG } from '~/types/gift';
import { useApi } from './useApi';
import { MOCK_GIFTS } from '~/mock/gifts';

// ============================================
// API Response Types
// ============================================

interface AllGiftsApiResponse {
  status: 'success' | 'error';
  message: string;
  data: {
    gifts: Gift[];
    total: number;
  };
  meta: {
    timestamp: string;
    correlation_id: string;
  };
}

// ============================================
// Shared State (across all component instances)
// ============================================

const gifts = ref<Gift[]>([]);
const isLoading = ref(false);
const isInitialized = ref(false);

export function useGiftData() {
  // ========================================
  // Dependencies
  // ========================================
  const { api } = useApi();

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
          .filter((g) => g.category === category)
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
   * Fetch gifts from API (falls back to mock data if unavailable)
   */
  async function fetchGifts(): Promise<void> {
    if (isLoading.value) return;

    isLoading.value = true;

    try {
      const response = await api<AllGiftsApiResponse>('/gifts/all');
      gifts.value = response.data.gifts;
    } catch (error) {
      // Fallback to mock data when API is unavailable
      console.warn('[useGiftData] API unavailable, using mock data:', error);
      gifts.value = MOCK_GIFTS;
    } finally {
      isInitialized.value = true;
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
   * Format gift price for display (coins only)
   */
  function formatGiftPrice(gift: Gift): string {
    return `🪙 ${gift.price.toLocaleString()}`;
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


/**
 * Gift Data Composable
 *
 * Handles gift data fetching, caching, and category grouping.
 * Uses backend API: GET /api/v1/gifts/all
 */
import type { Gift, GiftCategory, GiftCategoryGroup } from '~/types/gift/gift';
import { GIFT_CATEGORY_CONFIG } from '~/types/gift/gift';
import { useApi, type NormalizedError } from '../shared/useApi';


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
const error = ref<NormalizedError | null>(null);

export function useGiftData() {
  // ========================================
  // Dependencies
  // ========================================
  const { api, normalizeError } = useApi();

  // ========================================
  // Computed: Error State
  // ========================================

  const hasError = computed(() => error.value !== null);

  // ========================================
  // Computed: Category Groups
  // ========================================

  /**
   * Sendable gifts only (excludes gifts explicitly marked sendable === false).
   * Missing/undefined `sendable` is treated as sendable (backward compat).
   */
  const sendableGifts = computed<Gift[]>(() => gifts.value.filter((g) => g.sendable !== false));

  /**
   * Group gifts by category for tab display (drawer / sending UI — sendable only)
   */
  const giftsByCategory = computed<GiftCategoryGroup[]>(() => {
    const categories = Object.keys(GIFT_CATEGORY_CONFIG) as GiftCategory[];

    return categories
      .map((category) => {
        const config = GIFT_CATEGORY_CONFIG[category];
        const categoryGifts = sendableGifts.value
          .filter((g) => g.category === category)
          .sort((a, b) => a.price - b.price || a.sort_order - b.sort_order);

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
   * Fetch gifts from API
   * @throws Will set error state on failure - check hasError computed
   */
  async function fetchGifts(): Promise<void> {
    if (isLoading.value) return;

    isLoading.value = true;
    error.value = null;

    try {
      const response = await api<AllGiftsApiResponse>('/gifts/all');
      gifts.value = response.data.gifts;
    } catch (e) {
      error.value = normalizeError(e);
      // Don't set gifts to empty - keep any previously loaded data
    } finally {
      isInitialized.value = true;
      isLoading.value = false;
    }
  }

  /**
   * Retry fetching gifts after an error
   */
  async function retry(): Promise<void> {
    error.value = null;
    await fetchGifts();
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
    sendableGifts,
    giftsByCategory,
    isLoading,
    isInitialized,
    error,
    hasError,
    getGiftById,
    fetchGifts,
    ensureLoaded,
    formatGiftPrice,
    retry,
  };
}


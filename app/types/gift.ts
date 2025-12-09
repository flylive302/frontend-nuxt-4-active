/**
 * Gift Types and Mock Data
 * 
 * This file contains gift-related types and temporary mock data
 * until the Laravel backend API is integrated.
 */

// ============================================
// GIFT TYPES (from Laravel backend)
// ============================================

/**
 * Gift item as returned from Laravel backend API
 * GET /api/gifts
 */
export interface Gift {
  id: number;
  name: string;
  description?: string;
  image_url: string;
  animation_url?: string;
  price_coins: number;
  price_diamonds?: number;
  category: GiftCategory;
  rarity: GiftRarity;
  charm_xp: number;           // XP awarded to recipient
  wealth_xp: number;          // XP awarded to sender
  is_animated: boolean;
  is_available: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export type GiftCategory = 'normal' | 'lucky' | 'cp-gift' | 'vip-gift' | 'country' | 'celebrity' | 'bag';
export type GiftRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/**
 * Gift category with items for UI grouping
 */
export interface GiftCategoryGroup {
  category: GiftCategory;
  label: string;
  icon: string;
  gifts: Gift[];
}

// ============================================
// SEND GIFT PAYLOAD (to MSAB Server)
// ============================================

/**
 * Payload sent to MSAB server via socket.io
 * Event: 'gift:send'
 */
export interface GiftSendPayload {
  roomId: string;
  giftId: number;
  recipientId: number;
  quantity?: number;  // defaults to 1
}

// ============================================
// GIFT RECEIVED EVENT (from MSAB Server)
// ============================================

/**
 * Event received when a gift is sent in the room
 * Event: 'gift:received'
 */
export interface GiftReceivedEvent {
  senderId: number;
  senderName: string;
  senderAvatar?: string;
  roomId: string;
  giftId: number;
  recipientId: number;
  quantity: number;
  // Enhanced fields for display
  gift?: Gift;
  totalValue?: number;
}

// ============================================
// MOCK GIFT DATA
// ============================================

/**
 * Mock gifts for development/testing
 * Replace with API call: GET /api/gifts
 */
export const MOCK_GIFTS: Gift[] = [
  // Normal Category
  {
    id: 1,
    name: 'castle',
    description: 'A beautiful red rose',
    image_url: '/siteAssets/gifts/castle.webp',
    price_coins: 10,
    category: 'normal',
    rarity: 'common',
    charm_xp: 1,
    wealth_xp: 1,
    is_animated: false,
    is_available: true,
    sort_order: 1,
  },
  {
    id: 2,
    name: 'Heart',
    description: 'Show some love',
    image_url: '/siteAssets/gifts/heart.webp',
    price_coins: 20,
    category: 'normal',
    rarity: 'common',
    charm_xp: 2,
    wealth_xp: 2,
    is_animated: false,
    is_available: true,
    sort_order: 2,
  },
  {
    id: 3,
    name: 'Chocolate',
    description: 'Sweet treat',
    image_url: '/siteAssets/gifts/chocolate.webp',
    price_coins: 30,
    category: 'normal',
    rarity: 'common',
    charm_xp: 3,
    wealth_xp: 3,
    is_animated: false,
    is_available: true,
    sort_order: 3,
  },
  {
    id: 4,
    name: 'Teddy Bear',
    description: 'Cuddly companion',
    image_url: '/siteAssets/gifts/teddy.webp',
    price_coins: 50,
    category: 'normal',
    rarity: 'uncommon',
    charm_xp: 5,
    wealth_xp: 5,
    is_animated: false,
    is_available: true,
    sort_order: 4,
  },
  
  // Lucky Category
  {
    id: 5,
    name: 'Diamond Ring',
    description: 'Precious and elegant',
    image_url: '/siteAssets/gifts/ring.webp',
    price_coins: 100,
    price_diamonds: 10,
    category: 'lucky',
    rarity: 'rare',
    charm_xp: 10,
    wealth_xp: 10,
    is_animated: true,
    is_available: true,
    sort_order: 5,
  },
  {
    id: 6,
    name: 'Crown',
    description: 'For royalty',
    image_url: '/siteAssets/gifts/crown.webp',
    price_coins: 200,
    price_diamonds: 20,
    category: 'lucky',
    rarity: 'rare',
    charm_xp: 20,
    wealth_xp: 20,
    is_animated: true,
    is_available: true,
    sort_order: 6,
  },
  {
    id: 7,
    name: 'Sports Car',
    description: 'Luxury on wheels',
    image_url: '/siteAssets/gifts/car.webp',
    price_coins: 500,
    price_diamonds: 50,
    category: 'lucky',
    rarity: 'epic',
    charm_xp: 50,
    wealth_xp: 50,
    is_animated: true,
    is_available: true,
    sort_order: 7,
  },
  {
    id: 8,
    name: 'Yacht',
    description: 'Sail in style',
    image_url: '/siteAssets/gifts/yacht.webp',
    price_coins: 1000,
    price_diamonds: 100,
    category: 'lucky',
    rarity: 'epic',
    charm_xp: 100,
    wealth_xp: 100,
    is_animated: true,
    is_available: true,
    sort_order: 8,
  },
  
  // CP Gift Category
  {
    id: 9,
    name: 'Castle',
    description: 'A magnificent castle',
    image_url: '/siteAssets/gifts/castle.webp',
    price_coins: 5000,
    price_diamonds: 500,
    category: 'cp-gift',
    rarity: 'legendary',
    charm_xp: 500,
    wealth_xp: 500,
    is_animated: true,
    is_available: true,
    sort_order: 9,
  },
  {
    id: 10,
    name: 'Private Jet',
    description: 'Fly in luxury',
    image_url: '/siteAssets/gifts/jet.webp',
    price_coins: 10000,
    price_diamonds: 1000,
    category: 'cp-gift',
    rarity: 'legendary',
    charm_xp: 1000,
    wealth_xp: 1000,
    is_animated: true,
    is_available: true,
    sort_order: 10,
  },
  {
    id: 11,
    name: 'Space Rocket',
    description: 'To the moon!',
    image_url: '/siteAssets/gifts/rocket.webp',
    price_coins: 50000,
    price_diamonds: 5000,
    category: 'cp-gift',
    rarity: 'legendary',
    charm_xp: 5000,
    wealth_xp: 5000,
    is_animated: true,
    is_available: true,
    sort_order: 11,
  },
  {
    id: 12,
    name: 'Planet',
    description: 'Own a world',
    image_url: '/siteAssets/gifts/planet.webp',
    price_coins: 100000,
    price_diamonds: 10000,
    category: 'cp-gift',
    rarity: 'legendary',
    charm_xp: 10000,
    wealth_xp: 10000,
    is_animated: true,
    is_available: true,
    sort_order: 12,
  },
];

/**
 * Get gifts grouped by category
 */
export function getGiftsByCategory(): GiftCategoryGroup[] {
  const categories: GiftCategoryGroup[] = [
    {
      category: 'normal',
      label: 'Normal',
      icon: 'i-lucide-gift',
      gifts: MOCK_GIFTS.filter(g => g.category === 'normal'),
    },
    {
      category: 'lucky',
      label: 'Lucky',
      icon: 'i-lucide-gem',
      gifts: MOCK_GIFTS.filter(g => g.category === 'lucky'),
    },
    {
      category: 'cp-gift',
      label: 'CP Gift',
      icon: 'i-lucide-crown',
      gifts: MOCK_GIFTS.filter(g => g.category === 'cp-gift'),
    },
    {
      category: 'vip-gift',
      label: 'VIP Gift',
      icon: 'i-lucide-crown',
      gifts: MOCK_GIFTS.filter(g => g.category === 'vip-gift'),
    },
    {
      category: 'country',
      label: 'Country',
      icon: 'i-lucide-crown',
      gifts: MOCK_GIFTS.filter(g => g.category === 'country'),
    },
    {
      category: 'celebrity',
      label: 'Celebrity',
      icon: 'i-lucide-crown',
      gifts: MOCK_GIFTS.filter(g => g.category === 'celebrity'),
    },
    {
      category: 'bag',
      label: 'Bag',
      icon: 'i-lucide-crown',
      gifts: MOCK_GIFTS.filter(g => g.category === 'bag'),
    },
  ];
  
  return categories;
}

/**
 * Get a gift by ID
 */
export function getGiftById(id: number): Gift | undefined {
  return MOCK_GIFTS.find(g => g.id === id);
}

/**
 * Format gift price for display
 */
export function formatGiftPrice(gift: Gift): string {
  if (gift.price_diamonds) {
    return `💎 ${gift.price_diamonds}`;
  }
  return `🪙 ${gift.price_coins}`;
}

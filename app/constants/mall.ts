// ========================================
// Mall Constants
// ========================================
// Static configuration values for the mall/prop feature.
// No imports from stores or composables.
// ========================================

import type { PropType } from '~/types/mall/prop'

/**
 * Icons for prop types.
 */
export const PROP_TYPE_ICONS: Record<PropType, string> = {
  frame: 'i-lucide-square',
  signature: 'i-lucide-fingerprint',
  room_theme: 'i-lucide-palette',
  chat_bubble: 'i-lucide-message-circle',
  entry_animation: 'i-lucide-sparkles',
  data_card: 'i-lucide-id-card',
  mice_wave: 'i-lucide-waves',
  slides: 'i-lucide-presentation',
}

/**
 * Colors for prop types.
 */
export const PROP_TYPE_COLORS: Record<PropType, string> = {
  frame: 'text-amber-500',
  signature: 'text-purple-500',
  room_theme: 'text-blue-500',
  chat_bubble: 'text-pink-500',
  entry_animation: 'text-cyan-500',
  data_card: 'text-emerald-500',
  mice_wave: 'text-orange-500',
  slides: 'text-violet-500',
}

/**
 * Labels for prop types.
 */
export const PROP_TYPE_LABELS: Record<PropType, string> = {
  frame: 'Frames',
  signature: 'Unique ID',
  room_theme: 'Room Themes',
  chat_bubble: 'Chat Bubbles',
  entry_animation: 'Entries',
  data_card: 'Data Cards',
  mice_wave: 'Mice Waves',
  slides: 'Slides',
}

/**
 * Tab order for prop types in UI.
 */
export const PROP_TYPE_ORDER: PropType[] = [
  'frame',
  'entry_animation',
  'chat_bubble',
  'data_card',
  'mice_wave',
  'slides',
  'signature',
  'room_theme',
]

/**
 * Data is considered stale after this duration (ms).
 * Used by the mall store to determine when to refetch.
 */
export const MALL_STALE_TIME = 5 * 60 * 1000

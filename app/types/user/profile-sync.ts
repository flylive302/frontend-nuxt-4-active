/**
 * Profile fields accepted by the user:profileSync socket event.
 * Only visual/identity fields — financial data is excluded.
 */
export interface ProfileSyncFields {
  name?: string
  signature?: string
  avatar?: string
  frame_id?: number | null
  chat_bubble_id?: number | null
  entry_animation_id?: number | null
  data_card_id?: number | null
  mice_wave_id?: number | null
  slides_id?: number | null
  gender?: string | number
  vip_level?: number
}

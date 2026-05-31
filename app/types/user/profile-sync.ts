/**
 * Profile fields accepted by the user:profileSync socket event.
 * Visual/identity fields plus XP — private balance fields (coins, diamonds) excluded.
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
  wealth_xp?: string
  charm_xp?: string
}

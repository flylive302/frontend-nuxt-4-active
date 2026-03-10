/**
 * Profile fields accepted by the user:profileSync socket event.
 * Only visual/identity fields — financial data is excluded.
 */
export interface ProfileSyncFields {
  name?: string
  signature?: string
  avatar?: string
  frame?: string | null
  gender?: string | number
  vip_level?: number
}

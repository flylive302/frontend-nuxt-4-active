// ========================================
// Auth Types
// ========================================
// Re-export BootstrapUser as User for backward compatibility

export type { BootstrapUser as User } from './bootstrap'

// ========================================
// Social Auth
// ========================================

export type SocialProvider = 'google' | 'facebook' | 'apple'

// ========================================
// Gender Options (for forms)
// ========================================

export interface GenderOption {
  label: string
  value: number
  icon: string
}

// ========================================
// Auth Payloads
// ========================================

export interface AuthResponse {
  user: import('./bootstrap').BootstrapUser
  token: string
  token_type: string
  expires_at: string
  msab_token: string
}

export interface LoginPayload {
  phone: string
  country: string            // ISO 3166-1 alpha-2 (backend field)
  dial_code?: string         // For display only, not sent to backend
  password?: string
}

export interface RegisterPayload {
  name: string
  email?: string
  phone: string
  country: string            // ISO 3166-1 alpha-2 (backend field)
  dial_code?: string         // For display only
  password?: string
  password_confirmation?: string
}

export interface UpdateProfilePayload {
  name?: string
  gender?: number
  email?: string
  date_of_birth?: string
  country?: string
}

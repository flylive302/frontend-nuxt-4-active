// ========================================
// Auth Types
// ========================================
// Re-export BootstrapUser as User for backward compatibility

export type { BootstrapUser as User } from './bootstrap'

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
}

export interface LoginPayload {
  phone: string
  phone_country: string
  phone_country_code: string
  password?: string
  remember_me?: boolean
}

export interface RegisterPayload {
  name: string
  email?: string
  phone: string
  phone_country: string
  phone_country_code: string
  password?: string
  password_confirmation?: string
}

export interface UpdateProfilePayload {
  gender: number
  email: string
  date_of_birth: string
}

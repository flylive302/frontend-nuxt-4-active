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
  country: string            // ISO 3166-1 alpha-2 (backend field)
  dial_code?: string         // For display only, not sent to backend
  password?: string
  remember_me?: boolean
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
  gender: number
  email: string
  date_of_birth: string
}

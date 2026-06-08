// ========================================
// Auth Types
// ========================================
// Re-export BootstrapUser as User for backward compatibility

export type { BootstrapUser as User } from './bootstrap'

// ========================================
// Social Auth
// ========================================

export type SocialProvider = 'google' | 'facebook' | 'apple' | 'email'

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
  room: import('./bootstrap').BootstrapRoom
  token: string
  token_type: string
  expires_at: string
  msab_token: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  name: string
  email: string
  password: string
  password_confirmation: string
}

/** Response from POST /auth/register — no token yet, email OTP must be verified first. */
export interface RegisterResponse {
  email: string
  requires_verification: true
}

export interface VerifyEmailPayload {
  email: string
  code: string
}

export interface ForgotPasswordPayload {
  email: string
}

export interface ResetPasswordPayload {
  email: string
  code: string
  password: string
  password_confirmation: string
}

export interface UpdateProfilePayload {
  name?: string
  gender?: number
  email?: string
  date_of_birth?: string
  // Phone (E.164, carries its own dial code) and country (residence) are
  // independent — neither constrains the other.
  phone?: string
  country?: string
  is_follow_list_public?: boolean
  terms_accepted_at?: true
  privacy_policy_accepted_at?: true
}

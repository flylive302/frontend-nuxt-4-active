
export interface User {
    avatar?: Avatar

    id: number
    name?: string
    email?: string
    phone?: string
    phone_country?: string
    phone_country_code?: string
    signature?: string | null

    gender?: number | null
    date_of_birth?: string | null

    is_blocked?: boolean | null
    blocked_at?: string | null
    blocked_reason?: string | null
    locked_until?: string | null

    email_verified_at?: string | null
    last_login_at?: string
    created_at?: string
    updated_at?: string

    profile_completion?: UserProfileCompletion

    permissions?: string[]
    roles?: string[]
}
export interface GenderOption {
    label: string
    value: number
    icon: string
}
export interface Avatar {
    large: string
    medium: string
    original: string
    thumbnail: string
}

export interface UserProfileCompletion {
    is_complete?: boolean
    optional_completed?: number | null
    optional_total?: number | null
    overall_percentage?: number | null
    required_completed?: number | null
    required_total?: number | null
}

export interface AuthResponse {
    user: User
    token: string
    token_type: string
    expires_at: string
    permissions: string[]
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
    signature?: string
}

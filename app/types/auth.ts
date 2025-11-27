export interface User {
    id: number
    name: string
    signature: string | null
    avatar: {
        original: string
        thumbnail: string
        medium: string
        large: string
    } | null
    email_verified_at: string | null
    created_at: string
    updated_at: string

    // Private / Admin / Own Profile Only
    email?: string
    phone?: {
        raw: string
        formatted: string
        country: string
    }
    phone_country?: string
    last_login_at?: string
    roles?: string[]
    permissions?: string[]

    // Computed
    profile_completion?: {
        overall_percentage: number
        is_complete: boolean
    }
}

export interface AuthResponse {
    user: User
    token: string
    token_type: string
    expires_at: string
    permissions: string[]
}

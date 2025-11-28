export interface User {
    id: number
    name?: string
    email?: string
    phone?: string
    country?: string
    country_code?: string
    signature?: string | null
    avatar?: string | null

    is_blocked?: boolean | null
    blocked_at?: string | null
    blocked_reason?: string | null
    locked_until?: string | null

    roles?: string[]
    permissions?: string[]

    email_verified_at?: string | null
    last_login_at?: string
    created_at?: string
    updated_at?: string
}

export interface AuthResponse {
    user: User
    token: string
    token_type: string
    expires_at: string
    permissions: string[]
}

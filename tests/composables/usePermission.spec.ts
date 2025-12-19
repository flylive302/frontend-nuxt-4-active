import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePermission } from '../../app/composables/usePermission'
import { useAuthStore } from '../../app/stores/auth'
import type { User } from '~/types/auth'

describe('usePermission', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
    })

    it('returns false if user has no permissions', () => {
        const authStore = useAuthStore()
        authStore.user = { id: 1, permissions: [], roles: [] } as User

        const { can } = usePermission()
        expect(can('edit_posts')).toBe(false)
    })

    it('returns true if user has the permission', () => {
        const authStore = useAuthStore()
        authStore.user = { id: 1, permissions: ['edit_posts'], roles: [] } as User

        const { can } = usePermission()
        expect(can('edit_posts')).toBe(true)
    })

    it('handles array of permissions (ANY match)', () => {
        const authStore = useAuthStore()
        authStore.user = { id: 1, permissions: ['view_posts'], roles: [] } as User

        const { can } = usePermission()
        // Should be true because user has 'view_posts'
        expect(can(['edit_posts', 'view_posts'])).toBe(true)
    })

    it('handles array of permissions (ALL match)', () => {
        const authStore = useAuthStore()
        authStore.user = { id: 1, permissions: ['view_posts', 'edit_posts'], roles: [] } as User

        const { can } = usePermission()
        expect(can(['edit_posts', 'view_posts'], true)).toBe(true)
    })

    it('returns false for partial match when requireAll is true', () => {
        const authStore = useAuthStore()
        authStore.user = { id: 1, permissions: ['view_posts'], roles: [] } as User

        const { can } = usePermission()
        expect(can(['edit_posts', 'view_posts'], true)).toBe(false)
    })

    it('checks roles correctly', () => {
        const authStore = useAuthStore()
        authStore.user = { id: 1, permissions: [], roles: ['admin'] } as User

        const { hasRole } = usePermission()
        expect(hasRole('admin')).toBe(true)
        expect(hasRole('editor')).toBe(false)
        expect(hasRole(['admin', 'editor'])).toBe(true)
    })
    
     it('returns false when user is null', () => {
        const authStore = useAuthStore()
        authStore.user = null

        const { can, hasRole } = usePermission()
        expect(can('edit')).toBe(false)
        expect(hasRole('admin')).toBe(false)
    })
})

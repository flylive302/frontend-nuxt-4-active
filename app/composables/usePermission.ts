
/**
 * Composable for easy permission and role checks against the authenticated user.
 * @returns Object containing check methods { can, hasRole }.
 */
export function usePermission() {
  // ========================================
  // Composables / Injected Dependencies
  // ========================================
  const authStore = useAuthStore()

  // ========================================
  // Business Logic / Core Logic
  // ========================================

  /**
   * Checks if the user has the specified permission(s).
   * @param permission - A single permission string or an array of permissions.
   * @param requireAll - If true, requires ALL permissions in the array. Default is false (requires ANY).
   * @returns True if the condition is met.
   */
  function can(permission: string | string[], requireAll: boolean = false): boolean {
    const userPermissions = authStore.user?.permissions || []
    
    if (typeof permission === 'string') {
      return userPermissions.includes(permission)
    }

    if (permission.length === 0) {
      return false
    }

    if (requireAll) {
      return permission.every(p => userPermissions.includes(p))
    }

    return permission.some(p => userPermissions.includes(p))
  }
  /**
   * Checks if the user has the specified role(s).
   * @param role - A single role string or an array of roles.
  **/
  function hasRole(role: string | string[], requireAll: boolean = false): boolean {
    const userRoles = authStore.user?.roles || []

    if (typeof role === 'string') {
      return userRoles.includes(role)
    }

    if (role.length === 0) {
      return false
    }

    if (requireAll) {
      return role.every(r => userRoles.includes(r))
    }

    return role.some(r => userRoles.includes(r))
  }
  
  return {
    can,
    hasRole,
  }
}

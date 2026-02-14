// ========================================
// Client Info Composable
// ========================================
// Provides client type detection for API headers.
// Uses VueUse for PWA/browser detection.

import { useMediaQuery } from '@vueuse/core'

// ========================================
// Types
// ========================================

export type ClientType = 'web' | 'pwa'

// ========================================
// Composable
// ========================================

/**
 * Detects client type for X-Client-Type header.
 * - 'pwa': Installed as standalone app
 * - 'web': Regular browser
 */
export function useClientInfo() {
  // Detect PWA standalone mode
  const isPwa = useMediaQuery('(display-mode: standalone)')

  const clientType = computed<ClientType>(() => {
    // Server-side: default to web
    if (import.meta.server) return 'web'
    return isPwa.value ? 'pwa' : 'web'
  })

  return {
    clientType,
    isPwa,
  }
}

// ========================================
// Singleton for non-reactive contexts
// ========================================

let _cachedClientType: ClientType | null = null

/**
 * Gets client type synchronously (for use in API interceptor).
 * Caches result after first call.
 */
export function getClientType(): ClientType {
  if (import.meta.server) return 'web'
  
  if (_cachedClientType) return _cachedClientType
  
  // Check standalone mode via matchMedia
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  _cachedClientType = isStandalone ? 'pwa' : 'web'
  
  return _cachedClientType
}

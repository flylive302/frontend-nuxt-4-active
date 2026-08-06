// ========================================
// Client Info Composable
// ========================================
// Provides client type detection for API headers.
// Uses VueUse for PWA/browser detection.
//
// Deliberately NOT a platform source for Sentry. This distinguishes browser
// vs installed-PWA by `display-mode`, never whether the code runs inside the
// Capacitor native shell, and it only ever feeds an HTTP header. The Sentry
// platform tag (android vs web) is resolved separately, from
// `Capacitor.isNativePlatform()`, by `~/utils/client-platform.ts` — see that
// file for why this composable can't answer the same question.

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

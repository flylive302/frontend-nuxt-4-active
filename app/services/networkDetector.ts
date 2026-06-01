// ========================================
// Network Detector Service
// ========================================

import type { NetworkInfo } from '~/types/asset/asset'


// ========================================
// Types
// ========================================

type ConnectionChangeCallback = (info: NetworkInfo) => void

// ========================================
// State
// ========================================

const callbacks: Set<ConnectionChangeCallback> = new Set()
let isInitialized = false

// ========================================
// Helpers
// ========================================

/**
 * Get the Network Information API connection object.
 * Returns null if not supported (SSR or unsupported browser).
 */
function getConnection(): NetworkInformation | null {
  if (typeof navigator === 'undefined') return null
  return (navigator as Navigator & { connection?: NetworkInformation }).connection ?? null
}

/**
 * Map connection type to our simplified types.
 */
function mapConnectionType(type: string | undefined): NetworkInfo['connectionType'] {
  if (!type) return 'unknown'
  switch (type.toLowerCase()) {
    case 'wifi':
      return 'wifi'
    case 'cellular':
      return 'cellular'
    case 'ethernet':
      return 'ethernet'
    case 'none':
      return 'none'
    default:
      return 'unknown'
  }
}

/**
 * Map effective type to our types.
 */
function mapEffectiveType(type: string | undefined): NetworkInfo['effectiveType'] {
  if (!type) return 'unknown'
  switch (type.toLowerCase()) {
    case '4g':
      return '4g'
    case '3g':
      return '3g'
    case '2g':
      return '2g'
    case 'slow-2g':
      return 'slow-2g'
    default:
      return 'unknown'
  }
}

// ========================================
// Event Handler
// ========================================

function handleConnectionChange(): void {
  const info = getNetworkInfo()
  callbacks.forEach((cb) => cb(info))
}

// ========================================
// Public API
// ========================================

/**
 * Get current network information.
 * SSR-safe: returns sensible defaults on server.
 */
export function getNetworkInfo(): NetworkInfo {
  // SSR guard
  if (typeof navigator === 'undefined') {
    return {
      isOnline: true,
      connectionType: 'unknown',
      effectiveType: 'unknown',
      saveData: false,
    }
  }

  const connection = getConnection()

  return {
    isOnline: navigator.onLine,
    connectionType: mapConnectionType(connection?.type),
    effectiveType: mapEffectiveType(connection?.effectiveType),
    saveData: connection?.saveData ?? false,
  }
}

/**
 * Check if currently on cellular network.
 */
export function isCellular(): boolean {
  const info = getNetworkInfo()
  return info.connectionType === 'cellular'
}

/**
 * Check if connection is metered (cellular or save data).
 */
export function isMeteredConnection(): boolean {
  const info = getNetworkInfo()
  return info.connectionType === 'cellular' || info.saveData
}

/**
 * Subscribe to connection changes.
 * Returns unsubscribe function.
 */
export function onConnectionChange(callback: ConnectionChangeCallback): () => void {
  callbacks.add(callback)

  // Initialize listeners on first subscription
  if (!isInitialized && typeof window !== 'undefined') {
    const connection = getConnection()
    if (connection) {
      connection.addEventListener('change', handleConnectionChange)
    }
    window.addEventListener('online', handleConnectionChange)
    window.addEventListener('offline', handleConnectionChange)
    isInitialized = true
  }

  return () => {
    callbacks.delete(callback)
  }
}

/**
 * One-time check if browser supports Network Information API.
 */
export function isNetworkInfoSupported(): boolean {
  return getConnection() !== null
}

// ========================================
// Types (for Network Information API)
// ========================================

interface NetworkInformation extends EventTarget {
  readonly type?: string
  readonly effectiveType?: string
  readonly saveData?: boolean
  readonly downlink?: number
  readonly rtt?: number
  addEventListener(type: 'change', listener: () => void): void
  removeEventListener(type: 'change', listener: () => void): void
}

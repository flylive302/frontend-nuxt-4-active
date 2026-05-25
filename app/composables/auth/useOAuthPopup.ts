// ========================================
// OAuth Popup Composable
// ========================================
// Role: Infrastructure composable — owns popup OAuth window lifecycle.
// Opens a centered popup for social auth, listens for postMessage
// result from the callback page, and handles cleanup.

import { createLogger } from '~/utils/logger'

const log = createLogger('[OAuthPopup]')

// ========================================
// Types
// ========================================

export interface OAuthPopupResult {
  token?: string
  msabToken?: string
  error?: string
  isNew: boolean
}

interface PopupMessagePayload {
  type: 'oauth-callback'
  token?: string
  msab_token?: string
  error?: string
  is_new?: string
}

// ========================================
// Constants
// ========================================

const POPUP_WIDTH = 500
const POPUP_HEIGHT = 600
const POPUP_POLL_INTERVAL_MS = 500
const MESSAGE_TYPE = 'oauth-callback'

// ========================================
// Composable
// ========================================

/**
 * Manages the popup-based OAuth window lifecycle.
 *
 * Opens a centered popup → listens for postMessage from the callback page
 * → validates origin → returns credentials → auto-cleans up.
 *
 * Falls back to null if popup is blocked (caller should redirect instead).
 */
export function useOAuthPopup() {

  // ========================================
  // Popup Window Management
  // ========================================

  /**
   * Open a centered popup window for OAuth.
   * Returns null if the popup was blocked by the browser.
   */
  function openPopup(url: string): Window | null {
    const left = Math.round(window.screenX + (window.outerWidth - POPUP_WIDTH) / 2)
    const top = Math.round(window.screenY + (window.outerHeight - POPUP_HEIGHT) / 2)

    const features = [
      `width=${POPUP_WIDTH}`,
      `height=${POPUP_HEIGHT}`,
      `left=${left}`,
      `top=${top}`,
      'toolbar=no',
      'menubar=no',
      'scrollbars=yes',
      'resizable=yes',
      'status=no',
    ].join(',')

    const popup = window.open(url, 'oauth-popup', features)

    if (!popup || popup.closed) {
      return null
    }

    popup.focus()
    return popup
  }

  // ========================================
  // Message Listener
  // ========================================

  /**
   * Listen for OAuth result from the popup via postMessage.
   * Also polls for popup close (user manually closed = cancelled).
   *
   * Returns a cleanup function. The callback is invoked exactly once.
   */
  function listenForResult(
    popup: Window,
    onResult: (result: OAuthPopupResult) => void,
    onCancel: () => void,
  ): () => void {
    let settled = false

    // --- Message handler ---
    function handleMessage(event: MessageEvent<PopupMessagePayload>) {
      // GATE — validate origin (security)
      if (event.origin !== window.location.origin) {
        return
      }

      // GATE — validate message type
      if (event.data?.type !== MESSAGE_TYPE) {
        return
      }

      if (settled) return
      settled = true


      const payload = event.data
      onResult({
        token: payload.token,
        msabToken: payload.msab_token,
        error: payload.error,
        isNew: payload.is_new === 'true',
      })

      cleanup()
    }

    // --- Poll for popup close (user cancelled) ---
    const pollTimer = window.setInterval(() => {
      if (popup.closed && !settled) {
        settled = true
        onCancel()
        cleanup()
      }
    }, POPUP_POLL_INTERVAL_MS)

    // --- Register listener ---
    window.addEventListener('message', handleMessage)

    // --- Cleanup ---
    function cleanup() {
      window.removeEventListener('message', handleMessage)
      clearInterval(pollTimer)

      // Ensure popup is closed
      try {
        if (!popup.closed) popup.close()
      } catch {
        // Cross-origin close may throw — safe to ignore
      }
    }

    return cleanup
  }

  // ========================================
  // Return
  // ========================================

  return { openPopup, listenForResult }
}

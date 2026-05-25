// ========================================
// Media Session Composable
// ========================================
// Registers the live room as active media with the OS so the browser
// tab/PWA is not suspended when backgrounded (required on iOS 16.4+ PWA
// and improves Android TWA lock-screen behaviour).
//
// iOS requires at least one MediaSession action handler to be registered
// before it will allow audio to continue in the background. We register
// `play` to satisfy that requirement without showing a misleading pause
// button (live streams cannot be paused).
//
// If iOS background audio still doesn't work after this, the next step is
// to append the consumer <audio> elements to a hidden DOM node with
// `playsInline` set — that is NOT done here to keep scope minimal.

import { createLogger } from '~/utils/logger'

const log = createLogger('[MediaSession]')

let _initialized = false

export function useMediaSession() {
  const isSupported =
    typeof navigator !== 'undefined' && 'mediaSession' in navigator

  /**
   * Register the `play` action handler once at app start.
   * Must be called from a component (not a callback) to satisfy browser
   * security requirements. Subsequent calls are no-ops.
   */
  function init(): void {
    if (!isSupported || _initialized) return
    _initialized = true

    navigator.mediaSession.setActionHandler('play', () => {
      navigator.mediaSession.playbackState = 'playing'
    })

  }

  /**
   * Signal to the OS that audio is playing in this room.
   * Call after room join completes and audio consumption begins.
   */
  function activate(roomName: string, logoUrl: string | null): void {
    if (!isSupported) return

    navigator.mediaSession.metadata = new MediaMetadata({
      title: roomName,
      artist: 'FlyLive',
      artwork: logoUrl ? [{ src: logoUrl, sizes: '512x512' }] : [],
    })
    navigator.mediaSession.playbackState = 'playing'

  }

  /**
   * Clear the session when the user leaves the room.
   */
  function deactivate(): void {
    if (!isSupported) return

    navigator.mediaSession.metadata = null
    navigator.mediaSession.playbackState = 'none'

  }

  return { isSupported, init, activate, deactivate }
}

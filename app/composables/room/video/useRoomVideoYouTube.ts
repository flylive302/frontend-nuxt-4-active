/**
 * useRoomVideoYouTube — the platform-dependent side of YouTube in the Room Video
 * (room-video-player 08).
 *
 * - `canEmbed`: may this platform embed the YouTube iframe (ticket 01 decision row:
 *   web + Android yes, iOS no). `false` → the panel shows the "Open on YouTube"
 *   card and the drawer refuses YouTube links; the room's Snapshot keeps running.
 * - `openOnYouTube(videoId, atSec)`: the card's action — the watch page at the
 *   room's current second, in the Capacitor in-app browser on native, a new tab
 *   on the web. A local view action: nothing is sent to the server.
 *
 * `readRoomVideoPlatform()` is the one Capacitor read for the Room Video (the
 * sync uses it for the collapse-unmount rule); the platform never changes for the
 * life of the page, so it is read once.
 */
import { Capacitor } from '@capacitor/core'
import type { RoomVideoPlatform } from '~/constants/room'
import { createLogger } from '~/utils/logger'
import { canEmbedYouTube, toRoomVideoPlatform, youTubeWatchUrl } from '~/utils/video-platform'

const log = createLogger('[RoomVideoYouTube]')

const OPEN_FAILED_MESSAGE = "Couldn't open YouTube. Try again."

let platform: RoomVideoPlatform | null = null

export function readRoomVideoPlatform(): RoomVideoPlatform {
  platform ??= toRoomVideoPlatform(Capacitor.getPlatform())
  return platform
}

/** Test-only: forget the cached platform between cases. */
export function __resetRoomVideoPlatformForTest(): void {
  platform = null
}

export function useRoomVideoYouTube() {
  const current = readRoomVideoPlatform()
  const canEmbed = canEmbedYouTube(current)
  const toast = useToast()

  /** Open the watch page at `atSec`. Never throws; a failure is one toast. */
  async function openOnYouTube(videoId: string, atSec: number): Promise<void> {
    const url = youTubeWatchUrl(videoId, atSec)
    try {
      if (current === 'web') {
        window.open(url, '_blank', 'noopener')
        return
      }
      const { Browser } = await import('@capacitor/browser')
      await Browser.open({ url })
    } catch (error) {
      log.warn('Open on YouTube failed', error)
      toast.add({ title: 'Video', description: OPEN_FAILED_MESSAGE, color: 'error' })
    }
  }

  return { canEmbed, openOnYouTube }
}

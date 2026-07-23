// ========================================
// Slide Overlay Events (REACT)
// ========================================
// socket.on('slide:play') → store mutation. Registered globally via the event
// registry (bound on socket connect in useAudioSocket), NOT in
// useRoomEventHandlers — so app-scope slides reach users who are in no room.

import type { Socket } from 'socket.io-client'
import type { SlidePlayPayload, SlideLuckyWinBlock } from '~/types/slide'
import type { ChatMessageEvent } from '~/types/room/audio'
import { createLogger } from '~/utils/logger'
import { CHAT_MESSAGE_TYPE_LUCKY_WIN } from '~/constants/room'

const log = createLogger('[SlideEvents]')

/**
 * Render the multiplier without trailing decimal noise (20 not 20.00, but 0.5
 * stays 0.5) — mirrors the backend's `LuckyTriggerContext::formatMultiplier`.
 */
function formatLuckyMultiplier(multiplier: number): string {
  return multiplier.toFixed(2).replace(/\.?0+$/, '')
}

/**
 * Chat lucky-win announcement bubble (lucky-burst-draw ticket 10) — synthesized
 * locally off the room-wide `slide:play` broadcast every client already
 * receives. The `lucky` block's mere presence means the win crossed the
 * server-side slide-binding threshold (only slide-bound tiers emit
 * `slide:play` at all) — no client-side threshold check needed. Each win is
 * its own bubble — no streak/update-in-place, unlike gift-sent bubbles.
 */
function synthesizeLuckyWinChatMessage(lucky: SlideLuckyWinBlock): void {
  const audioStore = useRoomAudioStore()
  const message: ChatMessageEvent = {
    id: `lucky-win-${lucky.winnerId}-${Date.now()}`,
    userId: lucky.winnerId,
    userName: lucky.winnerName,
    content: `${lucky.winnerName} got a Lucky win of ${formatLuckyMultiplier(lucky.multiplier)}x — won ${lucky.coinsWon.toLocaleString('en-US')} coins`,
    type: CHAT_MESSAGE_TYPE_LUCKY_WIN,
    timestamp: Date.now(),
  }
  audioStore.addMessage(message)
}

/**
 * Composable to register the slide overlay socket handler. Captures the shared
 * playback admission path during setup() so it can be used safely inside the
 * socket callback. Entry banners join the same engine via the room join paths.
 */
export function useSlideEvents() {
  const { admitPayload } = useSlidePlayback()

  return function registerSlideEvents(socket: Socket): void {
    socket.on('slide:play', (payload: SlidePlayPayload) => {
      // GATE — ignore malformed payloads.
      if (!payload?.svgaUrl) {
        log.warn('Ignoring slide:play with no svgaUrl')
        return
      }

      // EXECUTE + REACT — admit into the one overlap engine (collision-band
      // bucketing, priority, coalesce) and warm the asset cache. recipientId is
      // not on the wire payload yet (resolver supplies it in a later slice), so
      // coalesce is currently sender-scoped. See ADR 0009.
      admitPayload(payload)

      // REACT — lucky-win chat bubble, everywhere the slide itself plays
      // (HITL 2026-07-23): the slide's server-resolved scope already decides
      // distribution (room-scope → that room's sockets, app-scope → everyone),
      // so the bubble simply follows the slide. Only slide-bound wins carry
      // the `lucky` block — sub-threshold wins never announce.
      if (payload.lucky) {
        synthesizeLuckyWinChatMessage(payload.lucky)
      }
    })
  }
}

/**
 * Gift stall monitor bootstrap (msab-load-stability 11). INTENT.
 *
 * Wires `giftStallMonitor` once at app startup so sustained main-thread
 * stalls during gift bursts reach Sentry. See
 * `~/services/giftStallMonitor.ts` for the longtask-observer + throttle logic.
 */
import { init } from '~/services/giftStallMonitor';

export default defineNuxtPlugin({
  name: 'gift-stall-monitor',
  setup() {
    // The store read lives here (plugins may touch stores; services may not)
    // and is deferred to report time via the getter.
    const giftStore = useGiftStore();
    init(() => ({
      giftQueueDepth: giftStore.playbackQueue.length + (giftStore.currentPlayback ? 1 : 0),
      isPlaying: giftStore.isPlaying,
    }));
  },
});

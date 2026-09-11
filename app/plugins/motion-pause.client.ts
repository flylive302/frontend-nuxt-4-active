/**
 * Global motion-pause bootstrap (room-battery-perf issue 03). INTENT.
 *
 * Wires `motionPauseOrchestrator` once at app startup so every animated
 * surface that registers with `motionPauseRegistry` gets background/
 * visibility/covered-aware pausing for free. See
 * `~/services/motionPauseOrchestrator.ts` for the signal-combination logic.
 */
import { init, subscribeAway } from '~/services/motionPauseOrchestrator';
import { useLuckyFly } from '~/composables/lucky/useLuckyFly';
import { useGiftStore } from '~/stores/gift';

export default defineNuxtPlugin({
  name: 'motion-pause',
  setup() {
    init();

    // REACT (gift-backlog-and-lag 01): on both edges of "away" (backgrounded /
    // tab hidden) forget every queued gift visual. Producers already stop
    // queuing while away; this purge covers what landed just before the
    // signal and anything an in-flight burst still held. Chat, XP and
    // balances are untouched — they were booked at arrival.
    subscribeAway(() => {
      useGiftStore().dropQueuedPlayback();
      useLuckyFly().dropAllFlies();
    });
  },
});

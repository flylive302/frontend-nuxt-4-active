/**
 * Global motion-pause bootstrap (room-battery-perf issue 03). INTENT.
 *
 * Wires `motionPauseOrchestrator` once at app startup so every animated
 * surface that registers with `motionPauseRegistry` gets background/
 * visibility/covered-aware pausing for free. See
 * `~/services/motionPauseOrchestrator.ts` for the signal-combination logic.
 */
import { init } from '~/services/motionPauseOrchestrator';

export default defineNuxtPlugin({
  name: 'motion-pause',
  setup() {
    init();
  },
});

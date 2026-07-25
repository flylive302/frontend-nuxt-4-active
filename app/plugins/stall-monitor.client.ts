/**
 * Stall monitor bootstrap (client-session-stability 03). INTENT.
 *
 * Wires `services/stallMonitor` once at app startup and supplies the read-only
 * context it needs but may not import itself (services take no stores):
 *
 *   - **app-mount time** — the boundary between cold boot and hydration
 *   - **route timeline** — which route was active when an entry *started*,
 *     which is not the same as the route active when it is *reported*
 *   - **active work** — which subsystems were busy, sampled at report time
 *
 * The route timeline exists because the observer runs with `buffered: true`:
 * tasks recorded before it was created are replayed later, so the live route
 * would mis-attribute exactly the cold-boot entries we most want to separate.
 *
 * Every sample here is a **read** of state that already exists. Nothing in this
 * file changes what any subsystem does — measurement only (04 profiles, 05 fixes).
 */
import { init } from '~/services/stallMonitor';
import { peekSlideQueue } from '~/services/slideQueue';
import { getQueueLength, isDownloading } from '~/services/assetDownloader';
import { activeFrameAnimationCount } from '~/composables/room/useFrameAnimationBudget';
import { routePatternOf } from '~/utils/reload-telemetry';
import type { RouteLocationNormalizedLoaded } from 'vue-router';
import type { RouteMark } from '~/utils/stall-telemetry';
import { STALL_ROUTE_TIMELINE_MAX } from '~/constants/telemetry';

export default defineNuxtPlugin({
  name: 'stall-monitor',
  setup(nuxtApp) {
    const router = useRouter();
    const giftStore = useGiftStore();
    const roomStore = useRoomStore();

    let appMountedAt: number | null = null;
    const routeTimeline: RouteMark[] = [];

    const record = (route: RouteLocationNormalizedLoaded, at: number): void => {
      // `matched` carries the router's own pattern (`/room/:id()`), which is the
      // form the existing Sentry route data uses — keeping the two cross-
      // referenceable. `routePatternOf` is the fallback for unmatched paths.
      const pattern = route.matched[route.matched.length - 1]?.path ?? routePatternOf(route.path);
      routeTimeline.push({ at, pattern });
      if (routeTimeline.length > STALL_ROUTE_TIMELINE_MAX) routeTimeline.shift();
    };

    nuxtApp.hook('app:mounted', () => {
      appMountedAt = performance.now();

      // Seed the landing route if `afterEach` never saw it. Whether the initial
      // navigation completes before or after this plugin registers its hook is
      // not ours to control, and losing it would resolve every cold-boot and
      // hydration stall on `/` to `pre-route` — silently swallowing the highest-
      // volume route into the label meant for pre-navigation cold start. The
      // navigation is always finished by `app:mounted`, and entries earlier than
      // this timestamp still resolve to `pre-route` as intended.
      if (routeTimeline.length === 0) record(router.currentRoute.value, appMountedAt);
    });

    router.afterEach((to) => record(to, performance.now()));

    init({
      appMountedAt: () => appMountedAt,
      routeTimeline: () => routeTimeline,
      activeWork: () => sampleActiveWork(giftStore, roomStore),
      sampledExtra: () => ({
        // Kept from the predecessor because the number was the diagnostic for
        // the original gift-burst freeze. It rides `extra`, never a tag — the
        // defect was gift context being promoted to attribution, not the depth.
        giftQueueDepth: giftStore.playbackQueue.length + (giftStore.currentPlayback ? 1 : 0),
      }),
    });
  },
});

/**
 * Which tracked subsystems were busy at report time.
 *
 * Correlation, not attribution — a busy subsystem is not a culprit, and the
 * stall monitor keeps this on its own tag for exactly that reason. `mediasoup`
 * is deliberately absent: it has no in-flight flag to read, and Long Animation
 * Frame script attribution names its codec work directly when it is the cause.
 */
function sampleActiveWork(
  giftStore: ReturnType<typeof useGiftStore>,
  roomStore: ReturnType<typeof useRoomStore>,
): string[] {
  const active: string[] = [];

  if (giftStore.isPlaying || giftStore.playbackQueue.length > 0 || giftStore.currentPlayback) {
    active.push('gift-playback');
  }

  const slides = peekSlideQueue();
  if (slides && slides.playing.length > 0) active.push('slide-overlay');
  if (slides && slides.waiting.length > 0) active.push('slide-queue-backpressure');

  if (isDownloading() || getQueueLength() > 0) active.push('asset-download');

  // Room-gated on purpose. The budget's memory is only cleared inside its own
  // lazy computed, so after leaving a room nothing re-evaluates it and the last
  // room's seat count persists for the rest of the page session. Ungated, every
  // later stall on `/` would be tagged `frame-animations` — pointing 04 at a
  // candidate that stopped running, which is the same lie in a new label.
  if (roomStore.currentRoom && activeFrameAnimationCount() > 0) active.push('frame-animations');

  return active;
}

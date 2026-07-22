/**
 * Gift Stall Monitor (msab-load-stability 11)
 *
 * Main-thread stall detector. Heavy gift bursts can pin the JS main thread
 * for 1–2 minutes on mid-range Android (Oppo A58-class); a hung thread never
 * gets to report itself, so Sentry saw zero events for the freeze. This
 * watches `PerformanceObserver('longtask')` and reports sustained stalls
 * (a long task past STALL_REPORT_THRESHOLD_MS) with load context — longest
 * task duration, current gift queue depth, isPlaying — throttled so a
 * multi-minute freeze produces one Sentry event per throttle window, not a
 * flood once the thread comes back.
 *
 * INFRA/REACT only: no queue mutation, no UI. Read-only store access for
 * context; all side effects (Sentry) live here, not in the store.
 */
import * as Sentry from '@sentry/nuxt';
import { createLogger } from '~/utils/logger';
import { STALL_REPORT_THROTTLE_MS, STALL_REPORT_THRESHOLD_MS } from '~/constants/gift';

const log = createLogger('[GiftStallMonitor]');

/** Load context attached to every stall report — injected by the caller so
 * this service stays store-free (services rule: no store imports). */
export interface StallLoadContext {
  giftQueueDepth: number;
  isPlaying: boolean;
}

let observer: PerformanceObserver | null = null;
let lastReportedAt = 0;
let getLoadContext: (() => StallLoadContext) | null = null;

/**
 * Report a sustained stall to Sentry with load context, throttled to at
 * most one report per STALL_REPORT_THROTTLE_MS regardless of how many
 * qualifying long tasks land in that window.
 */
function reportStall(longestTaskMs: number): void {
  const now = Date.now();
  if (now - lastReportedAt < STALL_REPORT_THROTTLE_MS) return;
  lastReportedAt = now;

  const context = getLoadContext?.() ?? { giftQueueDepth: -1, isPlaying: false };

  Sentry.captureMessage('Main-thread stall detected (longtask)', {
    level: 'warning',
    tags: { source: 'gift-stall-monitor' },
    extra: {
      longestTaskMs,
      giftQueueDepth: context.giftQueueDepth,
      isPlaying: context.isPlaying,
    },
  });
}

/** Handle a batch of PerformanceObserver longtask entries. */
function handleLongTaskEntries(list: PerformanceObserverEntryList): void {
  const entries = list.getEntries();
  if (entries.length === 0) return;

  const longestTaskMs = Math.max(...entries.map((entry) => entry.duration));
  if (longestTaskMs < STALL_REPORT_THRESHOLD_MS) return;

  reportStall(longestTaskMs);
}

/**
 * Start observing long tasks. No-op (with a dev-only log) on browsers
 * without `longtask` support (Safari) or when already started.
 */
export function init(loadContext?: () => StallLoadContext): void {
  if (observer) return;
  if (loadContext) getLoadContext = loadContext;
  if (typeof PerformanceObserver === 'undefined') return;
  if (!PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
    log.debug('longtask entry type unsupported, stall monitor disabled');
    return;
  }

  try {
    observer = new PerformanceObserver(handleLongTaskEntries);
    observer.observe({ type: 'longtask', buffered: true });
  } catch (error) {
    log.warn('failed to start longtask observer', error);
    observer = null;
  }
}

/** Stop observing (test/teardown use). */
export function stop(): void {
  observer?.disconnect();
  observer = null;
  lastReportedAt = 0;
  getLoadContext = null;
}

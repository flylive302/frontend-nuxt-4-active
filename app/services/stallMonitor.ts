/**
 * Main-thread Stall Monitor (client-session-stability 03)
 *
 * Watches the main thread for tasks long enough that the user feels them as a
 * freeze, and reports each one **named and phased**: which work stalled, on
 * which route, in which part of the page's life, on which device tier.
 *
 * Replaces `giftStallMonitor` (msab-load-stability 11). That version tagged
 * every report `source: 'gift-stall-monitor'` and attached gift-queue context
 * unconditionally, so a stall on `/profile` with an empty gift queue still
 * pointed triage at gift code. The observer is global; the tag was not. This
 * version never attributes without evidence — see `utils/stall-telemetry.ts`.
 *
 * Instrument preference: `long-animation-frame` when the engine has it, because
 * it carries `scripts[]` with source URLs and function names — the only browser
 * signal that can actually name the stalling work. Falls back to `longtask`,
 * whose `attribution[]` is almost always a contentless `containerType: 'window'`
 * and therefore usually resolves to `unattributed`. Which instrument produced a
 * report rides every event, so "we could not attribute" stays distinguishable
 * from "this WebView cannot attribute".
 *
 * INFRA/REACT only: no queue mutation, no UI. Read-only context is injected by
 * the caller so this service stays store-free (services rule: no store imports).
 */
import * as Sentry from '@sentry/nuxt';
import { createLogger } from '~/utils/logger';
import { classifyDeviceClass, readDeviceCapabilities, type DeviceClass } from '~/utils/device-class';
import {
  activeWorkTag,
  resolveRouteAt,
  resolveStallAttribution,
  resolveStallPhase,
  stallBlockingMs,
  stallDurationBucket,
  stallThresholdFor,
  type RouteMark,
  type StallContainerLike,
  type StallInstrument,
  type StallPhase,
  type StallScriptLike,
} from '~/utils/stall-telemetry';
import { STALL_REPORT_THROTTLE_MS } from '~/constants/telemetry';

const log = createLogger('[StallMonitor]');

/** Sentry message. Distinct from the old one on purpose — see module header. */
const STALL_MESSAGE = 'Main-thread stall';

/**
 * Read-only context providers, injected so the service imports no stores.
 *
 * Every provider is optional; a missing one degrades a single tag rather than
 * suppressing the report. Telemetry that can fail to fire is worse than
 * telemetry with a gap in it.
 */
export interface StallMonitorDeps {
  /** `performance.now()` at Vue app mount, or `null` before it. */
  appMountedAt?: () => number | null;
  /** Route changes so far, ascending by time. */
  routeTimeline?: () => readonly RouteMark[];
  /** Subsystems busy right now — correlation only, never used as attribution. */
  activeWork?: () => string[];
  /** Numeric load context merged into `extra`. Never promoted to a tag. */
  sampledExtra?: () => Record<string, unknown>;
  /** Overrides the internally classified device tier (tests). */
  deviceClass?: DeviceClass;
}

/** One reportable stall: the winning entry for a phase, plus its blocking cost. */
interface PhasedStall {
  phase: StallPhase;
  entry: StallEntry;
  blockingMs: number;
}

/** Minimal shape of a `long-animation-frame` entry (not in lib.dom yet). */
interface LongAnimationFrameEntryLike extends PerformanceEntry {
  blockingDuration?: number;
  scripts?: StallScriptLike[];
}

/** Minimal shape of a `longtask` entry (not in lib.dom yet). */
interface LongTaskEntryLike extends PerformanceEntry {
  attribution?: StallContainerLike[];
}

type StallEntry = LongAnimationFrameEntryLike & LongTaskEntryLike;

let observer: PerformanceObserver | null = null;
let instrument: StallInstrument | null = null;
let threshold = 0;
let deviceClass: DeviceClass = 'unknown';
let deps: StallMonitorDeps = {};

/**
 * Last report time per lifecycle phase.
 *
 * Keyed per phase rather than globally: one shared bucket lets a cold-boot
 * storm consume the only allowed report and silently drop in-session stalls for
 * the rest of the window, which would defeat the separation this instrument
 * exists to provide.
 */
const lastReportedAt = new Map<StallPhase, number>();

/**
 * Report one stall, throttled per phase. Fingerprinted per phase so cold boot
 * and in-session land in separate Sentry issues rather than one mixed stream.
 */
function reportStall({ phase, entry, blockingMs }: PhasedStall): void {
  const now = Date.now();
  if (now - (lastReportedAt.get(phase) ?? 0) < STALL_REPORT_THROTTLE_MS) return;
  lastReportedAt.set(phase, now);

  const timeline = deps.routeTimeline?.() ?? [];
  const activeWork = safeActiveWork();
  const attribution = resolveStallAttribution({
    scripts: entry.scripts,
    containers: entry.attribution,
  });

  Sentry.captureMessage(STALL_MESSAGE, {
    level: 'warning',
    fingerprint: ['main-thread-stall', phase],
    tags: {
      'stall.phase': phase,
      'stall.route': resolveRouteAt(entry.startTime, timeline),
      'stall.attribution': attribution,
      'stall.active_work': activeWorkTag(activeWork),
      'stall.instrument': instrument ?? 'longtask',
      'stall.device_class': deviceClass,
      'stall.threshold_ms': String(threshold),
      'stall.duration_bucket': stallDurationBucket(blockingMs),
    },
    extra: {
      blockingMs: Math.round(blockingMs),
      durationMs: Math.round(entry.duration),
      blockingDurationMs:
        typeof entry.blockingDuration === 'number' ? Math.round(entry.blockingDuration) : null,
      entryStartTimeMs: Math.round(entry.startTime),
      appMountedAtMs: deps.appMountedAt?.() ?? null,
      activeWork,
      // Numeric load context — never a tag. The original gift-burst freeze was
      // diagnosed off this number, and keeping it costs nothing now that it can
      // no longer masquerade as attribution.
      ...safeSampledExtra(),
      scripts: entry.scripts?.slice(0, 5) ?? null,
      containers: entry.attribution?.slice(0, 5) ?? null,
    },
  });
}

/** Extra-context sampling must never be the reason a stall goes unreported. */
function safeSampledExtra(): Record<string, unknown> {
  try {
    return deps.sampledExtra?.() ?? {};
  } catch (error) {
    log.warn('extra-context sampler threw', error);
    return {};
  }
}

/** Active-work sampling must never be the reason a stall goes unreported. */
function safeActiveWork(): string[] {
  try {
    return deps.activeWork?.() ?? [];
  } catch (error) {
    log.warn('active-work sampler threw', error);
    return [];
  }
}

/**
 * Handle a batch of entries.
 *
 * Keeps the longest qualifying entry **per phase** rather than one winner
 * overall: with `buffered: true` a single callback can carry cold-boot and
 * in-session tasks together, and collapsing them would lose exactly the
 * distinction being measured. The entry itself is retained (not just its
 * duration) because phase, route, and attribution all derive from it.
 */
function handleEntries(list: PerformanceObserverEntryList): void {
  const appMountedAt = deps.appMountedAt?.() ?? null;
  const worstByPhase = new Map<StallPhase, PhasedStall>();

  for (const raw of list.getEntries()) {
    const entry = raw as StallEntry;
    const blockingMs = stallBlockingMs(entry);
    if (blockingMs < threshold) continue;

    const phase = resolveStallPhase(entry.startTime, appMountedAt);
    const current = worstByPhase.get(phase);
    if (!current || blockingMs > current.blockingMs) {
      worstByPhase.set(phase, { phase, entry, blockingMs });
    }
  }

  for (const stall of worstByPhase.values()) reportStall(stall);
}

/** Pick the richest instrument this engine supports. */
function pickInstrument(): StallInstrument | null {
  const supported = PerformanceObserver.supportedEntryTypes;
  if (supported?.includes('long-animation-frame')) return 'long-animation-frame';
  if (supported?.includes('longtask')) return 'longtask';
  return null;
}

/**
 * Start observing. No-op (with a dev-only log) on engines with neither
 * instrument (Safari) or when already started.
 */
export function init(injected: StallMonitorDeps = {}): void {
  if (observer) return;
  deps = injected;

  if (typeof PerformanceObserver === 'undefined') return;

  instrument = pickInstrument();
  if (!instrument) {
    log.debug('no long-task instrument available, stall monitor disabled');
    return;
  }

  deviceClass = injected.deviceClass ?? classifyDeviceClass(readDeviceCapabilities());
  threshold = stallThresholdFor(deviceClass);

  try {
    observer = new PerformanceObserver(handleEntries);
    observer.observe({ type: instrument, buffered: true });
  } catch (error) {
    log.warn('failed to start stall observer', error);
    observer = null;
    instrument = null;
  }
}

/** Stop observing (test/teardown use). */
export function stop(): void {
  observer?.disconnect();
  observer = null;
  instrument = null;
  threshold = 0;
  deviceClass = 'unknown';
  deps = {};
  lastReportedAt.clear();
}

/**
 * Main-thread stall telemetry — pure shaping helpers (client-session-stability 03).
 *
 * Everything here is a pure function so the attribution and phase rules can be
 * unit-tested without a browser, a Sentry client, or a `PerformanceObserver`.
 * The observer itself lives in `services/stallMonitor.ts`.
 *
 * The rules this file encodes exist because the previous instrument lied: it
 * tagged every stall `source: 'gift-stall-monitor'` regardless of cause, so the
 * tag named the *reporter*, not the culprit. Attribution here is either real
 * (the browser told us) or explicitly `unattributed` — never a default guess.
 */
import type { DeviceClass } from '~/utils/device-class';
import {
  STALL_ACTIVE_WORK_MAX,
  STALL_ATTRIBUTION_MAX_CHARS,
  STALL_DURATION_BUCKETS,
  STALL_DURATION_OVERFLOW_LABEL,
  STALL_HYDRATION_SETTLE_MS,
  STALL_THRESHOLD_HIGH_MS,
  STALL_THRESHOLD_LOW_MS,
  STALL_THRESHOLD_MID_MS,
  STALL_THRESHOLD_UNKNOWN_MS,
} from '~/constants/telemetry';

/**
 * Which part of the page's life the stall happened in.
 *
 * Separating these is the point of the ticket: cold-boot cost and in-session
 * cost are different problems, and one Sentry issue containing both is not
 * actionable data.
 */
export type StallPhase = 'cold-boot' | 'hydration' | 'in-session';

/**
 * Which browser instrument produced the report. Recorded on every event so
 * "unattributed" (the browser had no call stack) stays distinguishable from
 * "old WebView" (the instrument that carries call stacks was unavailable).
 */
export type StallInstrument = 'long-animation-frame' | 'longtask';

/** Route label for entries that started before the first navigation resolved. */
export const PRE_ROUTE_LABEL = 'pre-route';

/** Attribution label when the browser gave us nothing to name. */
export const UNATTRIBUTED_LABEL = 'unattributed';

/** Active-work label when no tracked subsystem was busy. */
export const NO_ACTIVE_WORK_LABEL = 'none';

/** A route becoming active at a `performance.now()` timestamp. */
export interface RouteMark {
  at: number;
  pattern: string;
}

/**
 * One entry from `PerformanceLongAnimationFrameTiming.scripts` — the only
 * instrument that carries anything resembling a call stack.
 */
export interface StallScriptLike {
  sourceURL?: string;
  sourceFunctionName?: string;
  invoker?: string;
  invokerType?: string;
  duration?: number;
}

/** One entry from `PerformanceLongTaskTiming.attribution`. */
export interface StallContainerLike {
  containerType?: string;
  containerName?: string;
  containerId?: string;
  containerSrc?: string;
}

/**
 * Resolve the reportable threshold for a device tier.
 *
 * See `constants/telemetry.ts` for why these are tiered rather than flat.
 */
export function stallThresholdFor(deviceClass: DeviceClass): number {
  switch (deviceClass) {
    case 'low':
      return STALL_THRESHOLD_LOW_MS;
    case 'mid':
      return STALL_THRESHOLD_MID_MS;
    case 'high':
      return STALL_THRESHOLD_HIGH_MS;
    default:
      return STALL_THRESHOLD_UNKNOWN_MS;
  }
}

/** The duration fields a stall entry may carry, whichever instrument produced it. */
export interface StallDurationLike {
  duration: number;
  blockingDuration?: number;
}

/**
 * How long the main thread was actually blocked — the quantity the threshold
 * gates on and the bucket describes.
 *
 * The two instruments do not mean the same thing by `duration`. A `longtask`
 * entry's duration is the task itself, so it *is* blocking time. A Long
 * Animation Frame's duration runs from frame start to presentation, spanning
 * several tasks and the idle gaps between them — a 400ms LoAF can contain 60ms
 * of real blocking.
 *
 * Gating both on `duration` would admit far more LoAF events than longtask
 * events for the same user-perceived stall. Worse, LoAF availability tracks
 * WebView age, which tracks device tier — the very axis the tiered threshold
 * exists to measure — so the two errors would compound rather than cancel.
 * `blockingDuration` is LoAF's own answer to this; `longtask` has no such field
 * and falls through to its (already blocking) duration.
 */
export function stallBlockingMs(entry: StallDurationLike): number {
  return typeof entry.blockingDuration === 'number' ? entry.blockingDuration : entry.duration;
}

/**
 * Which phase an entry belongs to, derived from the **entry's own start time**
 * — never from the report time.
 *
 * `buffered: true` replays tasks recorded before the observer was created, so a
 * cold-boot task can surface in a callback that fires well into the session.
 * Deriving phase from `Date.now()` at report time would label every one of them
 * with whatever phase the app happens to be in, which is the same class of lie
 * this ticket exists to remove.
 *
 * @param entryStartTime `performance.now()`-relative start of the long task.
 * @param appMountedAt   `performance.now()` at Vue app mount, or `null` before it.
 */
export function resolveStallPhase(entryStartTime: number, appMountedAt: number | null): StallPhase {
  if (appMountedAt === null || entryStartTime < appMountedAt) return 'cold-boot';
  if (entryStartTime < appMountedAt + STALL_HYDRATION_SETTLE_MS) return 'hydration';
  return 'in-session';
}

/**
 * Which route was active when the entry started.
 *
 * Returns `PRE_ROUTE_LABEL` when the entry predates the first navigation. That
 * is a wanted value, not a failure: the untagged share of the existing longtask
 * volume is consistent with pre-route-resolution cold start, and naming it
 * makes that share countable.
 */
export function resolveRouteAt(entryStartTime: number, timeline: readonly RouteMark[]): string {
  let pattern = PRE_ROUTE_LABEL;

  for (const mark of timeline) {
    if (mark.at > entryStartTime) break;
    pattern = mark.pattern;
  }

  return pattern;
}

/**
 * Name the stalling work from Long Animation Frame script attribution.
 *
 * Prefers the function name; falls back to the script's file name. Returns
 * `null` when the browser supplied neither — the caller reports `unattributed`
 * rather than inventing a source.
 */
export function attributeFromScripts(scripts: readonly StallScriptLike[] | undefined): string | null {
  if (!scripts?.length) return null;

  const longest = scripts.reduce((best, script) =>
    (script.duration ?? 0) > (best.duration ?? 0) ? script : best,
  );

  const label = longest.sourceFunctionName?.trim() || fileNameOf(longest.sourceURL);
  if (!label) return null;

  const invoker = longest.invokerType?.trim();
  return truncate(invoker ? `${label} (${invoker})` : label, STALL_ATTRIBUTION_MAX_CHARS);
}

/**
 * Name the stalling work from `longtask` container attribution.
 *
 * In practice this is `containerType: 'window'` with empty names — the same
 * document, no call stack — which carries no information and must therefore
 * resolve to `null`, not to a plausible-looking label.
 */
export function attributeFromContainers(
  containers: readonly StallContainerLike[] | undefined,
): string | null {
  if (!containers?.length) return null;

  for (const container of containers) {
    const name = container.containerName?.trim() || container.containerId?.trim();
    if (name) return truncate(`${container.containerType ?? 'container'}:${name}`, STALL_ATTRIBUTION_MAX_CHARS);

    const src = fileNameOf(container.containerSrc);
    if (src) return truncate(`${container.containerType ?? 'container'}:${src}`, STALL_ATTRIBUTION_MAX_CHARS);
  }

  return null;
}

/**
 * Final attribution label for the report.
 *
 * Deliberately does **not** fall back to the active-work sample. Active work is
 * correlation — "these subsystems were busy" — and folding it in here would
 * recreate the original defect in a new costume. It rides its own tag.
 */
export function resolveStallAttribution(input: {
  scripts?: readonly StallScriptLike[];
  containers?: readonly StallContainerLike[];
}): string {
  return attributeFromScripts(input.scripts) ?? attributeFromContainers(input.containers) ?? UNATTRIBUTED_LABEL;
}

/**
 * Collapse the active-work sample into a bounded, sorted tag value so the same
 * set of busy subsystems always produces the same tag.
 */
export function activeWorkTag(activeWork: readonly string[]): string {
  const labels = [...new Set(activeWork.filter(Boolean))].sort();
  if (labels.length === 0) return NO_ACTIVE_WORK_LABEL;

  const shown = labels.slice(0, STALL_ACTIVE_WORK_MAX);
  const overflow = labels.length - shown.length;
  return overflow > 0 ? `${shown.join('+')}+${overflow}more` : shown.join('+');
}

/** Bucket a stall duration for tag use. Raw ms belongs in `extra`. */
export function stallDurationBucket(durationMs: number): string {
  for (const bucket of STALL_DURATION_BUCKETS) {
    if (durationMs < bucket.maxMs) return bucket.label;
  }
  return STALL_DURATION_OVERFLOW_LABEL;
}

/** Last path segment of a URL, without query or hash. Empty string when absent. */
function fileNameOf(url: string | undefined): string {
  if (!url) return '';
  const withoutQuery = url.split(/[?#]/)[0] ?? '';
  const segments = withoutQuery.split('/');
  return segments[segments.length - 1] ?? '';
}

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

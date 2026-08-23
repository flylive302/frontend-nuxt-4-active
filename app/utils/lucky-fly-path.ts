/**
 * Lucky fly path — pure timeline math for one flying gift thumbnail.
 *
 * Reproduces the five-phase Web Animations keyframes the old per-<img> fly
 * used (appear → pop → center → hold → land → vanish) as a sampling function,
 * so the canvas renderer draws the exact same motion. No DOM, no Vue — safe
 * to run inside a worker.
 */

export interface FlyPoint {
  readonly x: number;
  readonly y: number;
}

export interface FlyPath {
  readonly start: FlyPoint;
  readonly center: FlyPoint;
  readonly end: FlyPoint;
}

export interface FlySample {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly opacity: number;
}

interface Keyframe {
  readonly at: number;
  readonly point: FlyPoint;
  readonly scale: number;
  readonly opacity: number;
}

export interface FlyTimeline {
  readonly totalMs: number;
  readonly keyframes: readonly Keyframe[];
}

/**
 * Build the keyframe timeline. Fractions 0/.15/.5/.85/1 span `durationMs`;
 * the center hold is inserted at the midpoint and extends the total.
 */
export function buildFlyTimeline(path: FlyPath, durationMs: number, holdMs: number): FlyTimeline {
  const totalMs = durationMs + holdMs;
  const at = (fraction: number, extra = 0): number => (fraction * durationMs + extra) / totalMs;
  return {
    totalMs,
    keyframes: [
      { at: 0, point: path.start, scale: 0.2, opacity: 0 },
      { at: at(0.15), point: path.start, scale: 1.1, opacity: 1 },
      { at: at(0.5), point: path.center, scale: 1.3, opacity: 1 },
      { at: at(0.5, holdMs), point: path.center, scale: 1.3, opacity: 1 },
      { at: at(0.85, holdMs), point: path.end, scale: 0.9, opacity: 1 },
      { at: 1, point: path.end, scale: 0.2, opacity: 0 },
    ],
  };
}

/**
 * Cubic-bezier easing (CSS semantics: P0=(0,0), P3=(1,1)). Solved by a few
 * Newton iterations — plenty for animation precision.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const ax = 1 - 3 * x2 + 3 * x1;
  const bx = 3 * x2 - 6 * x1;
  const cx = 3 * x1;
  const ay = 1 - 3 * y2 + 3 * y1;
  const by = 3 * y2 - 6 * y1;
  const cy = 3 * y1;
  const sampleX = (t: number): number => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number): number => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number): number => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number): number => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const err = sampleX(t) - x;
      const slope = slopeX(t);
      if (Math.abs(err) < 1e-5 || slope === 0) break;
      t -= err / slope;
    }
    return sampleY(Math.min(1, Math.max(0, t)));
  };
}

/** Parse `cubic-bezier(a, b, c, d)`; anything else falls back to linear. */
export function parseEasing(css: string): (t: number) => number {
  const match = /cubic-bezier\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/.exec(css);
  if (!match) return (t) => t;
  return cubicBezier(Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4]));
}

/**
 * Sample the timeline at `elapsedMs`. Easing applies per keyframe interval,
 * matching Web Animations' default keyframe easing behaviour.
 */
export function sampleFly(timeline: FlyTimeline, elapsedMs: number, ease: (t: number) => number): FlySample {
  const { keyframes, totalMs } = timeline;
  const progress = Math.min(1, Math.max(0, elapsedMs / totalMs));
  const last = keyframes[keyframes.length - 1]!;
  if (progress >= 1) return { x: last.point.x, y: last.point.y, scale: last.scale, opacity: last.opacity };

  let i = 0;
  while (i < keyframes.length - 2 && keyframes[i + 1]!.at <= progress) i++;
  const a = keyframes[i]!;
  const b = keyframes[i + 1]!;
  const span = b.at - a.at;
  const local = span <= 0 ? 1 : ease((progress - a.at) / span);
  const lerp = (from: number, to: number): number => from + (to - from) * local;
  return {
    x: lerp(a.point.x, b.point.x),
    y: lerp(a.point.y, b.point.y),
    scale: lerp(a.scale, b.scale),
    opacity: lerp(a.opacity, b.opacity),
  };
}

/**
 * Launch pacing for a backlog: the normal stagger, compressed so the whole
 * backlog drains within `maxStreamMs`. Never returns less than 0.
 */
export function launchIntervalMs(backlog: number, staggerMs: number, maxStreamMs: number): number {
  if (backlog <= 1) return staggerMs;
  return Math.max(0, Math.min(staggerMs, maxStreamMs / backlog));
}

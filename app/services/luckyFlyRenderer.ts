/**
 * Lucky fly renderer — draws every lucky gift fly on ONE 2D canvas.
 *
 * Why: a lucky combo fans out one fly per recipient per tap. As individual
 * <img> elements with Web Animations, a 500-tap burst meant ~1,500 DOM nodes,
 * compositor layers and forced layouts, which jammed low-end phones long
 * enough to miss the socket heartbeat. Here a fly is a plain object; a frame
 * is a loop of `drawImage` calls.
 *
 * Worker-ready: this class touches only a 2D context, `CanvasImageSource`s
 * and numbers. Hand it an `OffscreenCanvas` context plus a fetch-based image
 * loader and it runs unchanged inside a Web Worker (the planned "B flip").
 * It must never import Vue, stores, or query the DOM.
 */
import {
  buildFlyTimeline,
  launchIntervalMs,
  parseEasing,
  sampleFly,
  type FlyPath,
  type FlyTimeline,
} from '~/utils/lucky-fly-path';

type Fly2DContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Resolves a thumbnail URL to something `drawImage` accepts. */
export type FlyImageLoader = (url: string) => Promise<CanvasImageSource>;

export interface LuckyFlyRendererOptions {
  readonly ctx: Fly2DContext;
  readonly loadImage: FlyImageLoader;
  /** Thumbnail box size in CSS px (drawn centred on the path point). */
  readonly thumbnailSize: number;
  readonly durationMs: number;
  readonly holdMs: number;
  readonly easing: string;
  readonly staggerMs: number;
  readonly maxStreamMs: number;
  readonly jitterPx: number;
}

export interface FlyRequest {
  readonly thumbnailUrl: string;
  readonly path: FlyPath;
}

interface ActiveFly {
  readonly url: string;
  readonly timeline: FlyTimeline;
  readonly startedAt: number;
}

const CLEAR_RESERVE_PX = 8;

export class LuckyFlyRenderer {
  private readonly ctx: Fly2DContext;
  private readonly loadImage: FlyImageLoader;
  private readonly opts: LuckyFlyRendererOptions;
  private readonly ease: (t: number) => number;
  private readonly images = new Map<string, CanvasImageSource>();
  private readonly loading = new Set<string>();
  private readonly pending: FlyRequest[] = [];
  private active: ActiveFly[] = [];
  private lastLaunchAt = -Infinity;
  /** Current launch gap. Shrinks as a burst's backlog grows; resets when drained. */
  private burstInterval: number;
  private width = 0;
  private height = 0;
  private dpr = 1;

  constructor(opts: LuckyFlyRendererOptions) {
    this.ctx = opts.ctx;
    this.loadImage = opts.loadImage;
    this.opts = opts;
    this.ease = parseEasing(opts.easing);
    this.burstInterval = opts.staggerMs;
  }

  /** CSS-pixel viewport size; the backing store is scaled by `dpr`. */
  resize(width: number, height: number, dpr: number): void {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.ctx.canvas.width = Math.round(width * dpr);
    this.ctx.canvas.height = Math.round(height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** Queue a fly. Never rejects, never drops — pacing is handled in `tick`. */
  enqueue(request: FlyRequest): void {
    this.pending.push(request);
    // Compress for the whole burst, sized by its peak backlog — recomputing
    // per remaining item would stretch the tail back out past the budget.
    this.burstInterval = Math.min(
      this.burstInterval,
      launchIntervalMs(this.pending.length, this.opts.staggerMs, this.opts.maxStreamMs),
    );
    this.ensureImage(request.thumbnailUrl);
  }

  /** True while there is anything to launch or draw. */
  hasWork(): boolean {
    return this.pending.length > 0 || this.active.length > 0;
  }

  /** Backlog + in-flight count (for diagnostics/tests). */
  get queued(): number {
    return this.pending.length;
  }

  get inFlight(): number {
    return this.active.length;
  }

  /**
   * Advance to `now` (ms, monotonic) and redraw. Launches as many pending
   * flies as the compressed stagger allows, retires finished ones, draws the
   * rest. Returns `hasWork()` so the caller can stop its frame loop.
   */
  tick(now: number): boolean {
    this.launchDue(now);
    this.ctx.clearRect(-CLEAR_RESERVE_PX, -CLEAR_RESERVE_PX, this.width + CLEAR_RESERVE_PX * 2, this.height + CLEAR_RESERVE_PX * 2);

    const size = this.opts.thumbnailSize;
    const survivors: ActiveFly[] = [];
    for (const fly of this.active) {
      const elapsed = now - fly.startedAt;
      if (elapsed >= fly.timeline.totalMs) continue;
      survivors.push(fly);
      const image = this.images.get(fly.url);
      if (!image) continue;
      const s = sampleFly(fly.timeline, elapsed, this.ease);
      if (s.opacity <= 0) continue;
      const drawSize = size * s.scale;
      this.ctx.globalAlpha = s.opacity;
      this.ctx.drawImage(image, s.x - drawSize / 2, s.y - drawSize / 2, drawSize, drawSize);
    }
    this.ctx.globalAlpha = 1;
    this.active = survivors;
    return this.hasWork();
  }

  /** Drop everything (component unmount). */
  clear(): void {
    this.pending.length = 0;
    this.active = [];
    this.burstInterval = this.opts.staggerMs;
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  private launchDue(now: number): void {
    const interval = this.burstInterval;
    while (this.pending.length > 0) {
      const due = this.lastLaunchAt + interval;
      if (due > now) break;
      const request = this.pending.shift()!;
      // Virtual launch clock: catch up at most one interval behind `now`, so a
      // sub-frame interval launches several per frame but never snowballs.
      this.lastLaunchAt = Number.isFinite(this.lastLaunchAt) ? Math.max(due, now - interval) : now;
      this.active.push({
        url: request.thumbnailUrl,
        timeline: buildFlyTimeline(this.jitter(request.path), this.opts.durationMs, this.opts.holdMs),
        startedAt: now,
      });
    }
    if (this.pending.length === 0) this.burstInterval = this.opts.staggerMs;
  }

  private jitter(path: FlyPath): FlyPath {
    const j = this.opts.jitterPx;
    if (j <= 0) return path;
    const off = (): number => (Math.random() * 2 - 1) * j;
    return {
      start: path.start,
      center: { x: path.center.x + off(), y: path.center.y + off() },
      end: { x: path.end.x + off() * 0.5, y: path.end.y + off() * 0.5 },
    };
  }

  private ensureImage(url: string): void {
    if (this.images.has(url) || this.loading.has(url)) return;
    this.loading.add(url);
    this.loadImage(url)
      .then((image) => {
        this.images.set(url, image);
      })
      .catch(() => {
        /* REACT: a missing thumbnail just draws nothing — the fly still paces the stream */
      })
      .finally(() => {
        this.loading.delete(url);
      });
  }
}

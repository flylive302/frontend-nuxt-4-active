/**
 * android-client-performance/15 — port of svga@2.1.1 render path so we can
 * pre-scale the context; keep in sync if the lib is upgraded.
 *
 * Small SVGA players (avatar frames, 44–66 css px) still draw at full entity
 * resolution (e.g. 413×413) because the lib's `drawFrame` always renders an
 * offscreen canvas at entity size then `drawImage`s it 1:1. This module lets
 * a caller draw directly onto a context pre-scaled to the display size,
 * skipping the offscreen canvas entirely.
 *
 * The sprite-drawing functions below (`drawSprite`, `drawShape`, `drawBezier`,
 * `drawBezierElement`, `drawEllipse`, `drawRect`, `resetShapeStyles`) are a
 * faithful 1:1 port of svga@2.1.1's minified render functions. Do not
 * "improve" the math — only the entry point (drawing straight onto a
 * pre-scaled ctx instead of an offscreen canvas) differs from the original.
 */

// ---- Minimal entity/sprite/frame shapes we touch ----

export interface SvgaTransform {
  a?: number;
  b?: number;
  c?: number;
  d?: number;
  tx?: number;
  ty?: number;
}

export interface SvgaRect {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface SvgaMovieStyles {
  fill: string | null;
  stroke: string | null;
  strokeWidth: number | null;
  lineCap: CanvasLineCap | null;
  lineJoin: CanvasLineJoin | null;
  miterLimit: number | null;
  lineDash: number[] | null;
}

export interface SvgaShapePath {
  d?: string;
}

export interface SvgaMaskPath {
  d: string;
  transform?: SvgaTransform;
  styles: SvgaMovieStyles;
}

export type SvgaShapeType = 'shape' | 'ellipse' | 'rect';

export interface SvgaShape {
  type: SvgaShapeType;
  path: {
    d?: string;
    x?: number;
    y?: number;
    radiusX?: number;
    radiusY?: number;
    width?: number;
    height?: number;
    cornerRadius?: number;
  };
  styles: SvgaMovieStyles;
  transform?: SvgaTransform;
}

export interface SvgaFrame {
  alpha: number;
  transform: SvgaTransform | null;
  layout: { width: number; height: number };
  maskPath: SvgaMaskPath | null;
  shapes: SvgaShape[];
}

export interface SvgaSprite {
  imageKey: string;
  frames: SvgaFrame[];
}

export type SvgaBitmap = HTMLImageElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas;

export interface SvgaVideoEntity {
  size: { width: number; height: number };
  sprites: SvgaSprite[];
}

export type BitmapsCache = Record<string, SvgaBitmap>;
export type ReplaceElements = Record<string, SvgaBitmap>;
export type DynamicElements = Record<string, SvgaBitmap>;

// A minimal 2D-context surface the render path needs. `CanvasRenderingContext2D`
// satisfies this; tests use a lightweight recording fake instead.
export interface Scaled2DContext {
  save(): void;
  restore(): void;
  clip(): void;
  fill(): void;
  stroke(): void;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void;
  transform(a: number, b: number, c: number, d: number, tx: number, ty: number): void;
  setTransform(a: number, b: number, c: number, d: number, tx: number, ty: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  drawImage(image: CanvasImageSource, dx: number, dy: number, dw: number, dh: number): void;
  setLineDash(segments: number[]): void;
  globalAlpha: number;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  fillStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  miterLimit: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
}

// ---- computeScaledSize ----

export interface ComputeScaledSizeArgs {
  cssWidth: number;
  dpr: number;
  entityWidth: number;
  entityHeight: number;
}

export interface ScaledSize {
  width: number;
  height: number;
  scale: number;
}

/**
 * Returns the target device-pixel canvas size for a display box smaller than
 * the entity, or null when the lib's default 1:1 behaviour should be kept
 * (hidden container with cssWidth 0, or a display box that isn't smaller
 * than the entity — e.g. full-screen gift players).
 */
/**
 * Chromium only GPU-accelerates a 2D canvas whose backing-store area is at
 * least 257×256 px (`kMinimumAccelerated2dCanvasSize`). A smaller canvas is
 * software-rasterised and repainted with its containing layer — measured
 * 2026-09-23 (Oppo A6x): 133×133 frame canvases turned `Paint` from 0.8 s to
 * 27 s per minute, repainting the full 720×1570 root every frame. So the
 * scaled size never drops below this area.
 */
export const MIN_ACCELERATED_CANVAS_AREA = 257 * 256;

export function computeScaledSize({
  cssWidth,
  dpr,
  entityWidth,
  entityHeight
}: ComputeScaledSizeArgs): ScaledSize | null {
  if (!(cssWidth > 0) || !(entityWidth > 0) || !(entityHeight > 0)) return null;
  const cappedDpr = Math.min(dpr || 1, 2);
  let scale = (cssWidth * cappedDpr) / entityWidth;
  const minScale = Math.sqrt(MIN_ACCELERATED_CANVAS_AREA / (entityWidth * entityHeight));
  if (scale < minScale) scale = minScale;
  const targetW = Math.ceil(entityWidth * scale);
  if (targetW >= entityWidth) return null;
  const targetH = Math.ceil(entityHeight * scale);
  return { width: targetW, height: targetH, scale: targetW / entityWidth };
}

// ---- ported render functions (1:1 with svga@2.1.1) ----

const VALID_BEZIER_METHODS = 'MLHVCSQRZmlhvcsqrz';

interface BezierCursor {
  x: number;
  y: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function drawBezierElement(
  ctx: Scaled2DContext,
  cur: BezierCursor,
  method: string,
  args: string[]
): void {
  switch (method) {
    case 'M':
      cur.x = Number(args[0]);
      cur.y = Number(args[1]);
      ctx.moveTo(cur.x, cur.y);
      break;
    case 'm':
      cur.x += Number(args[0]);
      cur.y += Number(args[1]);
      ctx.moveTo(cur.x, cur.y);
      break;
    case 'L':
      cur.x = Number(args[0]);
      cur.y = Number(args[1]);
      ctx.lineTo(cur.x, cur.y);
      break;
    case 'l':
      cur.x += Number(args[0]);
      cur.y += Number(args[1]);
      ctx.lineTo(cur.x, cur.y);
      break;
    case 'H':
      cur.x = Number(args[0]);
      ctx.lineTo(cur.x, cur.y);
      break;
    case 'h':
      cur.x += Number(args[0]);
      ctx.lineTo(cur.x, cur.y);
      break;
    case 'V':
      cur.y = Number(args[0]);
      ctx.lineTo(cur.x, cur.y);
      break;
    case 'v':
      cur.y += Number(args[0]);
      ctx.lineTo(cur.x, cur.y);
      break;
    case 'C':
      cur.x1 = Number(args[0]);
      cur.y1 = Number(args[1]);
      cur.x2 = Number(args[2]);
      cur.y2 = Number(args[3]);
      cur.x = Number(args[4]);
      cur.y = Number(args[5]);
      ctx.bezierCurveTo(cur.x1, cur.y1, cur.x2, cur.y2, cur.x, cur.y);
      break;
    case 'c':
      cur.x1 = cur.x + Number(args[0]);
      cur.y1 = cur.y + Number(args[1]);
      cur.x2 = cur.x + Number(args[2]);
      cur.y2 = cur.y + Number(args[3]);
      cur.x += Number(args[4]);
      cur.y += Number(args[5]);
      ctx.bezierCurveTo(cur.x1, cur.y1, cur.x2, cur.y2, cur.x, cur.y);
      break;
    case 'S':
      if (cur.x1 !== undefined && cur.y1 !== undefined && cur.x2 !== undefined && cur.y2 !== undefined) {
        cur.x1 = cur.x - cur.x2 + cur.x;
        cur.y1 = cur.y - cur.y2 + cur.y;
        cur.x2 = Number(args[0]);
        cur.y2 = Number(args[1]);
        cur.x = Number(args[2]);
        cur.y = Number(args[3]);
        ctx.bezierCurveTo(cur.x1, cur.y1, cur.x2, cur.y2, cur.x, cur.y);
      } else {
        cur.x1 = Number(args[0]);
        cur.y1 = Number(args[1]);
        cur.x = Number(args[2]);
        cur.y = Number(args[3]);
        ctx.quadraticCurveTo(cur.x1, cur.y1, cur.x, cur.y);
      }
      break;
    case 's':
      if (cur.x1 !== undefined && cur.y1 !== undefined && cur.x2 !== undefined && cur.y2 !== undefined) {
        cur.x1 = cur.x - cur.x2 + cur.x;
        cur.y1 = cur.y - cur.y2 + cur.y;
        cur.x2 = cur.x + Number(args[0]);
        cur.y2 = cur.y + Number(args[1]);
        cur.x += Number(args[2]);
        cur.y += Number(args[3]);
        ctx.bezierCurveTo(cur.x1, cur.y1, cur.x2, cur.y2, cur.x, cur.y);
      } else {
        cur.x1 = cur.x + Number(args[0]);
        cur.y1 = cur.y + Number(args[1]);
        cur.x += Number(args[2]);
        cur.y += Number(args[3]);
        ctx.quadraticCurveTo(cur.x1, cur.y1, cur.x, cur.y);
      }
      break;
    case 'Q':
      cur.x1 = Number(args[0]);
      cur.y1 = Number(args[1]);
      cur.x = Number(args[2]);
      cur.y = Number(args[3]);
      ctx.quadraticCurveTo(cur.x1, cur.y1, cur.x, cur.y);
      break;
    case 'q':
      cur.x1 = cur.x + Number(args[0]);
      cur.y1 = cur.y + Number(args[1]);
      cur.x += Number(args[2]);
      cur.y += Number(args[3]);
      ctx.quadraticCurveTo(cur.x1, cur.y1, cur.x, cur.y);
      break;
    case 'A':
    case 'a':
      break;
    case 'Z':
    case 'z':
      ctx.closePath();
      break;
    default:
      break;
  }
}

function resetShapeStyles(ctx: Scaled2DContext, styles: SvgaMovieStyles | undefined): void {
  if (styles === undefined) return;
  ctx.strokeStyle = styles.stroke !== null ? styles.stroke : 'transparent';
  if (styles.strokeWidth !== null && styles.strokeWidth > 0) ctx.lineWidth = styles.strokeWidth;
  if (styles.miterLimit !== null && styles.miterLimit > 0) ctx.miterLimit = styles.miterLimit;
  if (styles.lineCap !== null) ctx.lineCap = styles.lineCap;
  if (styles.lineJoin !== null) ctx.lineJoin = styles.lineJoin;
  ctx.fillStyle = styles.fill !== null ? styles.fill : 'transparent';
  if (styles.lineDash !== null) ctx.setLineDash(styles.lineDash);
}

function drawBezier(
  ctx: Scaled2DContext,
  d: string | undefined,
  transform: SvgaTransform | undefined,
  styles: SvgaMovieStyles
): void {
  ctx.save();
  resetShapeStyles(ctx, styles);
  if (transform !== undefined) {
    ctx.transform(
      transform.a ?? 1,
      transform.b ?? 0,
      transform.c ?? 0,
      transform.d ?? 1,
      transform.tx ?? 0,
      transform.ty ?? 0
    );
  }
  const cur: BezierCursor = { x: 0, y: 0, x1: 0, y1: 0, x2: 0, y2: 0 };
  ctx.beginPath();
  (d ?? '')
    .replace(/([a-zA-Z])/g, '|||$1 ')
    .replace(/,/g, ' ')
    .split('|||')
    .forEach((segment) => {
      if (segment.length === 0) return;
      const method = segment.substr(0, 1);
      if (VALID_BEZIER_METHODS.includes(method)) {
        const args = segment.substr(1).trim().split(' ');
        drawBezierElement(ctx, cur, method, args);
      }
    });
  if (styles.fill !== null) ctx.fill();
  if (styles.stroke !== null) ctx.stroke();
  ctx.restore();
}

function drawEllipse(
  ctx: Scaled2DContext,
  x0: number,
  y0: number,
  radiusX: number,
  radiusY: number,
  transform: SvgaTransform | undefined,
  styles: SvgaMovieStyles
): void {
  ctx.save();
  resetShapeStyles(ctx, styles);
  if (transform !== undefined) {
    ctx.transform(transform.a ?? 1, transform.b ?? 0, transform.c ?? 0, transform.d ?? 1, transform.tx ?? 0, transform.ty ?? 0);
  }
  const w = 2 * radiusX;
  const h = 2 * radiusY;
  const kx = (w / 2) * 0.5522848;
  const ky = (h / 2) * 0.5522848;
  const x = x0 - radiusX;
  const y = y0 - radiusY;
  const right = x + w;
  const bottom = y + h;
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.beginPath();
  ctx.moveTo(x, cy);
  ctx.bezierCurveTo(x, cy - ky, cx - kx, y, cx, y);
  ctx.bezierCurveTo(cx + kx, y, right, cy - ky, right, cy);
  ctx.bezierCurveTo(right, cy + ky, cx + kx, bottom, cx, bottom);
  ctx.bezierCurveTo(cx - kx, bottom, x, cy + ky, x, cy);
  if (styles.fill !== null) ctx.fill();
  if (styles.stroke !== null) ctx.stroke();
  ctx.restore();
}

function drawRect(
  ctx: Scaled2DContext,
  x: number,
  y: number,
  width: number,
  height: number,
  cornerRadius: number,
  transform: SvgaTransform | undefined,
  styles: SvgaMovieStyles
): void {
  ctx.save();
  resetShapeStyles(ctx, styles);
  if (transform !== undefined) {
    ctx.transform(transform.a ?? 1, transform.b ?? 0, transform.c ?? 0, transform.d ?? 1, transform.tx ?? 0, transform.ty ?? 0);
  }
  let radius = cornerRadius;
  if (width < 2 * radius) radius = width / 2;
  if (height < 2 * radius) radius = height / 2;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
  if (styles.fill !== null) ctx.fill();
  if (styles.stroke !== null) ctx.stroke();
  ctx.restore();
}

function drawShape(ctx: Scaled2DContext, shape: SvgaShape): void {
  switch (shape.type) {
    case 'shape':
      drawBezier(ctx, shape.path.d, shape.transform, shape.styles);
      break;
    case 'ellipse':
      drawEllipse(
        ctx,
        shape.path.x ?? 0,
        shape.path.y ?? 0,
        shape.path.radiusX ?? 0,
        shape.path.radiusY ?? 0,
        shape.transform,
        shape.styles
      );
      break;
    case 'rect':
      drawRect(
        ctx,
        shape.path.x ?? 0,
        shape.path.y ?? 0,
        shape.path.width ?? 0,
        shape.path.height ?? 0,
        shape.path.cornerRadius ?? 0,
        shape.transform,
        shape.styles
      );
      break;
    default:
      break;
  }
}

function drawSprite(
  ctx: Scaled2DContext,
  sprite: SvgaSprite,
  frameIndex: number,
  bitmap: SvgaBitmap | undefined,
  replaceElement: SvgaBitmap | undefined,
  dynamicElement: SvgaBitmap | undefined
): void {
  const frame = sprite.frames[frameIndex];
  if (!frame || frame.alpha < 0.05) return;
  ctx.save();
  ctx.globalAlpha = frame.alpha;
  const t = frame.transform;
  ctx.transform(t?.a ?? 1, t?.b ?? 0, t?.c ?? 0, t?.d ?? 1, t?.tx ?? 0, t?.ty ?? 0);
  if (bitmap !== undefined) {
    if (frame.maskPath !== null) {
      drawBezier(ctx, frame.maskPath.d, frame.maskPath.transform, frame.maskPath.styles);
      ctx.clip();
    }
    if (replaceElement !== undefined) {
      ctx.drawImage(replaceElement as CanvasImageSource, 0, 0, frame.layout.width, frame.layout.height);
    } else {
      ctx.drawImage(bitmap as CanvasImageSource, 0, 0, frame.layout.width, frame.layout.height);
    }
  }
  if (dynamicElement !== undefined) {
    const w = (dynamicElement as HTMLImageElement | HTMLCanvasElement).width ?? 0;
    const h = (dynamicElement as HTMLImageElement | HTMLCanvasElement).height ?? 0;
    ctx.drawImage(dynamicElement as CanvasImageSource, (frame.layout.width - w) / 2, (frame.layout.height - h) / 2, w, h);
  }
  frame.shapes.forEach((shape) => drawShape(ctx, shape));
  ctx.restore();
}

/**
 * Draws every sprite of `entity` at `frameIndex` directly onto `ctx`, which
 * the caller has already scaled (e.g. via `ctx.setTransform(scale, 0, 0,
 * scale, 0, 0)`). Mirrors the lib's `render()` — no offscreen canvas.
 */
export function renderSpritesScaled(
  ctx: Scaled2DContext,
  entity: SvgaVideoEntity,
  frameIndex: number,
  bitmaps: BitmapsCache,
  replaceElements: ReplaceElements,
  dynamicElements: DynamicElements
): void {
  entity.sprites.forEach((sprite) => {
    const bitmap = bitmaps[sprite.imageKey];
    const replaceElement = replaceElements[sprite.imageKey];
    const dynamicElement = dynamicElements[sprite.imageKey];
    drawSprite(ctx, sprite, frameIndex, bitmap, replaceElement, dynamicElement);
  });
}

// ---- drawFrameScaled: pure frame-draw step, bindable to a real Player ----

/** A canvas-like container: only the sizing fields the draw step touches. */
export interface ScaledContainer {
  width: number;
  height: number;
}

export interface DrawFrameScaledArgs {
  container: ScaledContainer;
  ctx: Scaled2DContext;
  entity: SvgaVideoEntity;
  frame: number;
  bitmaps: BitmapsCache;
  replaceElements: ReplaceElements;
  dynamicElements: DynamicElements;
  size: ScaledSize;
  /**
   * True when the lib's own intersection-observer gate says drawing should
   * be skipped this tick (mirrors `!config.isUseIntersectionObserver ||
   * isBeIntersection` in the original — pass true here to SKIP the draw).
   */
  gated: boolean;
}

/**
 * Pure frame-draw step for a pre-scaled player: resizes/clears the container
 * canvas as needed, applies the scale transform, and renders every sprite
 * straight onto `ctx` (no offscreen canvas). Callers bind this to a real
 * `Player` instance's `container`/`ctx`/`videoEntity`/`bitmapsCache`/etc.
 */
export function drawFrameScaled(args: DrawFrameScaledArgs): void {
  const { container, ctx, entity, frame, bitmaps, replaceElements, dynamicElements, size, gated } = args;
  if (gated) return;
  if (container.width !== size.width || container.height !== size.height) {
    // Assigning width/height also clears the canvas (same as the lib's
    // clearContainer, which reassigns container.width to itself).
    container.width = size.width;
    container.height = size.height;
  } else {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);
  }
  ctx.setTransform(size.scale, 0, 0, size.scale, 0, 0);
  renderSpritesScaled(ctx, entity, frame, bitmaps, replaceElements, dynamicElements);
}

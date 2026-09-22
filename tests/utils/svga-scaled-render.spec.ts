import { describe, expect, it } from 'vitest';
import {
  computeScaledSize,
  drawFrameScaled,
  renderSpritesScaled,
  type BitmapsCache,
  type DynamicElements,
  type ReplaceElements,
  type Scaled2DContext,
  type SvgaVideoEntity
} from '~/utils/svga/scaled-render';

// Recording fake ctx: every method call pushes [name, ...args] so assertions
// can check exact draw order/args without a real canvas (node env, no DOM).
function createRecordingCtx(): Scaled2DContext & { calls: unknown[][] } {
  const calls: unknown[][] = [];
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push([name, ...args]);
    };
  return {
    calls,
    save: record('save'),
    restore: record('restore'),
    clip: record('clip'),
    fill: record('fill'),
    stroke: record('stroke'),
    beginPath: record('beginPath'),
    closePath: record('closePath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    bezierCurveTo: record('bezierCurveTo'),
    quadraticCurveTo: record('quadraticCurveTo'),
    arcTo: record('arcTo'),
    transform: record('transform'),
    setTransform: record('setTransform'),
    clearRect: record('clearRect'),
    drawImage: record('drawImage'),
    setLineDash: record('setLineDash'),
    get globalAlpha() {
      return 0;
    },
    set globalAlpha(v: number) {
      calls.push(['globalAlpha=', v]);
    },
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
    miterLimit: 10,
    lineCap: 'butt',
    lineJoin: 'miter'
  };
}

describe('computeScaledSize', () => {
  it('caps dpr at 2 and scales down when the display box is smaller than the entity', () => {
    const result = computeScaledSize({ cssWidth: 160, dpr: 2.75, entityWidth: 413, entityHeight: 413 });
    expect(result).toEqual({ width: 320, height: 320, scale: 320 / 413 });
  });

  it('never drops below the GPU-accelerated canvas area floor (257×256)', () => {
    const result = computeScaledSize({ cssWidth: 66, dpr: 2.75, entityWidth: 413, entityHeight: 413 });
    expect(result).not.toBeNull();
    expect(result!.width * result!.height).toBeGreaterThanOrEqual(257 * 256);
    expect(result!.width).toBe(257);
    expect(result!.scale).toBe(257 / 413);
  });

  it('returns null when the floor already reaches the entity size', () => {
    const result = computeScaledSize({ cssWidth: 20, dpr: 1, entityWidth: 250, entityHeight: 250 });
    expect(result).toBeNull();
  });

  it('returns null when the target width is not smaller than the entity', () => {
    const result = computeScaledSize({ cssWidth: 360, dpr: 2.75, entityWidth: 413, entityHeight: 413 });
    expect(result).toBeNull();
  });

  it('returns null when cssWidth is 0 (hidden container)', () => {
    const result = computeScaledSize({ cssWidth: 0, dpr: 2, entityWidth: 413, entityHeight: 413 });
    expect(result).toBeNull();
  });
});

describe('renderSpritesScaled', () => {
  const img = { width: 40, height: 40 } as unknown as HTMLImageElement;

  it('draws a simple sprite: save, alpha, transform, drawImage, restore', () => {
    const ctx = createRecordingCtx();
    const entity: SvgaVideoEntity = {
      size: { width: 413, height: 413 },
      sprites: [
        {
          imageKey: 'a',
          frames: [
            {
              alpha: 1,
              transform: { a: 2, b: 0, c: 0, d: 2, tx: 5, ty: 6 },
              layout: { width: 40, height: 40 },
              maskPath: null,
              shapes: []
            }
          ]
        }
      ]
    };
    const bitmaps: BitmapsCache = { a: img };
    renderSpritesScaled(ctx, entity, 0, bitmaps, {}, {});

    expect(ctx.calls).toContainEqual(['save']);
    expect(ctx.calls).toContainEqual(['globalAlpha=', 1]);
    expect(ctx.calls).toContainEqual(['transform', 2, 0, 0, 2, 5, 6]);
    expect(ctx.calls).toContainEqual(['drawImage', img, 0, 0, 40, 40]);
    expect(ctx.calls).toContainEqual(['restore']);
  });

  it('skips a sprite whose frame alpha is below the 0.05 threshold', () => {
    const ctx = createRecordingCtx();
    const entity: SvgaVideoEntity = {
      size: { width: 413, height: 413 },
      sprites: [
        {
          imageKey: 'a',
          frames: [
            {
              alpha: 0.01,
              transform: null,
              layout: { width: 40, height: 40 },
              maskPath: null,
              shapes: []
            }
          ]
        }
      ]
    };
    renderSpritesScaled(ctx, entity, 0, { a: img }, {}, {});
    expect(ctx.calls).toEqual([]);
  });

  it('clips using the mask path before drawing the bitmap', () => {
    const ctx = createRecordingCtx();
    const entity: SvgaVideoEntity = {
      size: { width: 413, height: 413 },
      sprites: [
        {
          imageKey: 'a',
          frames: [
            {
              alpha: 1,
              transform: null,
              layout: { width: 40, height: 40 },
              maskPath: {
                d: 'M0 0 L10 10',
                transform: undefined,
                styles: {
                  fill: null,
                  stroke: null,
                  strokeWidth: null,
                  lineCap: null,
                  lineJoin: null,
                  miterLimit: null,
                  lineDash: null
                }
              },
              shapes: []
            }
          ]
        }
      ]
    };
    renderSpritesScaled(ctx, entity, 0, { a: img }, {}, {});

    const names = ctx.calls.map((c) => c[0]);
    const clipIndex = names.indexOf('clip');
    const drawIndex = names.indexOf('drawImage');
    expect(clipIndex).toBeGreaterThan(-1);
    expect(drawIndex).toBeGreaterThan(clipIndex);
    // Path ops (from drawBezier on the mask) happened before the clip.
    expect(names.indexOf('moveTo')).toBeLessThan(clipIndex);
    expect(names.indexOf('lineTo')).toBeLessThan(clipIndex);
  });

  it('draws a rect shape via arcTo x4 + fill', () => {
    const ctx = createRecordingCtx();
    const entity: SvgaVideoEntity = {
      size: { width: 413, height: 413 },
      sprites: [
        {
          imageKey: 'a',
          frames: [
            {
              alpha: 1,
              transform: null,
              layout: { width: 40, height: 40 },
              maskPath: null,
              shapes: [
                {
                  type: 'rect',
                  path: { x: 0, y: 0, width: 20, height: 10, cornerRadius: 2 },
                  styles: {
                    fill: 'red',
                    stroke: null,
                    strokeWidth: null,
                    lineCap: null,
                    lineJoin: null,
                    miterLimit: null,
                    lineDash: null
                  }
                }
              ]
            }
          ]
        }
      ]
    };
    renderSpritesScaled(ctx, entity, 0, {}, {}, {});

    const arcToCalls = ctx.calls.filter((c) => c[0] === 'arcTo');
    expect(arcToCalls).toHaveLength(4);
    expect(ctx.calls).toContainEqual(['fill']);
  });

  it('draws a dynamic element centered at its natural size', () => {
    const ctx = createRecordingCtx();
    const el = { width: 20, height: 10 } as unknown as HTMLCanvasElement;
    const entity: SvgaVideoEntity = {
      size: { width: 413, height: 413 },
      sprites: [
        {
          imageKey: 'a',
          frames: [
            {
              alpha: 1,
              transform: null,
              layout: { width: 40, height: 40 },
              maskPath: null,
              shapes: []
            }
          ]
        }
      ]
    };
    const dynamicElements: DynamicElements = { a: el };
    renderSpritesScaled(ctx, entity, 0, {}, {}, dynamicElements);

    expect(ctx.calls).toContainEqual(['drawImage', el, (40 - 20) / 2, (40 - 10) / 2, 20, 10]);
  });

  it('draws the replace element instead of the base bitmap when both exist', () => {
    const ctx = createRecordingCtx();
    const replace = { width: 40, height: 40 } as unknown as HTMLImageElement;
    const entity: SvgaVideoEntity = {
      size: { width: 413, height: 413 },
      sprites: [
        {
          imageKey: 'a',
          frames: [
            {
              alpha: 1,
              transform: null,
              layout: { width: 40, height: 40 },
              maskPath: null,
              shapes: []
            }
          ]
        }
      ]
    };
    const bitmaps: BitmapsCache = { a: img };
    const replaceElements: ReplaceElements = { a: replace };
    renderSpritesScaled(ctx, entity, 0, bitmaps, replaceElements, {});

    const drawImageCalls = ctx.calls.filter((c) => c[0] === 'drawImage');
    expect(drawImageCalls).toHaveLength(1);
    expect(drawImageCalls[0]?.[1]).toBe(replace);
  });
});

describe('drawFrameScaled', () => {
  const entity: SvgaVideoEntity = {
    size: { width: 413, height: 413 },
    sprites: []
  };

  it('resizes the container (which clears it) when its size does not match the target', () => {
    const ctx = createRecordingCtx();
    const container = { width: 413, height: 413 };
    drawFrameScaled({
      container,
      ctx,
      entity,
      frame: 0,
      bitmaps: {},
      replaceElements: {},
      dynamicElements: {},
      size: { width: 132, height: 132, scale: 132 / 413 },
      gated: false
    });

    expect(container.width).toBe(132);
    expect(container.height).toBe(132);
    // No manual clearRect needed — the resize itself cleared the canvas.
    expect(ctx.calls.some((c) => c[0] === 'clearRect')).toBe(false);
    expect(ctx.calls).toContainEqual(['setTransform', 132 / 413, 0, 0, 132 / 413, 0, 0]);
  });

  it('clears via setTransform + clearRect when the container is already the right size', () => {
    const ctx = createRecordingCtx();
    const container = { width: 132, height: 132 };
    drawFrameScaled({
      container,
      ctx,
      entity,
      frame: 0,
      bitmaps: {},
      replaceElements: {},
      dynamicElements: {},
      size: { width: 132, height: 132, scale: 132 / 413 },
      gated: false
    });

    expect(ctx.calls).toContainEqual(['setTransform', 1, 0, 0, 1, 0, 0]);
    expect(ctx.calls).toContainEqual(['clearRect', 0, 0, 132, 132]);
  });

  it('does nothing when gated (intersection observer says off-screen)', () => {
    const ctx = createRecordingCtx();
    const container = { width: 413, height: 413 };
    drawFrameScaled({
      container,
      ctx,
      entity,
      frame: 0,
      bitmaps: {},
      replaceElements: {},
      dynamicElements: {},
      size: { width: 132, height: 132, scale: 132 / 413 },
      gated: true
    });

    expect(ctx.calls).toEqual([]);
    expect(container.width).toBe(413);
  });
});

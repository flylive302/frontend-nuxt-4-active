/**
 * RNNoise AudioWorklet attach/detach for the mic passthrough graph.
 *
 * Isolated from `useMediasoupStreaming.ts` so the worklet-loading mechanics
 * (module URL import, `addModule`, node construction) stay out of the main
 * streaming composable. Any failure here is non-fatal: the caller falls back
 * to passing the raw source straight through, same as before this filter
 * existed.
 */
import { createLogger } from '~/utils/logger';

const log = createLogger('[MicNoiseFilter]');

let _addModulePromise: Promise<void> | null = null;
let _addModuleCtx: AudioContext | null = null;
let _node: AudioWorkletNode | null = null;

/**
 * Wire the RNNoise worklet node between `source` and the rest of the graph.
 * Loads the worklet module into `ctx` once per context. On any failure, logs
 * a warning and returns `source` unchanged (pass-through, no filter).
 */
export async function attachNoiseFilter(ctx: AudioContext, source: AudioNode): Promise<AudioNode> {
  try {
    const { NoiseSuppressorWorklet_Name } = await import('@timephy/rnnoise-wasm');
    const NoiseSuppressorWorkletUrl = (await import('@timephy/rnnoise-wasm/NoiseSuppressorWorklet?worker&url')).default;

    if (_addModuleCtx !== ctx || !_addModulePromise) {
      _addModuleCtx = ctx;
      _addModulePromise = ctx.audioWorklet.addModule(NoiseSuppressorWorkletUrl);
    }
    await _addModulePromise;

    const node = new AudioWorkletNode(ctx, NoiseSuppressorWorklet_Name);
    source.connect(node);
    _node = node;
    return node;
  }
  catch (err) {
    log.warn('Failed to attach RNNoise filter, falling back to pass-through', err);
    _addModulePromise = null;
    _addModuleCtx = null;
    return source;
  }
}

/** Disconnect and drop the RNNoise node. Safe to call when nothing is attached. */
export function detachNoiseFilter(): void {
  try { _node?.disconnect(); } catch { /* noop */ }
  _node = null;
}

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
let _source: AudioNode | null = null;

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
    _source = source;
    return node;
  }
  catch (err) {
    log.warn('Failed to attach RNNoise filter, falling back to pass-through', err);
    _addModulePromise = null;
    _addModuleCtx = null;
    return source;
  }
}

/**
 * Disconnect and drop the RNNoise node. Safe to call when nothing is attached.
 *
 * `_node.disconnect()` only tears down the node's OUTPUT side — the upstream
 * `source.connect(node)` edge survives it, so the worklet keeps receiving
 * `process()` calls (and burning CPU) even with nothing downstream. We also
 * disconnect the stored input edge (`source`, remembered from `attachNoiseFilter`,
 * or passed explicitly when the caller already holds it) so the node is fully
 * isolated and eligible to stop processing.
 */
export function detachNoiseFilter(source?: AudioNode): void {
  const inputSource = source ?? _source;
  if (inputSource && _node) {
    try { inputSource.disconnect(_node); } catch { /* noop */ }
  }
  try { _node?.disconnect(); } catch { /* noop */ }
  _node = null;
  _source = null;
}

/**
 * Pure(ish) graph-rewiring step for local-mute bypass. Given the mic
 * AudioContext graph's `source` and `gain` nodes, either detaches RNNoise and
 * connects `source → gain` directly (muted), or re-attaches RNNoise and
 * connects `node → gain` (unmuted, and the filter is wanted for this
 * pipeline). Never throws — any failure logs a warning and leaves the graph
 * passed straight through, same as the existing `attachNoiseFilter` fallback.
 *
 * Returns whether RNNoise ends up active in the graph after this call.
 */
export async function rewireNoiseFilter(opts: {
  ctx: AudioContext;
  source: AudioNode;
  gain: AudioNode;
  muted: boolean;
  wanted: boolean;
}): Promise<boolean> {
  const { ctx, source, gain, muted, wanted } = opts;
  try {
    if (muted) {
      detachNoiseFilter(source);
      try { source.disconnect(); } catch { /* noop */ }
      source.connect(gain);
      return false;
    }

    if (!wanted) {
      return false;
    }

    const node = await attachNoiseFilter(ctx, source);
    if (node !== source) {
      try { source.disconnect(gain); } catch { /* noop */ }
      node.connect(gain);
      return true;
    }
    return false;
  }
  catch (err) {
    log.warn('Failed to rewire RNNoise filter for mute toggle', err);
    return false;
  }
}

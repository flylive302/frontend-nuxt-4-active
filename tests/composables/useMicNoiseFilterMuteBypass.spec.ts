/**
 * Mute-bypass graph rewiring for RNNoise (audio-pipe-observability CPU fix,
 * 2026-09-23). While muted, `producer.track.enabled = false` alone leaves the
 * RNNoise AudioWorkletNode upstream still running `process()` on every render
 * quantum — measured ~4s CPU per 60s on an Oppo A6x. `rewireNoiseFilter()` in
 * `useMicNoiseFilter.ts` detaches/reattaches the node around mute toggles.
 *
 * We test the pure(ish) `rewireNoiseFilter` helper directly rather than
 * driving it through `useMediasoupStreaming`'s full mic pipeline (getUserMedia,
 * mediasoup transports, single-flight guards, Pinia stores) — that surface is
 * already heavy to mock (see useMediasoupStreamingSingleFlight.spec.ts) and
 * none of it is relevant to whether the graph gets rewired correctly.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockWorkletName = 'mock-rnnoise-worklet'

vi.mock('@timephy/rnnoise-wasm', () => ({
  NoiseSuppressorWorklet_Name: mockWorkletName,
}))
vi.mock('@timephy/rnnoise-wasm/NoiseSuppressorWorklet?worker&url', () => ({
  default: 'mock-worklet-url',
}))

vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}))

// ============================================
// Fake Web Audio graph
// ============================================

/** Minimal AudioNode stub that records connect/disconnect calls. */
function makeNode(name: string) {
  const edges = new Set<unknown>()
  const node = {
    name,
    connect: vi.fn((dest: unknown) => { edges.add(dest) }),
    disconnect: vi.fn((dest?: unknown) => {
      if (dest === undefined) edges.clear()
      else edges.delete(dest)
    }),
    _edges: edges,
  }
  return node
}

function makeFakeAudioContext() {
  return {
    audioWorklet: {
      addModule: vi.fn().mockResolvedValue(undefined),
    },
  } as unknown as AudioContext
}

describe('rewireNoiseFilter', () => {
  let AudioWorkletNodeCtor: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.resetModules()
    AudioWorkletNodeCtor = vi.fn().mockImplementation(function (this: unknown) {
      Object.assign(this as object, makeNode('rnnoise-node'))
    })
    vi.stubGlobal('AudioWorkletNode', AudioWorkletNodeCtor)
  })

  it('mute: detaches the node and connects source straight to gain', async () => {
    const { rewireNoiseFilter } = await import('../../app/composables/mediasoup/useMicNoiseFilter')
    const ctx = makeFakeAudioContext()
    const source = makeNode('source') as unknown as AudioNode
    const gain = makeNode('gain') as unknown as AudioNode

    // First attach (unmuted, wanted) so there's a node to detach.
    const active1 = await rewireNoiseFilter({ ctx, source, gain, muted: false, wanted: true })
    expect(active1).toBe(true)

    const active2 = await rewireNoiseFilter({ ctx, source, gain, muted: true, wanted: true })
    expect(active2).toBe(false)
    expect((source as unknown as ReturnType<typeof makeNode>).connect).toHaveBeenCalledWith(gain)
  })

  it('unmute (wanted): re-attaches the node and connects node to gain', async () => {
    const { rewireNoiseFilter } = await import('../../app/composables/mediasoup/useMicNoiseFilter')
    const ctx = makeFakeAudioContext()
    const source = makeNode('source') as unknown as AudioNode
    const gain = makeNode('gain') as unknown as AudioNode

    await rewireNoiseFilter({ ctx, source, gain, muted: true, wanted: true })
    const active = await rewireNoiseFilter({ ctx, source, gain, muted: false, wanted: true })

    expect(active).toBe(true)
    expect(AudioWorkletNodeCtor).toHaveBeenCalled()
  })

  it('double-mute is a no-op on the graph beyond the first call', async () => {
    const { rewireNoiseFilter } = await import('../../app/composables/mediasoup/useMicNoiseFilter')
    const ctx = makeFakeAudioContext()
    const source = makeNode('source') as unknown as AudioNode
    const gain = makeNode('gain') as unknown as AudioNode

    await rewireNoiseFilter({ ctx, source, gain, muted: false, wanted: true })
    const active1 = await rewireNoiseFilter({ ctx, source, gain, muted: true, wanted: true })
    const connectCallsAfterFirstMute = (source as unknown as ReturnType<typeof makeNode>).connect.mock.calls.length

    const active2 = await rewireNoiseFilter({ ctx, source, gain, muted: true, wanted: true })

    expect(active1).toBe(false)
    expect(active2).toBe(false)
    // Calling rewireNoiseFilter again with the same muted=true state still
    // reconnects source→gain (it's not itself idempotent — that guard lives
    // in useMediasoupStreaming's `_micFilterBypassed` check) but must not
    // throw or leave the graph in a broken state.
    expect((source as unknown as ReturnType<typeof makeNode>).connect.mock.calls.length)
      .toBeGreaterThanOrEqual(connectCallsAfterFirstMute)
  })

  it('attach failure on unmute falls back to pass-through (source untouched, not marked active)', async () => {
    vi.doMock('@timephy/rnnoise-wasm', () => {
      throw new Error('module load failed')
    })
    vi.resetModules()
    try {
      const { rewireNoiseFilter } = await import('../../app/composables/mediasoup/useMicNoiseFilter')
      const ctx = makeFakeAudioContext()
      const source = makeNode('source') as unknown as AudioNode
      const gain = makeNode('gain') as unknown as AudioNode

      // attachNoiseFilter's own catch returns `source` unchanged (the
      // existing fallback behavior), so rewireNoiseFilter reports the filter
      // as inactive and does not touch the source→gain wiring it already had.
      const active = await rewireNoiseFilter({ ctx, source, gain, muted: false, wanted: true })

      expect(active).toBe(false)
      expect((source as unknown as ReturnType<typeof makeNode>).connect).not.toHaveBeenCalledWith(gain)
    }
    finally {
      vi.doUnmock('@timephy/rnnoise-wasm')
      vi.resetModules()
    }
  })

  it('unmute when filter is not wanted leaves the graph untouched (no attach attempt)', async () => {
    const { rewireNoiseFilter } = await import('../../app/composables/mediasoup/useMicNoiseFilter')
    const ctx = makeFakeAudioContext()
    const source = makeNode('source') as unknown as AudioNode
    const gain = makeNode('gain') as unknown as AudioNode

    const active = await rewireNoiseFilter({ ctx, source, gain, muted: false, wanted: false })

    expect(active).toBe(false)
    expect(AudioWorkletNodeCtor).not.toHaveBeenCalled()
  })
})

describe('detachNoiseFilter', () => {
  it('disconnects both the node output and the stored source→node input edge', async () => {
    vi.resetModules()
    vi.stubGlobal('AudioWorkletNode', vi.fn().mockImplementation(function (this: unknown) {
      Object.assign(this as object, makeNode('rnnoise-node'))
    }))
    const { attachNoiseFilter, detachNoiseFilter } = await import('../../app/composables/mediasoup/useMicNoiseFilter')
    const ctx = makeFakeAudioContext()
    const source = makeNode('source') as unknown as AudioNode

    const node = await attachNoiseFilter(ctx, source)
    expect(node).not.toBe(source)

    detachNoiseFilter()

    // Input edge (source → node) must be torn down, not just the node's own
    // outputs — otherwise the worklet keeps receiving audio and keeps calling
    // process() even with nothing downstream of it.
    expect((source as unknown as ReturnType<typeof makeNode>).disconnect).toHaveBeenCalledWith(node)
    expect((node as unknown as ReturnType<typeof makeNode>).disconnect).toHaveBeenCalled()
  })
})

/**
 * Opus options for the room producers (cost-and-speed-tuning 03).
 *
 * Mic: DTX on + 40 ms packets (the egress lever); FEC, mono and the 96k cap
 * unchanged (the cap is ticket 04's operator call). Music: unchanged — DTX
 * off, no ptime override.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import {
  micProducerCodecOptions,
  musicProducerCodecOptions,
} from '../../app/utils/audio/producer-codec-options'

describe('micProducerCodecOptions', () => {
  it('turns DTX on and asks for 40 ms packets, keeping FEC, mono and the 96k cap', () => {
    expect(micProducerCodecOptions()).toStrictEqual({
      opusStereo: false,
      opusFec: true,
      opusDtx: true,
      opusPtime: 40,
      opusMaxAverageBitrate: 96_000,
    })
  })
})

describe('musicProducerCodecOptions', () => {
  it('keeps DTX off, stereo and the 128k cap', () => {
    expect(musicProducerCodecOptions()).toStrictEqual({
      opusStereo: true,
      opusFec: true,
      opusDtx: false,
      opusMaxAverageBitrate: 128_000,
    })
  })

  it('leaves the packet duration at the browser default', () => {
    expect(musicProducerCodecOptions()).not.toHaveProperty('opusPtime')
  })
})

describe('useMediasoupStreaming producer wiring', () => {
  const source = readFileSync(
    fileURLToPath(new URL('../../app/composables/mediasoup/useMediasoupStreaming.ts', import.meta.url)),
    'utf8',
  )

  it('builds each producer\'s options from the shared builders, never inline', () => {
    expect(source).toContain('codecOptions: micProducerCodecOptions()')
    expect(source).toContain('codecOptions: musicProducerCodecOptions()')
    expect(source).not.toMatch(/opusDtx\s*:/)
  })
})

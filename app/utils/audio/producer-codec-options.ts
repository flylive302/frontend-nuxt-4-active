/**
 * Opus codec options for the two room producers — pure, so they can be
 * unit-tested without a transport.
 *
 * mediasoup-client writes these into the SDP answer AND into the producer's
 * `rtpParameters` (`usedtx`, `ptime`, …), so the SFU sees them too: mediasoup
 * relaxes its inactivity check for a `usedtx=1` stream, and consumers keep
 * the producer's codec parameters.
 */
import type { types as mediasoupTypes } from 'mediasoup-client';
import {
  MIC_OPUS_MAX_AVERAGE_BITRATE,
  MIC_OPUS_PTIME_MS,
  MUSIC_OPUS_MAX_AVERAGE_BITRATE,
} from '~/constants/audio';

/**
 * Voice mic: mono at a capped 96k target. Without the mono flag and the cap
 * the router's stereo-forced Opus config encodes the mono mic as uncapped
 * stereo — roughly half the bits go to a phantom second channel and BWE picks
 * an arbitrary rate ("weak audio", 2026-07-10 audio review). FEC on for loss
 * resilience.
 *
 * DTX on (cost-and-speed-tuning 03): a quiet open mic sends one comfort-noise
 * packet every ~400 ms instead of 50 packets/s; speech encodes identically.
 * It was off because it froze the HLS broadcast mix — ticket 02 hardened that
 * graph and proved it on the prod FFmpeg 5.1.9
 * (`docs/issues/cost-and-speed-tuning/assets-02-dtx-repro/`).
 * 40 ms packets: see `MIC_OPUS_PTIME_MS`.
 */
export function micProducerCodecOptions(): mediasoupTypes.ProducerCodecOptions {
  return {
    opusStereo: false,
    opusFec: true,
    opusDtx: true,
    opusPtime: MIC_OPUS_PTIME_MS,
    opusMaxAverageBitrate: MIC_OPUS_MAX_AVERAGE_BITRATE,
  };
}

/**
 * DJ music: true stereo source, higher cap than the voice mic. DTX stays off
 * (music is continuous, so it would buy nothing) and the packet duration
 * stays the browser default.
 */
export function musicProducerCodecOptions(): mediasoupTypes.ProducerCodecOptions {
  return {
    opusStereo: true,
    opusFec: true,
    opusDtx: false,
    opusMaxAverageBitrate: MUSIC_OPUS_MAX_AVERAGE_BITRATE,
  };
}

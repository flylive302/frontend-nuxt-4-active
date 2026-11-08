// ========================================
// Audio Constants — Opus encoder targets for the room producers
// ========================================
//
// Read by `utils/audio/producer-codec-options.ts`, the one place the mic and
// DJ-music producers' Opus options are built. MSAB `maxIncomingBitrate`
// (256k) is sized for one mic + one music producer + FEC on a transport, so
// raising either cap needs that server value checked too.

/**
 * Voice mic target bitrate, bits/s. 64k until 2026-08-23; raised by ADR 0033
 * after the "A vs A++" audio-quality review. Lowering it is the operator's
 * call (cost-and-speed-tuning 04), not a cost default.
 */
export const MIC_OPUS_MAX_AVERAGE_BITRATE = 96_000

/**
 * Voice mic packet duration, ms. 40 ms halves the packets of the 20 ms
 * default, so RTP/UDP/IP header overhead per voiced stream drops by about
 * 12–15 kbps for +20 ms of latency (cost-and-speed-tuning 03). The MSAB
 * router keeps `minptime: 10`; this only asks for longer packets.
 */
export const MIC_OPUS_PTIME_MS = 40

/** DJ music target bitrate, bits/s. 128k stereo Opus is transparent for music. */
export const MUSIC_OPUS_MAX_AVERAGE_BITRATE = 128_000

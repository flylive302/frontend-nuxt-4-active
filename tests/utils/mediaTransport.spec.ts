import { describe, it, expect } from 'vitest'
import {
  resolveMediaTransportUrl,
  selectMediaTransport,
  planTransportHandoff,
} from '../../app/utils/mediaTransport'

describe('resolveMediaTransportUrl', () => {
  it('returns the Laravel hosting_url in production', () => {
    expect(
      resolveMediaTransportUrl('wss://mumbai.audio.flyliveapp.com', false),
    ).toBe('wss://mumbai.audio.flyliveapp.com')
  })

  it('ignores the hosting_url in development so the local config URL is used', () => {
    expect(
      resolveMediaTransportUrl('wss://mumbai.audio.flyliveapp.com', true),
    ).toBeUndefined()
  })

  it('returns undefined in production when no hosting_url is provided', () => {
    expect(resolveMediaTransportUrl(null, false)).toBeUndefined()
    expect(resolveMediaTransportUrl(undefined, false)).toBeUndefined()
  })

  it('never returns a localhost endpoint from a provided hosting_url', () => {
    const url = resolveMediaTransportUrl('wss://frankfurt.audio.flyliveapp.com', false)

    expect(url).not.toContain('localhost')
  })
})

describe('selectMediaTransport', () => {
  const url = 'https://live.flyliveapp.com/42/master.m3u8'

  it('routes a passive Listener in broadcast mode to HLS', () => {
    expect(
      selectMediaTransport({ mode: 'broadcast', isSpeaker: false, hlsPlaybackUrl: url }),
    ).toBe('hls')
  })

  it('keeps Speakers on WebRTC even in broadcast mode (promotion path)', () => {
    expect(
      selectMediaTransport({ mode: 'broadcast', isSpeaker: true, hlsPlaybackUrl: url }),
    ).toBe('webrtc')
  })

  it('keeps everyone on WebRTC in interactive mode', () => {
    expect(
      selectMediaTransport({ mode: 'interactive', isSpeaker: false, hlsPlaybackUrl: url }),
    ).toBe('webrtc')
  })

  it('falls back to WebRTC when no HLS URL is published yet', () => {
    expect(
      selectMediaTransport({ mode: 'broadcast', isSpeaker: false, hlsPlaybackUrl: null }),
    ).toBe('webrtc')
    expect(
      selectMediaTransport({ mode: 'broadcast', isSpeaker: false, hlsPlaybackUrl: '' }),
    ).toBe('webrtc')
  })
})

describe('planTransportHandoff (realtime-10)', () => {
  it('is a no-op when already on the target tier (no stop/start churn)', () => {
    expect(planTransportHandoff('webrtc', 'webrtc', 0.8)).toEqual({
      changed: false,
      tier: 'webrtc',
      webrtcVolume: 0.8,
    })
    expect(planTransportHandoff('hls', 'hls', 0.5).changed).toBe(false)
  })

  it('demotion WebRTC → HLS mutes WebRTC and carries the saved volume to HLS', () => {
    const plan = planTransportHandoff('webrtc', 'hls', 0.3)
    expect(plan.changed).toBe(true)
    expect(plan.tier).toBe('hls')
    expect(plan.webrtcVolume).toBe(0) // WebRTC silenced so only one tier plays
    expect(plan.hlsVolume).toBe(0.3) // HLS at the Listener's volume
  })

  it('promotion HLS → WebRTC restores the saved volume, never a hardcoded 1', () => {
    const plan = planTransportHandoff('hls', 'webrtc', 0.3)
    expect(plan.changed).toBe(true)
    expect(plan.tier).toBe('webrtc')
    expect(plan.webrtcVolume).toBe(0.3) // the clobber-guard: not reset to 1
  })

  it('round-trips volume across a demote→promote without clobbering', () => {
    const saved = 0.42
    const down = planTransportHandoff('webrtc', 'hls', saved)
    const up = planTransportHandoff(down.tier, 'webrtc', saved)
    expect(up.webrtcVolume).toBe(saved)
  })
})

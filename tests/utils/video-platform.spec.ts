// ========================================
// video-platform Tests (room-video-player 08)
// ========================================
// Per-platform YouTube capability (ticket 01 decision row), the mount rule the
// sync follows, and the "Open on YouTube" URL.
// ========================================
import { describe, expect, it } from 'vitest'
import {
  canEmbedYouTube,
  shouldMountVideoPlayer,
  toRoomVideoPlatform,
  youTubeWatchUrl,
} from '~/utils/video-platform'

describe('toRoomVideoPlatform', () => {
  it('keeps android and ios, maps everything else to web', () => {
    expect(toRoomVideoPlatform('android')).toBe('android')
    expect(toRoomVideoPlatform('ios')).toBe('ios')
    expect(toRoomVideoPlatform('web')).toBe('web')
    expect(toRoomVideoPlatform('electron')).toBe('web')
    expect(toRoomVideoPlatform('')).toBe('web')
  })
})

describe('canEmbedYouTube (ticket 01 decision row, 2026-11-09)', () => {
  it('embeds on web and Android, shows the card on iOS', () => {
    expect(canEmbedYouTube('web')).toBe(true)
    expect(canEmbedYouTube('android')).toBe(true)
    expect(canEmbedYouTube('ios')).toBe(false)
  })
})

describe('shouldMountVideoPlayer', () => {
  const base = { kind: 'youtube', platform: 'android', collapsed: false, isController: false } as const

  it('always mounts a direct-link player, collapsed or not, on any platform', () => {
    for (const platform of ['web', 'android', 'ios'] as const) {
      expect(shouldMountVideoPlayer({ ...base, kind: 'url', platform, collapsed: true })).toBe(true)
    }
  })

  it('mounts an expanded YouTube player where embedding is allowed', () => {
    expect(shouldMountVideoPlayer(base)).toBe(true)
    expect(shouldMountVideoPlayer({ ...base, platform: 'web' })).toBe(true)
  })

  it('never mounts YouTube on a no-embed platform (the card), even for the Controller', () => {
    expect(shouldMountVideoPlayer({ ...base, platform: 'ios' })).toBe(false)
    expect(shouldMountVideoPlayer({ ...base, platform: 'ios', isController: true })).toBe(false)
  })

  it('unmounts a collapsed YouTube iframe on Capacitor for a Watcher', () => {
    expect(shouldMountVideoPlayer({ ...base, collapsed: true })).toBe(false)
  })

  it('keeps the Controller\'s collapsed YouTube player (it drives heartbeat + ended)', () => {
    expect(shouldMountVideoPlayer({ ...base, collapsed: true, isController: true })).toBe(true)
  })

  it('keeps a collapsed YouTube iframe on the web (hidden, audio continues)', () => {
    expect(shouldMountVideoPlayer({ ...base, platform: 'web', collapsed: true })).toBe(true)
  })
})

describe('youTubeWatchUrl', () => {
  it('builds the watch page for the id', () => {
    expect(youTubeWatchUrl('dQw4w9WgXcQ')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  })

  it('adds the start second, floored', () => {
    expect(youTubeWatchUrl('dQw4w9WgXcQ', 125.9)).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=125s')
  })

  it('omits t for 0, negative or non-finite positions', () => {
    for (const at of [0, 0.4, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(youTubeWatchUrl('dQw4w9WgXcQ', at)).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    }
  })
})

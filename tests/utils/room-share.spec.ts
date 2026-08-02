import { describe, it, expect } from 'vitest'
import {
  buildRoomSharePayload,
  formatShareForClipboard,
  isShareCancellation,
} from '../../app/utils/room-share'
import { PLAY_STORE_URL } from '../../app/constants/share'

describe('buildRoomSharePayload', () => {
  it('includes the room name and id in the share text', () => {
    const payload = buildRoomSharePayload({ id: 42, name: 'Night Owls' })

    expect(payload.title).toBe('Join Night Owls on FlyLive')
    expect(payload.text).toContain('"Night Owls"')
    expect(payload.text).toContain('Room #42')
  })

  it('always shares the public Play Store listing', () => {
    expect(buildRoomSharePayload({ id: 1, name: 'A' }).url).toBe(PLAY_STORE_URL)
  })

  it('falls back to the room number when the name is blank', () => {
    const payload = buildRoomSharePayload({ id: 7, name: '   ' })

    expect(payload.title).toBe('Join Room #7 on FlyLive')
    expect(payload.text).toContain('"Room #7"')
  })
})

describe('formatShareForClipboard', () => {
  it('joins the message and the url on separate lines', () => {
    const copied = formatShareForClipboard(buildRoomSharePayload({ id: 9, name: 'Chill' }))

    const [text, url] = copied.split('\n')
    expect(text).toContain('Room #9')
    expect(url).toBe(PLAY_STORE_URL)
  })
})

describe('isShareCancellation', () => {
  it('detects the Web Share API abort', () => {
    const error = new Error('The user aborted a request.')
    error.name = 'AbortError'

    expect(isShareCancellation(error)).toBe(true)
  })

  it.each(['Share canceled', 'Share cancelled', 'Abort'])('detects the native dismissal %s', (message) => {
    expect(isShareCancellation(new Error(message))).toBe(true)
  })

  it('does not treat a missing plugin as a cancellation', () => {
    expect(isShareCancellation(new Error('Share does not have web implementation.'))).toBe(false)
    expect(isShareCancellation(new Error('"Share" plugin is not implemented on android'))).toBe(false)
  })

  it('is safe with non-error values', () => {
    expect(isShareCancellation(null)).toBe(false)
    expect(isShareCancellation('canceled')).toBe(false)
    expect(isShareCancellation(undefined)).toBe(false)
  })
})

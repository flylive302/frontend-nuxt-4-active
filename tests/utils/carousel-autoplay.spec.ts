import { describe, it, expect } from 'vitest'
import { nextAutoplayAction } from '../../app/utils/carousel-autoplay'

describe('nextAutoplayAction (home-page-runtime-audit/1, rule 1A)', () => {
  it('leaving the viewport while playing → stop, and remember to resume', () => {
    expect(nextAutoplayAction(false, true, false)).toEqual({ action: 'stop', resumeOnEnter: true })
  })

  it('leaving the viewport while already stopped (user swiped) → nothing, no resume', () => {
    expect(nextAutoplayAction(false, false, false)).toEqual({ action: 'none', resumeOnEnter: false })
  })

  it('re-entering after our own pause → play', () => {
    expect(nextAutoplayAction(true, false, true)).toEqual({ action: 'play', resumeOnEnter: false })
  })

  it('re-entering after a user swipe → stays stopped', () => {
    expect(nextAutoplayAction(true, false, false)).toEqual({ action: 'none', resumeOnEnter: false })
  })

  it('re-entering while somehow already playing → nothing, flag cleared', () => {
    expect(nextAutoplayAction(true, true, true)).toEqual({ action: 'none', resumeOnEnter: false })
  })

  it('a second off-screen tick (slow scroll flapping) keeps the resume flag', () => {
    // First crossing paused it; a re-check while still off-screen sees
    // isPlaying=false but must not forget that we were the one who stopped it.
    expect(nextAutoplayAction(false, false, true)).toEqual({ action: 'none', resumeOnEnter: true })
  })
})

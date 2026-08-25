import { describe, expect, it } from 'vitest'
import { createLoadTracker } from '~/utils/infinite-scroll-load-tracker'

describe('createLoadTracker', () => {
  it('begin() returns a current ticket with an unaborted signal', () => {
    const tracker = createLoadTracker()
    const ticket = tracker.begin()

    expect(ticket.isCurrent()).toBe(true)
    expect(ticket.signal.aborted).toBe(false)
  })

  it('a second begin() aborts the first ticket and makes it stale', () => {
    const tracker = createLoadTracker()
    const first = tracker.begin()
    const second = tracker.begin()

    expect(first.signal.aborted).toBe(true)
    expect(first.isCurrent()).toBe(false)
    expect(second.signal.aborted).toBe(false)
    expect(second.isCurrent()).toBe(true)
  })

  it('invalidate() aborts the in-flight ticket and makes it stale (reset mid-flight)', () => {
    const tracker = createLoadTracker()
    const inFlight = tracker.begin()

    tracker.invalidate()

    expect(inFlight.signal.aborted).toBe(true)
    expect(inFlight.isCurrent()).toBe(false)
  })

  it('a begin() after invalidate() issues a fresh current ticket (reload mid-flight)', () => {
    const tracker = createLoadTracker()
    const stale = tracker.begin()
    tracker.invalidate()
    const fresh = tracker.begin()

    // The stale request's late finally must not be treated as current.
    expect(stale.isCurrent()).toBe(false)
    expect(fresh.isCurrent()).toBe(true)
    expect(fresh.signal.aborted).toBe(false)
  })

  it('invalidate() with nothing in flight is a no-op that still stales old tickets', () => {
    const tracker = createLoadTracker()
    const ticket = tracker.begin()
    tracker.invalidate()

    expect(() => tracker.invalidate()).not.toThrow()
    expect(ticket.isCurrent()).toBe(false)
  })

  it('abort() cancels the signal without staling the ticket (unmount path)', () => {
    const tracker = createLoadTracker()
    const ticket = tracker.begin()

    tracker.abort()

    expect(ticket.signal.aborted).toBe(true)
    expect(ticket.isCurrent()).toBe(true)
  })

  it('abort() before any begin() does not throw', () => {
    const tracker = createLoadTracker()
    expect(() => tracker.abort()).not.toThrow()
  })

  it('trackers are independent of each other', () => {
    const trackerA = createLoadTracker()
    const trackerB = createLoadTracker()
    const ticketA = trackerA.begin()

    trackerB.begin()
    trackerB.invalidate()

    expect(ticketA.isCurrent()).toBe(true)
    expect(ticketA.signal.aborted).toBe(false)
  })
})

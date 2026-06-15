import { describe, it, expect } from 'vitest'
import {
  monitorPolicy,
  type AudioRoute,
  type LocalMonitorDecision,
} from '../../app/utils/local-monitor-policy'

// Table-driven over every row of the capacitor-02 decision sketch (AC #1).
// `producing=false` short-circuits regardless of route, so it is covered once.
const cases: Array<{
  name: string
  producing: boolean
  route: AudioRoute
  expected: LocalMonitorDecision
}> = [
  {
    name: 'not producing → monitor on (no open mic, loudspeaker fine)',
    producing: false,
    route: 'speaker',
    expected: { monitorOn: true },
  },
  {
    name: 'producing on wired → monitor on (headphones isolate)',
    producing: true,
    route: 'wired',
    expected: { monitorOn: true },
  },
  {
    name: 'producing on speaker → monitor off + plug-in-headphones hint (the bug case)',
    producing: true,
    route: 'speaker',
    expected: { monitorOn: false, hint: 'plug-in-headphones' },
  },
  {
    name: 'producing on bluetooth → monitor on + degraded flag (A2DP→SCO mono)',
    producing: true,
    route: 'bluetooth',
    expected: { monitorOn: true, degraded: true },
  },
]

describe('monitorPolicy', () => {
  for (const c of cases) {
    it(c.name, () => {
      expect(monitorPolicy({ producing: c.producing, route: c.route })).toEqual(c.expected)
    })
  }

  it('emits the hint only in the producing+speaker case', () => {
    const routes: AudioRoute[] = ['wired', 'speaker', 'bluetooth']
    for (const route of routes) {
      // Not producing: never hint, whatever the route.
      expect(monitorPolicy({ producing: false, route }).hint).toBeUndefined()
    }
    expect(monitorPolicy({ producing: true, route: 'wired' }).hint).toBeUndefined()
    expect(monitorPolicy({ producing: true, route: 'bluetooth' }).hint).toBeUndefined()
    expect(monitorPolicy({ producing: true, route: 'speaker' }).hint).toBe('plug-in-headphones')
  })

  it('flags degraded only for the bluetooth-while-producing case', () => {
    expect(monitorPolicy({ producing: true, route: 'bluetooth' }).degraded).toBe(true)
    expect(monitorPolicy({ producing: true, route: 'wired' }).degraded).toBeUndefined()
    expect(monitorPolicy({ producing: true, route: 'speaker' }).degraded).toBeUndefined()
    expect(monitorPolicy({ producing: false, route: 'bluetooth' }).degraded).toBeUndefined()
  })
})

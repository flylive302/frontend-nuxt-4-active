import { describe, it, expect } from 'vitest'
import {
  resolveJoinAudioOutcome,
  isSilentJoin,
  isReportableJoinOutcome,
  silentJoinStage,
  type JoinAudioObservation,
  type JoinAudioOutcome,
} from '../../app/utils/silent-join'

/**
 * A join that is going well: completed, unmuted, one speaker announced and
 * consumed, audio advancing. Every case below is this minus one thing.
 */
const observation = (
  overrides: Partial<JoinAudioObservation> = {},
): JoinAudioObservation => ({
  joinCompleted: true,
  playbackMuted: false,
  producersAnnounced: 1,
  consumersCreated: 1,
  audioAdvanced: true,
  checkpoint: 'deadline',
  ...overrides,
})

describe('resolveJoinAudioOutcome — the five AC cases', () => {
  it('audio flowed: healthy', () => {
    expect(resolveJoinAudioOutcome(observation())).toBe('flowing')
  })

  it('nothing arrived within the timeout: silent, but only after the extension', () => {
    const silent = { audioAdvanced: false }

    // At the deadline it is undecided — this is what gives `flowing-late` its chance.
    expect(resolveJoinAudioOutcome(observation({ ...silent, checkpoint: 'deadline' }))).toBeNull()
    expect(resolveJoinAudioOutcome(observation({ ...silent, checkpoint: 'late' }))).toBe('silent')
  })

  it('arrived late: reported as its own outcome, never as silent', () => {
    expect(
      resolveJoinAudioOutcome(observation({ audioAdvanced: true, checkpoint: 'late' })),
    ).toBe('flowing-late')
  })

  it('the user muted playback themselves: never counted as a silent join', () => {
    const muted = observation({ audioAdvanced: false, playbackMuted: true, checkpoint: 'late' })

    expect(resolveJoinAudioOutcome(muted)).toBe('playback-muted')
    expect(isSilentJoin(resolveJoinAudioOutcome(muted) as JoinAudioOutcome)).toBe(false)
  })

  it('the join failed outright: a different fault, not a silent join', () => {
    const failed = observation({ joinCompleted: false, audioAdvanced: false, checkpoint: 'late' })

    expect(resolveJoinAudioOutcome(failed)).toBe('join-failed')
    expect(isSilentJoin(resolveJoinAudioOutcome(failed) as JoinAudioOutcome)).toBe(false)
  })
})

describe('resolveJoinAudioOutcome — the quiet room, which would otherwise dominate', () => {
  it('grades a room where nobody was speaking as idle, not silent', () => {
    expect(
      resolveJoinAudioOutcome(
        observation({
          producersAnnounced: 0,
          consumersCreated: 0,
          audioAdvanced: false,
          checkpoint: 'late',
        }),
      ),
    ).toBe('idle')
  })

  it('decides idle at the deadline rather than waiting out the extension', () => {
    expect(
      resolveJoinAudioOutcome(
        observation({
          producersAnnounced: 0,
          consumersCreated: 0,
          audioAdvanced: false,
          checkpoint: 'deadline',
        }),
      ),
    ).toBe('idle')
  })
})

describe('resolveJoinAudioOutcome — precedence', () => {
  it('a join that never completed is graded first, whatever else is true', () => {
    expect(
      resolveJoinAudioOutcome(
        observation({ joinCompleted: false, playbackMuted: true, audioAdvanced: true }),
      ),
    ).toBe('join-failed')
  })

  it('evidence of flow beats mute — a muted element is not paused, so it still advances', () => {
    expect(
      resolveJoinAudioOutcome(observation({ playbackMuted: true, audioAdvanced: true })),
    ).toBe('flowing')
  })

  it('mute beats idle, so the more specific reason for not grading wins', () => {
    expect(
      resolveJoinAudioOutcome(
        observation({
          playbackMuted: true,
          producersAnnounced: 0,
          consumersCreated: 0,
          audioAdvanced: false,
          checkpoint: 'late',
        }),
      ),
    ).toBe('playback-muted')
  })

  it('never returns null once the extension has elapsed', () => {
    const checkpoints = [true, false].flatMap((joinCompleted) =>
      [true, false].flatMap((playbackMuted) =>
        [0, 1].flatMap((producersAnnounced) =>
          [true, false].map((audioAdvanced) =>
            observation({
              joinCompleted,
              playbackMuted,
              producersAnnounced,
              consumersCreated: 0,
              audioAdvanced,
              checkpoint: 'late' as const,
            }),
          ),
        ),
      ),
    )

    for (const input of checkpoints) {
      expect(resolveJoinAudioOutcome(input)).not.toBeNull()
    }
  })

  it('only ever returns null for a join that currently looks silent at the deadline', () => {
    expect(
      resolveJoinAudioOutcome(observation({ audioAdvanced: false, checkpoint: 'deadline' })),
    ).toBeNull()
  })
})

describe('isReportableJoinOutcome', () => {
  it('reports the fault and its near miss', () => {
    expect(isReportableJoinOutcome('silent')).toBe(true)
    expect(isReportableJoinOutcome('flowing-late')).toBe(true)
    expect(isReportableJoinOutcome('join-failed')).toBe(true)
  })

  it('does not spend event volume on the three common healthy states', () => {
    expect(isReportableJoinOutcome('flowing')).toBe(false)
    expect(isReportableJoinOutcome('idle')).toBe(false)
    expect(isReportableJoinOutcome('playback-muted')).toBe(false)
  })
})

describe('silentJoinStage — which half of the pipeline broke', () => {
  it('never-consumed: the announcement never became a consumer', () => {
    expect(silentJoinStage({ producersAnnounced: 2, consumersCreated: 0 })).toBe('never-consumed')
  })

  it('partially-consumed: some announcements were dropped', () => {
    expect(silentJoinStage({ producersAnnounced: 3, consumersCreated: 1 })).toBe(
      'partially-consumed',
    )
  })

  it('no-media: every producer was consumed and no bytes arrived', () => {
    expect(silentJoinStage({ producersAnnounced: 2, consumersCreated: 2 })).toBe('no-media')
  })

  it('treats more consumers than announcements as no-media, not partial', () => {
    // Can happen across a rebuild, where a consumer outlives its announcement.
    expect(silentJoinStage({ producersAnnounced: 1, consumersCreated: 2 })).toBe('no-media')
  })
})

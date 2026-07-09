import { REACTION_MIN_DISPLAY_MS } from '~/constants/reactions';

export interface ReactionPlaybackPlan {
  loops: number;
}

/**
 * Pure playback-rule util for Seat Reactions (ADR 0015).
 *
 * - `durationMs < REACTION_MIN_DISPLAY_MS` → loop enough times to reach/exceed
 *   the minimum display window, always ending on a loop boundary.
 * - `durationMs >= REACTION_MIN_DISPLAY_MS` → play exactly once.
 * - Degenerate input (0, negative, NaN, non-finite) → 1 loop (fail safe: never
 *   divide by zero / loop forever).
 */
export function planReactionPlayback(durationMs: number): ReactionPlaybackPlan {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return { loops: 1 };
  }

  if (durationMs >= REACTION_MIN_DISPLAY_MS) {
    return { loops: 1 };
  }

  return { loops: Math.ceil(REACTION_MIN_DISPLAY_MS / durationMs) };
}

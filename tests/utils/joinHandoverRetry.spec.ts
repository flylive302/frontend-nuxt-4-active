import { describe, expect, it } from 'vitest';
import { shouldRetryJoinAfterHandover } from '~/utils/socket/joinHandoverRetry';
import { isRoomHandoverSocketError, resolveSocketErrorMessage } from '~/utils/socket/socketErrorMessages';

// keep-watching 20: a join routed to a non-owner server during an instance
// refresh answers `room_handover`; exactly ONE retry, and only for that code.
describe('shouldRetryJoinAfterHandover', () => {
  it('retries once for room_handover', () => {
    expect(shouldRetryJoinAfterHandover('room_handover', 0)).toBe(true);
  });

  it('does NOT retry a second time — a repeat is an outage, not a hand-over', () => {
    expect(shouldRetryJoinAfterHandover('room_handover', 1)).toBe(false);
  });

  it('never retries other errors, including the generic internal error', () => {
    expect(shouldRetryJoinAfterHandover('Internal server error', 0)).toBe(false);
    expect(shouldRetryJoinAfterHandover('room_blocked', 0)).toBe(false);
    expect(shouldRetryJoinAfterHandover(undefined, 0)).toBe(false);
    expect(shouldRetryJoinAfterHandover(null, 0)).toBe(false);
  });

  it('honours an explicit max', () => {
    expect(shouldRetryJoinAfterHandover('room_handover', 2, 3)).toBe(true);
    expect(shouldRetryJoinAfterHandover('room_handover', 3, 3)).toBe(false);
  });
});

describe('room_handover error helpers', () => {
  it('isRoomHandoverSocketError matches only the machine-readable code', () => {
    expect(isRoomHandoverSocketError('room_handover')).toBe(true);
    expect(isRoomHandoverSocketError('room_blocked')).toBe(false);
  });

  it('resolveSocketErrorMessage gives a human message for the final failure', () => {
    expect(resolveSocketErrorMessage('room_handover', 'Failed to join room')).toMatch(/switching over/);
  });
});

/**
 * Saved-Playlist eviction planner — pure (room-music-playlist/01).
 *
 * Decides which saved songs to delete so `incomingBytes` fits under the byte
 * budget. Eviction order: least-recently-played first (`lastPlayedAt`, falling
 * back to `addedAt` for never-played songs). Songs in `protectedKeys` (the live
 * queue) are never evicted — evicting them would make a song the DJ can see
 * silently vanish after the next app kill.
 */

export interface EvictableRecord {
  key: string;
  size: number;
  addedAt: number;
  lastPlayedAt: number | null;
}

export interface EvictionPlan {
  /** Keys to delete, in eviction order. Empty when nothing needs to go. */
  evictKeys: string[];
  /** Whether `incomingBytes` fits once `evictKeys` are deleted. */
  fits: boolean;
}

/** Recency used for eviction ordering: last play, else the time it was saved. */
function recency(record: EvictableRecord): number {
  return record.lastPlayedAt ?? record.addedAt;
}

/**
 * Plan the evictions needed to admit `incomingBytes` under `capBytes`.
 *
 * When even evicting every unprotected record cannot make room, returns
 * `fits: false` with **no** evictions — never delete songs for a save that will
 * not happen anyway.
 */
export function planEviction(
  records: readonly EvictableRecord[],
  protectedKeys: ReadonlySet<string>,
  incomingBytes: number,
  capBytes: number,
): EvictionPlan {
  let used = records.reduce((sum, r) => sum + r.size, 0);
  if (used + incomingBytes <= capBytes) return { evictKeys: [], fits: true };

  const candidates = records
    .filter((r) => !protectedKeys.has(r.key))
    .sort((a, b) => recency(a) - recency(b));

  const evictKeys: string[] = [];
  for (const record of candidates) {
    if (used + incomingBytes <= capBytes) break;
    evictKeys.push(record.key);
    used -= record.size;
  }

  if (used + incomingBytes > capBytes) return { evictKeys: [], fits: false };
  return { evictKeys, fits: true };
}

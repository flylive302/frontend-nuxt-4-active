/**
 * Playlist queue model — pure, framework-agnostic.
 *
 * Owns the DJ's ordered track list and every queue operation. This is the
 * isolation boundary the PRD calls for: **no Vue reactivity, no Web Audio, no
 * socket dependencies** — just data and operations, fully unit-testable. The
 * playback engine (a separate module) consumes `current` / `next()` / `prev()`
 * and owns all decoding; the queue only ever holds cheap `File` handles, never
 * decoded PCM. See ADR 0006 (single-DJ, client-local, ephemeral Playlist).
 *
 * Documented boundary semantics:
 * - `add` appends in order; once at the cap (`PLAYLIST_MAX_TRACKS`), further
 *   files are ignored and only the tracks actually appended are returned.
 * - Removing the **currently playing** track is a skip-to-next: the following
 *   track slides into the current slot and keeps playing. Removing the last
 *   track while it is current leaves `current` on the new last track; removing
 *   the only track leaves a well-defined empty queue (`current === null`).
 * - `next()` at the end returns `null` and leaves `current` unchanged.
 * - `prev()` at the start restarts the current track (returns the same track,
 *   which the engine seeks to 0); on an empty queue it returns `null`.
 */
import { PLAYLIST_MAX_TRACKS } from '~/constants/room';
import type { Track } from '~/types/room/audio-player';

/** Module-level monotonic counter — guarantees ids are unique across instances. */
let trackIdCounter = 0;

/** Derive a display title from a filename: drop the directory and last extension. */
function deriveTitle(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  const dot = base.lastIndexOf('.');
  const title = dot > 0 ? base.slice(0, dot) : base;
  return title.trim() || base;
}

function createTrack(file: File): Track {
  return {
    id: `track-${++trackIdCounter}`,
    file,
    title: deriveTitle(file.name),
    duration: null,
  };
}

export class PlaylistQueue {
  /** Ordered backing list. Never exposed by reference — see `tracks`. */
  private readonly items: Track[] = [];

  /** Index of the current track, or -1 when the queue is empty. */
  private index = -1;

  /** Read-only snapshot of the queue in order. */
  get tracks(): readonly Track[] {
    return this.items.slice();
  }

  /** The currently playing/selected track, or `null` when the queue is empty. */
  get current(): Track | null {
    return this.index >= 0 ? (this.items[this.index] ?? null) : null;
  }

  /** Whether a `next()` would advance to a real track. */
  get hasNext(): boolean {
    return this.index >= 0 && this.index < this.items.length - 1;
  }

  /** Whether a `prev()` would move to an earlier track (vs. restart current). */
  get hasPrev(): boolean {
    return this.index > 0;
  }

  /** Number of tracks currently queued. */
  get length(): number {
    return this.items.length;
  }

  /**
   * Append one or more files in order. Capacity is bounded by
   * `PLAYLIST_MAX_TRACKS`; files past the cap are ignored. Returns only the
   * tracks actually appended (empty array if already full). The first add into
   * an empty queue sets `current` to the first new track.
   */
  add(files: File | File[]): Track[] {
    const list = Array.isArray(files) ? files : [files];
    const created: Track[] = [];

    for (const file of list) {
      if (this.items.length >= PLAYLIST_MAX_TRACKS) break;
      const track = createTrack(file);
      this.items.push(track);
      created.push(track);
    }

    if (this.index === -1 && this.items.length > 0) {
      this.index = 0;
    }

    return created;
  }

  /**
   * Remove the track with `id`. Removing the current track is a skip: the next
   * track takes the current slot (or, if it was the last, `current` falls back
   * to the new last track). Removing a track before the current one keeps the
   * same track current. Unknown ids are a no-op.
   */
  remove(id: string): void {
    const removeAt = this.items.findIndex((t) => t.id === id);
    if (removeAt === -1) return;

    this.items.splice(removeAt, 1);

    if (this.items.length === 0) {
      this.index = -1;
      return;
    }

    // Removed before current → shift index left to keep pointing at same track.
    if (removeAt < this.index) {
      this.index -= 1;
    }

    // Clamp so the current index always references a real track (handles
    // removing the current-and-last track → fall back to the new last).
    if (this.index > this.items.length - 1) {
      this.index = this.items.length - 1;
    }
  }

  /**
   * Move the track at `fromIndex` to `toIndex`, preserving the relative order of
   * every other track. `current` continues to reference the same track.
   * Out-of-range or no-op moves are ignored.
   */
  reorder(fromIndex: number, toIndex: number): void {
    const last = this.items.length - 1;
    if (
      fromIndex < 0 ||
      fromIndex > last ||
      toIndex < 0 ||
      toIndex > last ||
      fromIndex === toIndex
    ) {
      return;
    }

    const currentTrack = this.current;
    const [moved] = this.items.splice(fromIndex, 1);
    this.items.splice(toIndex, 0, moved as Track);

    // Re-resolve the current index against the track identity, not its position.
    if (currentTrack) {
      this.index = this.items.findIndex((t) => t.id === currentTrack.id);
    }
  }

  /**
   * Advance to and return the next track, or `null` at the end (leaving
   * `current` unchanged).
   */
  next(): Track | null {
    if (!this.hasNext) return null;
    this.index += 1;
    return this.current;
  }

  /**
   * Move to and return the previous track. At the start, returns the current
   * track unchanged (a restart signal for the engine). `null` on an empty queue.
   */
  prev(): Track | null {
    if (this.index <= 0) return this.current;
    this.index -= 1;
    return this.current;
  }
}

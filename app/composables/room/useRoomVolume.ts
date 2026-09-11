// ========================================
// Room Playback Volume
// ========================================
//
// Owns the listener-side volume for a room: the level, its persistence, and the
// mute toggle. The page only binds to it.
//
// Mute is DERIVED (`volume === 0`), not a second flag. The previous page-local
// version carried an `isMuted` ref alongside the level, so the slider read
// `isMuted ? 0 : volume` and the two could disagree after any path that wrote
// one without the other.
// ========================================

import type { Ref, ComputedRef } from 'vue';
import {
  ROOM_VOLUME_STORAGE_KEY,
  DEFAULT_ROOM_VOLUME,
  FALLBACK_UNMUTE_VOLUME,
  LOW_VOLUME_ICON_THRESHOLD,
  VOLUME_PERSIST_DEBOUNCE_MS,
} from '~/constants/room';

// ============================================
// Types
// ============================================

export interface UseRoomVolumeReturn {
  /** Current playback level, 0–1. Zero means muted. */
  volume: Ref<number>;
  /** Derived from `volume` — never stored separately. */
  isMuted: ComputedRef<boolean>;
  /** Speaker icon matching the current level. */
  volumeIcon: ComputedRef<string>;
  /** Set the level from the slider (GATE: clamps, rejects NaN). */
  setLevel: (value: number | undefined) => void;
  /** Mute, or restore the last non-zero level. */
  toggleMute: () => void;
  /** Push the persisted level into the audio pipeline (call on mount). */
  applyStoredLevel: () => void;
}

// ============================================
// Helpers
// ============================================

/** Read the persisted level, falling back on absent/corrupt/out-of-range values. */
function readStoredVolume(): number {
  if (!import.meta.client) return DEFAULT_ROOM_VOLUME;

  try {
    const raw = localStorage.getItem(ROOM_VOLUME_STORAGE_KEY);
    if (raw === null) return DEFAULT_ROOM_VOLUME;

    const parsed = Number.parseFloat(raw);
    // `parseFloat('')` and `parseFloat('abc')` both yield NaN, which would have
    // propagated straight into `gainNode.gain.value` and silenced the room.
    return Number.isFinite(parsed) ? clampVolume(parsed) : DEFAULT_ROOM_VOLUME;
  } catch {
    return DEFAULT_ROOM_VOLUME;
  }
}

function writeStoredVolume(value: number): void {
  if (!import.meta.client) return;
  try {
    localStorage.setItem(ROOM_VOLUME_STORAGE_KEY, String(value));
  } catch {
    // Private-mode / quota failures must not break playback.
  }
}

function clampVolume(value: number): number {
  return Math.min(1, Math.max(0, value));
}

// ============================================
// Composable
// ============================================

/**
 * @param applyVolume Sink that pushes a level into the audio pipeline
 *                    (`setVolume` from `useRoomAudio`).
 */
export function useRoomVolume(applyVolume: (value: number) => void): UseRoomVolumeReturn {
  const stored = readStoredVolume();

  const volume = ref(stored);
  /** Level to come back to on unmute. Never zero. */
  const lastNonZeroVolume = ref(stored > 0 ? stored : DEFAULT_ROOM_VOLUME);

  const isMuted = computed(() => volume.value === 0);

  const volumeIcon = computed(() => {
    if (isMuted.value) return 'i-lucide-volume-x';
    if (volume.value < LOW_VOLUME_ICON_THRESHOLD) return 'i-lucide-volume-1';
    return 'i-lucide-volume-2';
  });

  /**
   * Pending persist. `USlider` at step 0.05 emits on every drag tick, so one
   * gesture is ~20 events — the level must reach the audio pipeline on each of
   * them, but only the last one needs to reach localStorage.
   */
  let persistTimer: ReturnType<typeof setTimeout> | null = null;
  let persistPending: number | null = null;

  function flushPersist(): void {
    if (persistTimer !== null) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    if (persistPending === null) return;
    writeStoredVolume(persistPending);
    persistPending = null;
  }

  function schedulePersist(level: number): void {
    persistPending = level;
    if (persistTimer !== null) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      persistTimer = null;
      flushPersist();
    }, VOLUME_PERSIST_DEBOUNCE_MS);
  }

  /** EXECUTE: single write path — state, pipeline and storage always agree. */
  function commit(value: number): void {
    const level = clampVolume(value);
    volume.value = level;
    if (level > 0) lastNonZeroVolume.value = level;
    // Audible change is immediate; only the storage write is deferred.
    applyVolume(level);
    schedulePersist(level);
  }

  // Leaving the room mid-drag would otherwise drop the last level on the floor.
  onScopeDispose(flushPersist);

  function setLevel(value: number | undefined): void {
    // GATE: the slider emits `undefined` while dragging past its bounds.
    if (value === undefined || !Number.isFinite(value)) return;
    commit(value);
  }

  function toggleMute(): void {
    if (isMuted.value) {
      commit(lastNonZeroVolume.value > 0 ? lastNonZeroVolume.value : FALLBACK_UNMUTE_VOLUME);
      return;
    }
    commit(0);
  }

  function applyStoredLevel(): void {
    applyVolume(volume.value);
  }

  return { volume, isMuted, volumeIcon, setLevel, toggleMute, applyStoredLevel };
}

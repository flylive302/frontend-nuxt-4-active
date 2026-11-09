import { defineStore } from 'pinia'
import { ROOM_VIDEO_CLOCK_SAMPLE_COUNT } from '~/constants/room'
import { estimateOffset } from '~/utils/video-clock'
import type { RoomVideoSnapshot } from '~/types/room/video'

/**
 * Room Video — ephemeral, per-room state (room-video-player 06).
 *
 * NOT persisted: the Snapshot changes on every transport action and is
 * re-delivered by the `room:join` ack. Written only by the video composables
 * (listeners on socket events, the room join/leave hook, panel actions).
 */
export const useRoomVideoStore = defineStore('roomVideoStore', () => {
  // ========================================
  // State
  // ========================================

  /** Room this state belongs to; socket events for any other room are dropped. */
  const roomId = ref<string | null>(null)

  /** `videoPlayerEnabled` from the join ack. False hides every entry point. */
  const enabled = ref(false)

  /** Authoritative playback state, or null when no Room Video is live. */
  const snapshot = ref<RoomVideoSnapshot | null>(null)

  /** Watcher-local: panel shrunk to the 40 px bar. Never sent anywhere. */
  const collapsed = ref(false)

  /**
   * The Watcher tapped collapse / expand this session (room-video-player 09). Once
   * true, the tier / preference default never overrides `collapsed` again.
   */
  const collapsedByUser = ref(false)

  /** Local player position (s), refreshed by the sync tick — feeds the Controller's seek bar (07). */
  const positionSec = ref(0)

  /** Local player duration (s); 0 = unknown or live (no seek bar). */
  const durationSec = ref(0)

  /** Watcher-local mute. Never sent anywhere. */
  const muted = ref(false)

  /** The browser refused unmuted autoplay; the panel shows one "Tap to watch". */
  const needsTap = ref(false)

  /** This device could not load / play the current Source (muted "can't play" state). */
  const playbackFailed = ref(false)

  /** Recent `serverClock - localClock` samples (ms), oldest first. */
  const clockSamples = ref<number[]>([])

  // ========================================
  // Computed
  // ========================================

  const isActive = computed<boolean>(() => enabled.value && snapshot.value !== null)

  const isController = computed<boolean>(() => {
    const userId = useAuthStore().user?.id
    return snapshot.value !== null && userId !== undefined && snapshot.value.controllerUserId === userId
  })

  /** Best `serverClock - localClock` estimate (ms); 0 until a sample exists. */
  const clockOffsetMs = computed<number>(() => estimateOffset(clockSamples.value) ?? 0)

  // ========================================
  // Setters
  // ========================================

  /** Bind to a room from its join ack. Replaces any previous room's state. */
  function startSession(nextRoomId: string, nextEnabled: boolean): void {
    roomId.value = nextRoomId
    enabled.value = nextEnabled
    snapshot.value = null
    needsTap.value = false
    playbackFailed.value = false
    clockSamples.value = []
  }

  /**
   * Snapshot from the join ack: taken as-is (no revision guard — a fresh join
   * starts a fresh revision history).
   */
  function replaceSnapshot(next: RoomVideoSnapshot | null): void {
    if (next === null || next.revision !== snapshot.value?.revision) clearPlaybackFlags(next)
    snapshot.value = next
  }

  /**
   * Snapshot from `videoPlayer:stateChanged`. `null` always clears (and resets the
   * revision history — the next session starts again at 1). A Snapshot whose
   * revision is not newer than the held one is dropped. Returns true if applied.
   */
  function applySnapshot(next: RoomVideoSnapshot | null): boolean {
    if (next === null) {
      clearPlaybackFlags(null)
      snapshot.value = null
      return true
    }
    const held = snapshot.value
    if (held !== null && next.revision <= held.revision) return false
    clearPlaybackFlags(next)
    snapshot.value = next
    return true
  }

  /** A new Source (or no video) gets a fresh chance to play; same Source keeps its flags. */
  function clearPlaybackFlags(next: RoomVideoSnapshot | null): void {
    const sameSource =
      next !== null && snapshot.value !== null && JSON.stringify(next.source) === JSON.stringify(snapshot.value.source)
    if (sameSource) return
    needsTap.value = false
    playbackFailed.value = false
  }

  /** Record one `serverTs - receivedAt` sample; keeps only the most recent few. */
  function addClockSample(sampleMs: number): void {
    clockSamples.value = [...clockSamples.value, sampleMs].slice(-ROOM_VIDEO_CLOCK_SAMPLE_COUNT)
  }

  /** Programmatic collapse (tier / preference default). Does not mark a user choice. */
  function setCollapsed(value: boolean): void {
    collapsed.value = value
  }

  /** The Watcher's own collapse / expand tap; wins over every default for the session. */
  function setCollapsedByUser(value: boolean): void {
    collapsed.value = value
    collapsedByUser.value = true
  }

  function setProgress(position: number, duration: number): void {
    positionSec.value = position
    durationSec.value = duration
  }

  function setMuted(value: boolean): void {
    muted.value = value
  }

  function setNeedsTap(value: boolean): void {
    needsTap.value = value
  }

  function setPlaybackFailed(value: boolean): void {
    playbackFailed.value = value
  }

  // ========================================
  // Reset
  // ========================================

  /** Leaving the room: drop everything, including the Watcher-local choices. */
  function $reset(): void {
    roomId.value = null
    enabled.value = false
    snapshot.value = null
    collapsed.value = false
    collapsedByUser.value = false
    positionSec.value = 0
    durationSec.value = 0
    muted.value = false
    needsTap.value = false
    playbackFailed.value = false
    clockSamples.value = []
  }

  // ========================================
  // Return
  // ========================================

  return {
    roomId,
    enabled,
    snapshot,
    collapsed,
    collapsedByUser,
    positionSec,
    durationSec,
    muted,
    needsTap,
    playbackFailed,
    clockSamples,
    isActive,
    isController,
    clockOffsetMs,
    startSession,
    replaceSnapshot,
    applySnapshot,
    addClockSample,
    setCollapsed,
    setCollapsedByUser,
    setProgress,
    setMuted,
    setNeedsTap,
    setPlaybackFailed,
    $reset,
  }
})

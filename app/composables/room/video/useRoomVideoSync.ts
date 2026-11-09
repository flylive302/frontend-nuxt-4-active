/**
 * useRoomVideoSync — infrastructure: owns the ONE playback adapter of the Room
 * Video and keeps it on the server Snapshot (room-video-player 06).
 *
 * Lifecycle: the panel calls `attach(slotEl)` when it mounts and `detach()` when it
 * unmounts. Everything below — the Snapshot watcher, the 1 s drift tick, the Controller
 * heartbeat interval, the away subscription, the motion-cover token — lives in ONE
 * module-scoped effect scope (plus the two intervals) created by `attach`, so it installs
 * once no matter how many callers use this composable (a `watch` inside a shared
 * composable otherwise fires once per caller).
 *
 * Sync rule: expected position = `expectedPosition(snapshot, Date.now() + offset)`.
 * Server transport events are applied at once (seek only when off by more than the
 * drift threshold); the drift tick corrects with ONE seek, then stays quiet for a
 * cooldown so a multi-second gift-burst stall never stacks seeks.
 *
 * Controller duties (ticket 07): every `ROOM_VIDEO_HEARTBEAT_MS` push the local
 * position through the injected `RoomVideoTransport` (never while away / blocked /
 * failed / not yet really playing, so a stale position never reaches the server
 * Snapshot), emit `ended` once per loaded Source, and mirror position + duration into
 * the store for the seek bar.
 *
 * Away (ticket 09): backgrounded / hidden = a LOCAL pause only (the store Snapshot is
 * never touched, nothing is emitted); coming back does one resync seek, then plays.
 * Tier default (ticket 09): a weak phone, or the "Always start video collapsed"
 * switch, opens the panel collapsed and holds playback until the user expands; the
 * user's own collapse / expand always wins afterwards.
 *
 * YouTube (ticket 08): one more factory. Two platform rules (`shouldMountVideoPlayer`):
 * a platform that cannot embed YouTube (iOS) gets no player — the panel shows the
 * "Open on YouTube" card and the Snapshot keeps running, which is NOT a playback
 * failure; on Capacitor a Watcher's collapsed YouTube iframe is destroyed (not
 * hidden) to free the decoder and rebuilt on expand. The Controller keeps theirs.
 */
import { effectScope, watch, type EffectScope } from 'vue'
import { useRoomVideoActions } from '~/composables/room/video/useRoomVideoActions'
import { acquireCovered, isAway, releaseCovered, subscribeAway } from '~/services/motionPauseOrchestrator'
import { createHtmlVideoAdapter } from '~/services/roomVideoHtmlAdapter'
import { createYouTubeVideoAdapter } from '~/services/roomVideoYouTubeAdapter'
import { readRoomVideoPlatform } from '~/composables/room/video/useRoomVideoYouTube'
import { useFxPreferencesStore } from '~/stores/fxPreferences'
import { useRoomVideoStore } from '~/stores/roomVideo'
import {
  ROOM_VIDEO_DRIFT_TICK_MS,
  ROOM_VIDEO_HEARTBEAT_MS,
  ROOM_VIDEO_SEEK_COOLDOWN_MS,
} from '~/constants/room'
import type { DeviceClass } from '~/utils/device-class'
import { readFrameAnimationTier } from '~/utils/frame-animation-tier'
import { createLogger } from '~/utils/logger'
import { expectedPosition, shouldCorrect } from '~/utils/video-clock'
import { shouldMountVideoPlayer } from '~/utils/video-platform'
import { resolveVideoStartCollapsed } from '~/utils/video-start-collapsed'
import type {
  RoomVideoSnapshot,
  RoomVideoSource,
  RoomVideoTransport,
  VideoAdapterError,
  VideoPlayerAdapter,
  VideoPlayerAdapterFactory,
} from '~/types/room/video'

type AdapterKind = RoomVideoSource['kind']

/** Backend per Source kind. */
export type RoomVideoAdapterFactories = Partial<Record<AdapterKind, VideoPlayerAdapterFactory>>

const DEFAULT_FACTORIES: RoomVideoAdapterFactories = {
  url: createHtmlVideoAdapter,
  youtube: createYouTubeVideoAdapter,
}

const PLAYBACK_FAILED_MESSAGE = "This link couldn't be played. Try another one."

const log = createLogger('[RoomVideoSync]')

interface SyncState {
  factories: RoomVideoAdapterFactories
  /** Controller emits (heartbeat / ended); null while detached. */
  transport: RoomVideoTransport | null
  container: HTMLElement | null
  adapter: VideoPlayerAdapter | null
  adapterKind: AdapterKind | null
  loadedSourceKey: string | null
  /** The adapter reported `playing` since the last load — only then is drift meaningful. */
  playingSinceLoad: boolean
  /**
   * The adapter reported `ready` (metadata loaded, pending seek applied) or `playing`
   * since the last load — only then is `currentTime()` the real position, not 0.
   */
  readySinceLoad: boolean
  lastSeekAt: number
  adapterUnsubscribers: Array<() => void>
  scope: EffectScope | null
  tick: ReturnType<typeof setInterval> | null
  heartbeatTimer: ReturnType<typeof setInterval> | null
  awayUnsubscribe: (() => void) | null
  coverToken: string | null
  /** Source key the Controller was already told about, so one bad link = one toast. */
  failureToastKey: string | null
  /** Source key `transport.ended()` was already sent for: one `ended` per loaded Source. */
  endedEmittedKey: string | null
}

const state: SyncState = {
  factories: DEFAULT_FACTORIES,
  transport: null,
  container: null,
  adapter: null,
  adapterKind: null,
  loadedSourceKey: null,
  playingSinceLoad: false,
  readySinceLoad: false,
  lastSeekAt: 0,
  adapterUnsubscribers: [],
  scope: null,
  tick: null,
  heartbeatTimer: null,
  awayUnsubscribe: null,
  coverToken: null,
  failureToastKey: null,
  endedEmittedKey: null,
}

/** Hardware does not change for the life of the page: read the tier once, on first use. */
let deviceTier: DeviceClass | null = null

function readDeviceTier(): DeviceClass {
  deviceTier ??= readFrameAnimationTier()
  return deviceTier
}

/** Test-only: forget the cached device tier between cases. */
export function __resetRoomVideoSyncTierForTest(): void {
  deviceTier = null
}

export function useRoomVideoSync(
  factories: RoomVideoAdapterFactories = DEFAULT_FACTORIES,
  transport?: RoomVideoTransport,
) {
  const store = useRoomVideoStore()
  const fxPrefs = useFxPreferencesStore()
  // Resolved in setup context like the store / toast: `useRoomVideoActions` owns a
  // `useRoomHierarchy` watchEffect, so it can never be called from a timer or adapter callback.
  const controllerTransport: RoomVideoTransport = transport ?? useRoomVideoActions()
  // Captured in setup context: adapter events fire long after it, where Nuxt
  // composables can no longer resolve the app instance.
  const toast = useToast()

  // ========================================
  // Lifecycle (panel mount / unmount)
  // ========================================

  /** Bind to the panel's player slot and start following the Snapshot. */
  function attach(container: HTMLElement): void {
    if (state.container === container) return
    detach()
    state.factories = factories
    state.transport = controllerTransport
    state.container = container
    // Before the immediate Snapshot watcher below: a default-collapsed video must
    // already hold playback (`needsTap`) when the first Snapshot is applied.
    applyStartDefault()
    state.scope = effectScope(true)
    state.scope.run(() => {
      watch(() => store.snapshot, applySnapshot, { immediate: true })
      watch(() => store.muted, (muted) => state.adapter?.setMuted(muted))
      // Collapse / Controller change can flip whether a YouTube player may exist (Capacitor).
      // Only act on a real mismatch: the Snapshot watcher above already handles Source changes.
      watch(playerMountable, (mountable) => {
        if (mountable !== (state.adapter !== null)) applySnapshot(store.snapshot)
      })
      watch(shouldCoverSeats, setSeatsCovered, { immediate: true })
    })
    state.awayUnsubscribe = subscribeAway(onAwayChange)
    state.tick = setInterval(driftTick, ROOM_VIDEO_DRIFT_TICK_MS)
    state.heartbeatTimer = setInterval(heartbeatTick, ROOM_VIDEO_HEARTBEAT_MS)
  }

  /** Stop following and release every resource. Idempotent. */
  function detach(): void {
    state.scope?.stop()
    state.scope = null
    if (state.tick !== null) clearInterval(state.tick)
    state.tick = null
    if (state.heartbeatTimer !== null) clearInterval(state.heartbeatTimer)
    state.heartbeatTimer = null
    state.awayUnsubscribe?.()
    state.awayUnsubscribe = null
    setSeatsCovered(false)
    destroyAdapter()
    state.container = null
    state.transport = null
    state.failureToastKey = null
  }

  // ========================================
  // Watcher-local view controls (never sent to the server)
  // ========================================

  /** The one "Tap to watch" gesture after an autoplay refusal: play from the expected second. */
  async function tapToWatch(): Promise<void> {
    store.setNeedsTap(false)
    const snapshot = store.snapshot
    if (!state.adapter || !snapshot) return
    seekTo(expected(snapshot))
    if (!snapshot.paused) await state.adapter.play()
  }

  /** The Watcher's own collapse / expand: sticks for the session. Expanding a held video plays it. */
  function toggleCollapsed(): void {
    const collapse = !store.collapsed
    store.setCollapsedByUser(collapse)
    if (!collapse && store.needsTap) void tapToWatch()
  }

  function toggleMuted(): void {
    store.setMuted(!store.muted)
  }

  // ========================================
  // Snapshot → adapter
  // ========================================

  function applySnapshot(snapshot: RoomVideoSnapshot | null): void {
    if (snapshot === null || state.container === null) {
      destroyAdapter()
      return
    }
    // The "Open on YouTube" card, or a Watcher's collapsed YouTube on Capacitor: no player, no failure.
    if (!playerMountable()) {
      destroyAdapter()
      return
    }

    const adapter = ensureAdapter(snapshot.source.kind)
    if (adapter === null) {
      store.setPlaybackFailed(true)
      return
    }

    const key = sourceKey(snapshot.source)
    const freshLoad = key !== state.loadedSourceKey
    if (freshLoad) {
      adapter.load(snapshot.source)
      state.loadedSourceKey = key
      state.playingSinceLoad = false
      state.readySinceLoad = false
      state.endedEmittedKey = null
      // The store clears `needsTap` for a new Source: a still default-collapsed panel holds it again.
      if (isHeldByStartDefault()) store.setNeedsTap(true)
    }

    const target = expected(snapshot)
    if (freshLoad || shouldCorrect(adapter.currentTime(), target)) seekTo(target)

    if (snapshot.paused) {
      adapter.pause()
    } else if (!store.needsTap && !store.playbackFailed && !isAway()) {
      void adapter.play()
    }
  }

  /** One corrective seek per cooldown, and only once the player is really playing. */
  function driftTick(): void {
    if (isAway()) return
    publishProgress()
    const snapshot = store.snapshot
    const adapter = state.adapter
    if (!adapter || !snapshot || snapshot.paused || !state.playingSinceLoad) return
    if (store.needsTap || store.playbackFailed) return
    if (Date.now() - state.lastSeekAt < ROOM_VIDEO_SEEK_COOLDOWN_MS) return

    const target = expected(snapshot)
    if (shouldCorrect(adapter.currentTime(), target)) {
      log.debug('Drift correction', { local: adapter.currentTime(), expected: target })
      seekTo(target)
    }
  }

  /**
   * Controller only, every `ROOM_VIDEO_HEARTBEAT_MS`: tell the server where this player
   * is. Skipped whenever the local position could be stale or meaningless — a blocked,
   * failed, backgrounded or not-yet-started player must never rewrite the Snapshot.
   */
  function heartbeatTick(): void {
    const snapshot = store.snapshot
    const adapter = state.adapter
    if (!store.isController || !snapshot || !adapter || !state.transport) return
    if (store.needsTap || store.playbackFailed || isAway()) return
    const positionKnown = snapshot.paused ? state.readySinceLoad : state.playingSinceLoad
    if (!positionKnown) return
    state.transport.heartbeat(adapter.currentTime(), snapshot.paused)
  }

  /** Controller only: mirror the local position + duration into the store for the seek bar. */
  function publishProgress(): void {
    const adapter = state.adapter
    if (!adapter || !store.isController) return
    store.setProgress(adapter.currentTime(), adapter.duration())
  }

  /** Away = local pause only (never the Snapshot, never an emit). Back = one resync. */
  function onAwayChange(away: boolean): void {
    if (away) {
      state.adapter?.pause()
    } else {
      resync()
    }
  }

  /** Back from background / a hidden tab: jump to where the room is now. */
  function resync(): void {
    const snapshot = store.snapshot
    const adapter = state.adapter
    if (!adapter || !snapshot) return
    const target = expected(snapshot)
    if (shouldCorrect(adapter.currentTime(), target)) seekTo(target)
    if (!snapshot.paused && !store.needsTap && !store.playbackFailed) void adapter.play()
  }

  // ========================================
  // Adapter ownership
  // ========================================

  function ensureAdapter(kind: AdapterKind): VideoPlayerAdapter | null {
    if (state.adapter !== null && state.adapterKind === kind) return state.adapter
    destroyAdapter()
    const factory = state.factories[kind]
    if (!factory || state.container === null) return null

    const adapter = factory(state.container)
    adapter.setMuted(store.muted)
    state.adapterUnsubscribers = [
      adapter.on('blocked', () => store.setNeedsTap(true)),
      adapter.on('ready', onReady),
      adapter.on('playing', onPlaying),
      adapter.on('ended', onEnded),
      adapter.on('error', onAdapterError),
    ]
    state.adapter = adapter
    state.adapterKind = kind
    return adapter
  }

  function destroyAdapter(): void {
    for (const unsubscribe of state.adapterUnsubscribers) unsubscribe()
    state.adapterUnsubscribers = []
    state.adapter?.destroy()
    state.adapter = null
    state.adapterKind = null
    state.loadedSourceKey = null
    state.playingSinceLoad = false
    state.readySinceLoad = false
    state.endedEmittedKey = null
  }

  function onReady(): void {
    state.readySinceLoad = true
  }

  function onPlaying(): void {
    state.playingSinceLoad = true
    state.readySinceLoad = true
    if (store.needsTap) store.setNeedsTap(false)
    publishProgress()
  }

  /** The Controller's player reached the end: tell the server once per loaded Source. */
  function onEnded(): void {
    const key = state.loadedSourceKey
    if (!store.isController || key === null || key === state.endedEmittedKey) return
    state.endedEmittedKey = key
    state.transport?.ended()
  }

  /** Watchers get the muted "can't play" state; the Controller also gets one toast per link. */
  function onAdapterError(error?: VideoAdapterError): void {
    log.warn('Room Video playback failed', error)
    store.setPlaybackFailed(true)
    const key = state.loadedSourceKey
    if (store.isController && key !== null && key !== state.failureToastKey) {
      state.failureToastKey = key
      toast.add({
        title: 'Video',
        description: error?.userMessage ?? PLAYBACK_FAILED_MESSAGE,
        color: 'error',
      })
    }
  }

  // ========================================
  // Start state (tier / preference default — room-video-player 09)
  // ========================================

  /**
   * On panel mount: unless the Watcher already chose this session, collapse (and hold
   * playback behind `needsTap`) when the tier / preference says so, else make sure the
   * panel is expanded. The hold means a weak phone never decodes a video it cannot see.
   */
  function applyStartDefault(): void {
    if (store.collapsedByUser) return
    // The Controller just tapped Start and drives the heartbeat + `ended` from their
    // own player: holding it would freeze the room's Snapshot and never end the video.
    const collapsed =
      !store.isController && resolveVideoStartCollapsed(readDeviceTier(), fxPrefs.startVideoCollapsed)
    store.setCollapsed(collapsed)
    if (collapsed) store.setNeedsTap(true)
  }

  /** Collapsed by the default (not by the Watcher): playback stays held until they expand. */
  function isHeldByStartDefault(): boolean {
    return store.collapsed && !store.collapsedByUser && !store.isController
  }

  // ========================================
  // Seats cover (pause seat SVGA/VAP loops while the video is in front)
  // ========================================

  function shouldCoverSeats(): boolean {
    const snapshot = store.snapshot
    return (
      store.isActive &&
      !store.collapsed &&
      snapshot !== null &&
      !snapshot.paused &&
      !store.needsTap &&
      !store.playbackFailed &&
      playerMountable()
    )
  }

  function setSeatsCovered(covered: boolean): void {
    if (covered && state.coverToken === null) {
      state.coverToken = acquireCovered()
    } else if (!covered && state.coverToken !== null) {
      releaseCovered(state.coverToken)
      state.coverToken = null
    }
  }

  // ========================================
  // Helpers
  // ========================================

  function expected(snapshot: RoomVideoSnapshot): number {
    return expectedPosition(snapshot, Date.now() + store.clockOffsetMs)
  }

  function seekTo(sec: number): void {
    state.adapter?.seek(sec)
    state.lastSeekAt = Date.now()
    publishProgress()
  }

  /**
   * Local player position (s) — the panel's pause / resume and the "Open on YouTube"
   * card read it. While no player has a real position (card, unmounted iframe, still
   * loading, failed) it is where the room is now, never 0: a pause sent from 0 would
   * rewind everyone.
   */
  function currentPosition(): number {
    const adapter = state.adapter
    const positionKnown = state.readySinceLoad || state.playingSinceLoad
    if (adapter && positionKnown && !store.playbackFailed) return adapter.currentTime()
    const snapshot = store.snapshot
    return snapshot ? expected(snapshot) : 0
  }

  /** May a player exist for the current Source right now (`shouldMountVideoPlayer`)? Reactive on the store. */
  function playerMountable(): boolean {
    const snapshot = store.snapshot
    if (snapshot === null) return false
    return shouldMountVideoPlayer({
      kind: snapshot.source.kind,
      platform: readRoomVideoPlatform(),
      collapsed: store.collapsed,
      isController: store.isController,
    })
  }

  return { attach, detach, tapToWatch, toggleCollapsed, toggleMuted, currentPosition }
}

function sourceKey(source: RoomVideoSource): string {
  return source.kind === 'youtube' ? `yt:${source.videoId}` : `url:${source.container}:${source.url}`
}

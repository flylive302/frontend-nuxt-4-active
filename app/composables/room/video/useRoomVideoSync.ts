/**
 * useRoomVideoSync — infrastructure: owns the ONE playback adapter of the Room
 * Video and keeps it on the server Snapshot (room-video-player 06).
 *
 * Lifecycle: the panel calls `attach(slotEl)` when it mounts and `detach()` when it
 * unmounts. Everything below — the Snapshot watcher, the 1 s drift tick, the away
 * subscription, the motion-cover token — lives in ONE module-scoped effect scope
 * created by `attach`, so it installs once no matter how many callers use this
 * composable (a `watch` inside a shared composable otherwise fires once per caller).
 *
 * Sync rule: expected position = `expectedPosition(snapshot, Date.now() + offset)`.
 * Server transport events are applied at once (seek only when off by more than the
 * drift threshold); the drift tick corrects with ONE seek, then stays quiet for a
 * cooldown so a multi-second gift-burst stall never stacks seeks.
 *
 * Not here: the Controller heartbeat and `ended` emit (ticket 07), YouTube (08),
 * pausing while away and the tier default (09).
 */
import { effectScope, watch, type EffectScope } from 'vue'
import { acquireCovered, releaseCovered, subscribeAway } from '~/services/motionPauseOrchestrator'
import { createHtmlVideoAdapter } from '~/services/roomVideoHtmlAdapter'
import { useRoomVideoStore } from '~/stores/roomVideo'
import { ROOM_VIDEO_DRIFT_TICK_MS, ROOM_VIDEO_SEEK_COOLDOWN_MS } from '~/constants/room'
import { createLogger } from '~/utils/logger'
import { expectedPosition, shouldCorrect } from '~/utils/video-clock'
import type {
  RoomVideoSnapshot,
  RoomVideoSource,
  VideoAdapterError,
  VideoPlayerAdapter,
  VideoPlayerAdapterFactory,
} from '~/types/room/video'

type AdapterKind = RoomVideoSource['kind']

/** Backend per Source kind. YouTube joins in ticket 08. */
export type RoomVideoAdapterFactories = Partial<Record<AdapterKind, VideoPlayerAdapterFactory>>

const DEFAULT_FACTORIES: RoomVideoAdapterFactories = { url: createHtmlVideoAdapter }

const log = createLogger('[RoomVideoSync]')

interface SyncState {
  factories: RoomVideoAdapterFactories
  container: HTMLElement | null
  adapter: VideoPlayerAdapter | null
  adapterKind: AdapterKind | null
  loadedSourceKey: string | null
  /** The adapter reported `playing` since the last load — only then is drift meaningful. */
  playingSinceLoad: boolean
  lastSeekAt: number
  adapterUnsubscribers: Array<() => void>
  scope: EffectScope | null
  tick: ReturnType<typeof setInterval> | null
  awayUnsubscribe: (() => void) | null
  coverToken: string | null
  /** Source key the Controller was already told about, so one bad link = one toast. */
  failureToastKey: string | null
}

const state: SyncState = {
  factories: DEFAULT_FACTORIES,
  container: null,
  adapter: null,
  adapterKind: null,
  loadedSourceKey: null,
  playingSinceLoad: false,
  lastSeekAt: 0,
  adapterUnsubscribers: [],
  scope: null,
  tick: null,
  awayUnsubscribe: null,
  coverToken: null,
  failureToastKey: null,
}

export function useRoomVideoSync(factories: RoomVideoAdapterFactories = DEFAULT_FACTORIES) {
  const store = useRoomVideoStore()
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
    state.container = container
    state.scope = effectScope(true)
    state.scope.run(() => {
      watch(() => store.snapshot, applySnapshot, { immediate: true })
      watch(() => store.muted, (muted) => state.adapter?.setMuted(muted))
      watch(shouldCoverSeats, setSeatsCovered, { immediate: true })
    })
    state.awayUnsubscribe = subscribeAway((away) => {
      if (!away) resync()
    })
    state.tick = setInterval(driftTick, ROOM_VIDEO_DRIFT_TICK_MS)
  }

  /** Stop following and release every resource. Idempotent. */
  function detach(): void {
    state.scope?.stop()
    state.scope = null
    if (state.tick !== null) clearInterval(state.tick)
    state.tick = null
    state.awayUnsubscribe?.()
    state.awayUnsubscribe = null
    setSeatsCovered(false)
    destroyAdapter()
    state.container = null
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

  function toggleCollapsed(): void {
    store.setCollapsed(!store.collapsed)
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
    }

    const target = expected(snapshot)
    if (freshLoad || shouldCorrect(adapter.currentTime(), target)) seekTo(target)

    if (snapshot.paused) {
      adapter.pause()
    } else if (!store.needsTap && !store.playbackFailed) {
      void adapter.play()
    }
  }

  /** One corrective seek per cooldown, and only once the player is really playing. */
  function driftTick(): void {
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
      adapter.on('playing', onPlaying),
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
  }

  function onPlaying(): void {
    state.playingSinceLoad = true
    if (store.needsTap) store.setNeedsTap(false)
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
        description: "This link couldn't be played. Try another one.",
        color: 'error',
      })
    }
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
      !store.playbackFailed
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
  }

  return { attach, detach, tapToWatch, toggleCollapsed, toggleMuted }
}

function sourceKey(source: RoomVideoSource): string {
  return source.kind === 'youtube' ? `yt:${source.videoId}` : `url:${source.container}:${source.url}`
}

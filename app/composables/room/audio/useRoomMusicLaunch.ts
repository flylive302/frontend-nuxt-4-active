import type { Ref } from 'vue'
import { createLogger } from '~/utils/logger'
import type { AudioSocket } from '~/composables/room/useAudioSocket'

// ========================================
// Room Music Launch (Action composable)
// ========================================
//
// Owns the Music entry point in the Room Settings hub: slot-availability
// gating, the picker's normal vs. owner force-take mode, and starting the
// DJ session once files are chosen. Playback/queue lifecycle stays with
// useRoomAudioPlayer (ADR 0006).
// ========================================

export function useRoomMusicLaunch(socket: Ref<AudioSocket | null>) {
  const roomStore = useRoomStore()
  const authStore = useAuthStore()
  const { isRoomOwner } = useRoomPermissions()
  const toast = useToast()
  const log = createLogger('[RoomMusicLaunch]')

  const {
    playerState,
    isMusicPlayingInRoom,
    isActive,
    addTracks,
    play,
    takeover,
  } = useRoomAudioPlayer(socket)

  const showUploader = ref(false)
  const isLoading = ref(false)
  /** Set when the uploader was opened to force-take (owner) vs. normal play. */
  const forceTakeMode = ref(false)

  const currentRoomId = computed(() => roomStore.currentRoom?.id?.toString() ?? '')

  /** True when no music is playing or this user is the current DJ. */
  const canPlayMusic = computed(
    () => !isMusicPlayingInRoom.value || playerState.userId === authStore.user?.id
  )

  /**
   * The owner can force-take a live slot held by someone else (ADR 0006
   * hierarchy); non-owner admins cannot interrupt.
   */
  const canForceTakeMusic = computed(
    () => isRoomOwner.value && isMusicPlayingInRoom.value && playerState.userId !== authStore.user?.id
  )

  /** Open the file picker in normal vs. owner force-take mode. */
  function openPicker(force: boolean): void {
    forceTakeMode.value = force
    showUploader.value = true
  }

  /**
   * Append the selected audio files to the Playlist. Starts the DJ session if
   * one is not already live; otherwise the tracks join the queue without
   * interrupting playback.
   */
  async function handleFilesSelected(files: File[]): Promise<void> {
    // GATE
    if (!currentRoomId.value) return

    isLoading.value = true
    try {
      // EXECUTE
      const added = addTracks(files)
      if (added.length === 0) {
        toast.add({ title: 'Playlist Full', description: 'No more tracks can be added.', color: 'warning' })
        return
      }
      showUploader.value = false
      if (forceTakeMode.value) {
        await takeover(currentRoomId.value)
      } else if (!isActive.value) {
        await play(currentRoomId.value)
      }
    } catch (err) {
      // REACT (failure) — the orchestrator already surfaces socket failures as
      // toasts; this guards any remaining throw (e.g. producer transport setup).
      log.warn('Music playback could not start', err)
      toast.add({ title: 'Music', description: 'Could not start music playback. Please try again.', color: 'error' })
    } finally {
      forceTakeMode.value = false
      isLoading.value = false
    }
  }

  return {
    showUploader,
    isLoading,
    canPlayMusic,
    canForceTakeMusic,
    openPicker,
    handleFilesSelected,
  }
}

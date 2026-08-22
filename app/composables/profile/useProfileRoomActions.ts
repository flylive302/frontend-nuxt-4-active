import type { BootstrapRoom } from '~/types/user/bootstrap'
import type { Ref } from 'vue'

/**
 * Profile page: track user / join their room (socket + API orchestration).
 */
export function useProfileRoomActions(
  profile: Readonly<Ref<{ id: number; name: string | null; room_id?: number | null } | null>>,
  enterRoomFn: (room: BootstrapRoom) => Promise<void>,
) {
  const roomStore = useRoomStore()
  const roomSession = useRoomSession()
  const { api } = useApi()
  const { socket, connect, isConnected } = useAudioSocket()
  const toast = useToast()

  // Tracking is shared with the slide-overlay click handler via useTrackUser.
  const { isTracking, trackUserById } = useTrackUser(enterRoomFn)
  const isJoiningRoom = ref(false)

  async function ensureSocketConnected(): Promise<boolean> {
    if (isConnected.value && socket.value) return true
    await connect()
    // Check again after async connect (token refresh may have completed fast)
    if (isConnected.value && socket.value) return true
    // Wait for connection with reactive watch instead of polling
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        unwatch()
        resolve(false)
      }, 5000)
      const unwatch = watch(isConnected, (connected) => {
        if (connected && socket.value) {
          clearTimeout(timeout)
          unwatch()
          resolve(true)
        }
      })
    })
  }

  async function trackUser(): Promise<void> {
    if (!profile.value?.id) return
    await trackUserById(profile.value.id, profile.value.name)
  }

  async function goToRoom(): Promise<void> {
    if (!profile.value?.room_id || isJoiningRoom.value) return

    if (roomStore.currentRoom && roomStore.currentRoom.id === profile.value.room_id) {
      roomSession.maximizeRoom()
      navigateTo(`/room/${profile.value.room_id}`)
      return
    }

    isJoiningRoom.value = true

    try {
      const connected = await ensureSocketConnected()
      if (!connected || !socket.value) {
        toast.add({
          title: 'Connection failed',
          description: 'Could not connect to server',
          color: 'error',
        })
        return
      }

      const roomData = await api<{ status: string; data: BootstrapRoom }>(`/rooms/${profile.value.room_id}`)

      if (roomData.status !== 'success' || !roomData.data) {
        toast.add({
          title: 'Room not found',
          description: 'The room may have been closed',
          color: 'error',
        })
        return
      }

      await enterRoomFn(roomData.data)
    } catch {
      toast.add({
        title: 'Failed to join room',
        description: 'Could not access the room',
        color: 'error',
      })
    } finally {
      isJoiningRoom.value = false
    }
  }

  return {
    isTracking,
    isJoiningRoom,
    trackUser,
    goToRoom,
  }
}

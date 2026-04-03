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
  const { api } = useApi()
  const { socket, connect, isConnected } = useAudioSocket()
  const toast = useToast()

  const isTracking = ref(false)
  const isJoiningRoom = ref(false)

  async function ensureSocketConnected(): Promise<boolean> {
    if (isConnected.value && socket.value) return true
    connect()
    return new Promise((resolve) => {
      const maxAttempts = 50
      let attempts = 0
      const checkInterval = setInterval(() => {
        attempts++
        if (isConnected.value && socket.value) {
          clearInterval(checkInterval)
          resolve(true)
        } else if (attempts >= maxAttempts) {
          clearInterval(checkInterval)
          resolve(false)
        }
      }, 100)
    })
  }

  async function trackUser(): Promise<void> {
    if (!profile.value?.id || isTracking.value) return

    isTracking.value = true

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

      const response = await new Promise<{ roomId: string | null }>((resolve, reject) => {
        const timeoutId = setTimeout(() => reject(new Error('Timeout')), 5000)
        socket.value!.emit('user:getRoom', { userId: profile.value!.id }, (res: { roomId: string | null }) => {
          clearTimeout(timeoutId)
          resolve(res)
        })
      })

      if (!response.roomId) {
        toast.add({
          title: 'User not in a room',
          description: `${profile.value.name ?? 'This user'} is not currently in any room`,
          color: 'warning',
          icon: 'i-lucide-user-x',
        })
        return
      }

      if (roomStore.currentRoom && String(roomStore.currentRoom.id) === String(response.roomId)) {
        navigateTo(`/room/${response.roomId}`)
        return
      }

      const roomData = await api<{ status: string; data: BootstrapRoom }>(`/rooms/${response.roomId}`)

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
        title: 'Tracking failed',
        description: 'Could not locate user',
        color: 'error',
      })
    } finally {
      isTracking.value = false
    }
  }

  async function goToRoom(): Promise<void> {
    if (!profile.value?.room_id || isJoiningRoom.value) return

    if (roomStore.currentRoom && roomStore.currentRoom.id === profile.value.room_id) {
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

import type { BootstrapRoom } from '~/types/user/bootstrap'

/**
 * Track a user into their current room (socket lookup + room entry), keyed by
 * user id. Shared by the profile page (Track button) and the slide overlay
 * click handler. Reuses the graceful "user not in a room" toast.
 *
 * GATE → ensure socket → look up the user's room → EXECUTE enterRoom.
 * `enterRoom` is injected so the caller's `useRoomEntry()` instance (and its
 * password-prompt state) stays co-located with the component that renders it.
 */
export function useTrackUser(enterRoomFn: (room: BootstrapRoom) => Promise<void>) {
  const roomStore = useRoomStore()
  const roomSession = useRoomSession()
  const { api } = useApi()
  const { socket, connect, isConnected } = useAudioSocket()
  const toast = useToast()

  const isTracking = ref(false)

  async function ensureSocketConnected(): Promise<boolean> {
    if (isConnected.value && socket.value) return true
    await connect()
    if (isConnected.value && socket.value) return true
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

  /**
   * Track the given user into their room.
   *
   * @param userId      the user to track (e.g. a slide's trigger user / sender)
   * @param displayName optional name for the "not in a room" toast
   */
  async function trackUserById(userId: number, displayName?: string | null): Promise<void> {
    if (!userId || isTracking.value) return

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

      const response = await new Promise<{
        success: boolean
        data?: { roomId: string | null }
        error?: string
      }>((resolve, reject) => {
        const timeoutId = setTimeout(() => reject(new Error('Timeout')), 5000)
        socket.value!.emit('user:getRoom', { userId }, (res: {
          success: boolean
          data?: { roomId: string | null }
          error?: string
        }) => {
          clearTimeout(timeoutId)
          resolve(res)
        })
      })

      // GATE: server-side errors
      if (!response.success) {
        toast.add({
          title: 'Tracking failed',
          description: response.error === 'INVALID_PAYLOAD'
            ? 'Invalid request data'
            : 'Server error while locating user',
          color: 'error',
        })
        return
      }

      const trackedRoomId = response.data?.roomId

      if (!trackedRoomId) {
        toast.add({
          title: 'User not in a room',
          description: `${displayName ?? 'This user'} is not currently in any room`,
          color: 'warning',
          icon: 'i-lucide-user-x',
        })
        return
      }

      if (roomStore.currentRoom && String(roomStore.currentRoom.id) === String(trackedRoomId)) {
        roomSession.maximizeRoom()
        navigateTo(`/room/${trackedRoomId}`)
        return
      }

      const roomData = await api<{ status: string; data: BootstrapRoom }>(`/rooms/${trackedRoomId}`)

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

  return {
    isTracking,
    trackUserById,
  }
}

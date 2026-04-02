export function useRoomJoinPasswordVerify() {
  const { api, normalizeError } = useApi()

  async function verifyRoomJoinPassword(roomId: number, password: string): Promise<{ ok: true } | { ok: false; message: string }> {
    try {
      await api(`/rooms/${roomId}/join`, {
        method: 'POST',
        body: { password },
      })
      return { ok: true }
    } catch (err) {
      const normalized = normalizeError(err)
      return { ok: false, message: normalized.message || 'Incorrect password' }
    }
  }

  return { verifyRoomJoinPassword }
}

export function useRoomSettingsApi() {
  const { api, normalizeError } = useApi()

  async function patchRoom(
    roomId: number,
    body: Record<string, unknown>,
  ): Promise<{ data: Record<string, unknown> }> {
    return api<{ data: Record<string, unknown> }>(`/rooms/${roomId}`, { method: 'PATCH', body })
  }

  return { patchRoom, normalizeError }
}

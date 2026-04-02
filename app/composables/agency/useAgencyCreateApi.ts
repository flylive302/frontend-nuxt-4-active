export function useAgencyCreateApi() {
  const { api } = useApi()

  async function submitAgency(payload: Record<string, unknown>): Promise<void> {
    await api('/agencies', {
      method: 'POST',
      body: payload,
      timeout: 30_000,
    })
  }

  return { submitAgency }
}

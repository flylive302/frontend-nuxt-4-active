/**
 * Health / connectivity probe (ARCHITECTURE: pages stay free of $fetch).
 */
export function useConnectivityProbe() {
  async function probeHealth(): Promise<boolean> {
    try {
      await $fetch('/api/v1/health', { timeout: 5000 })
      return true
    } catch {
      return false
    }
  }

  return { probeHealth }
}

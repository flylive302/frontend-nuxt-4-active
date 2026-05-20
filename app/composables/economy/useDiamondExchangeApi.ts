import type { ExchangeInfo, ExchangeResult } from '~/types/economy/exchange'

export function useDiamondExchangeApi() {
  const { api, normalizeError } = useApi()

  async function fetchExchangeInfo(): Promise<ExchangeInfo> {
    const response = await api<{ success: true; data: ExchangeInfo }>('/user/exchange')
    return response.data
  }

  async function submitExchange(diamondAmount: number): Promise<{ data: ExchangeResult; message: string }> {
    // F-54: per-click UUID makes the exchange idempotent on the backend.
    const response = await api<{
      success: true
      data: ExchangeResult
      message: string
    }>('/user/exchange', {
      method: 'POST',
      body: { diamond_amount: diamondAmount, idempotency_key: crypto.randomUUID() },
    })
    return { data: response.data, message: response.message }
  }

  return { fetchExchangeInfo, submitExchange, normalizeError }
}

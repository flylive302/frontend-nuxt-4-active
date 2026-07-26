/**
 * Low-level fetch for InfiniteScroll component ($fetch isolated from template layer).
 */
import type { InfiniteScrollItem } from '~/types/ui/infinite-scroll'
import type { InfiniteScrollPayload } from '~/utils/infinite-scroll-pagination'

type FetchPayload<Item extends InfiniteScrollItem> = InfiniteScrollPayload<Item>

export interface InfiniteScrollFetchContext {
  endpoint: string
  page: number
  perPage: number
  query: Record<string, unknown>
  signal: AbortSignal
}

export function useInfiniteScrollTransport() {
  async function fetchPage<Item extends InfiniteScrollItem>(
    context: InfiniteScrollFetchContext,
  ): Promise<FetchPayload<Item>> {
    return await $fetch<FetchPayload<Item>>(context.endpoint, {
      query: { page: context.page, perPage: context.perPage, ...context.query },
      signal: context.signal,
    })
  }

  return { fetchPage }
}

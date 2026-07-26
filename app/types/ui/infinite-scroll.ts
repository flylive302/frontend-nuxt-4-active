export type InfiniteScrollIdentifier = string | number

export interface InfiniteScrollItem {
  id: InfiniteScrollIdentifier
  [key: string]: unknown
}

/**
 * The pagination shape `InfiniteScroll` understands.
 *
 * Deliberately flat and camelCase — it is *not* a backend wire format. A
 * consumer whose API paginates differently (Laravel's nested snake_case
 * `meta.pagination.{current_page,per_page,total}`, for one) must normalize into
 * this before handing a page back, or `hasMore` silently reads `undefined`.
 *
 * Declared once and shared by the component, its default transport, and every
 * consumer that normalizes: a second inline copy of this shape is how the
 * mismatch it exists to prevent gets reintroduced.
 */
export interface InfiniteScrollPaginationMeta {
  /** 1-based index of the page this payload *is*. */
  page: number
  /** Rows per page as the server counts them — never a post-slice item count. */
  perPage: number
  /** Total rows across all pages. Omit when the API cannot report one. */
  total?: number
}

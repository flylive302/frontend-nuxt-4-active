export type InfiniteScrollIdentifier = string | number

export interface InfiniteScrollItem {
  id: InfiniteScrollIdentifier
  [key: string]: unknown
}

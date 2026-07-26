<script setup lang="ts">
import type { Component } from 'vue'
import { defineAsyncComponent } from 'vue'
import { useInfiniteScroll } from '@vueuse/core'
import type { InfiniteScrollItem } from '~/types/ui/infinite-scroll';
import { evaluateHasMore, type InfiniteScrollPayload } from '~/utils/infinite-scroll-pagination';

// Async-load vue-virtual-scroller + its CSS so the feature-scroller chunk
// doesn't get linked as render-blocking CSS on routes that don't actually
// virtualize anything (e.g., auth routes — Nuxt's CSS resolver was emitting
// the link tag for any route whose static graph could reach this component).
const DynamicScroller = defineAsyncComponent(async () => {
  if (import.meta.client) await import('vue-virtual-scroller/dist/vue-virtual-scroller.css')
  return (await import('vue-virtual-scroller')).DynamicScroller as unknown as Component
})
const DynamicScrollerItem = defineAsyncComponent(async () =>
  (await import('vue-virtual-scroller')).DynamicScrollerItem as unknown as Component
)

defineOptions({ name: 'InfiniteScroll' })

export type { InfiniteScrollItem } from '~/types/ui/infinite-scroll'

type FetchPayload<Item extends InfiniteScrollItem> = InfiniteScrollPayload<Item>

interface FetchContext {
  endpoint: string
  page: number
  perPage: number
  query: Record<string, unknown>
  signal: AbortSignal
}

type Fetcher<Item extends InfiniteScrollItem> = (context: FetchContext) => Promise<FetchPayload<Item>>

const props = withDefaults(defineProps<{
  endpoint?: string
  fetcher?: Fetcher<InfiniteScrollItem>
  perPage?: number
  view?: 'grid' | 'list'
  cols?: 1 | 2 | 3 | 4
  aspectGrid?: string
  aspectList?: string
  extraQuery?: Record<string, unknown>
  minItemSize?: number
  loadDistance?: number
  loadInterval?: number
  initialPage?: number
}>(), {
  endpoint: 'https://dummyjson.com/c/0188-d62d-4dd7-9ad2',
  fetcher: undefined,
  perPage: 10,
  view: 'grid',
  cols: 2,
  aspectGrid: 'aspect-[16/9]',
  aspectList: 'aspect-[3/4]',
  extraQuery: () => ({}),
  minItemSize: 96,
  loadDistance: 600,
  loadInterval: 150,
  initialPage: 1
})

const emit = defineEmits<{
  (event: 'loaded', payload: { page: number; items: InfiniteScrollItem[] }): void
  (event: 'error', error: unknown): void
}>()

const endpointRef = toRef(props, 'endpoint')
const extraQueryRef = toRef(props, 'extraQuery')
const perPageRef = toRef(props, 'perPage')

const isListView = computed(() => props.view === 'list')
const columnCount = computed(() => (isListView.value ? 1 : props.cols))
const aspectRatio = computed(() => (isListView.value ? props.aspectList : props.aspectGrid))
const gridColumnsClass = computed(() =>
  ({ 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' } as const)[columnCount.value]
)

const items = ref<InfiniteScrollItem[]>([])
const currentPage = ref(props.initialPage)
const isLoading = ref(false)
const hasMore = ref(true)
const fetchError = ref<unknown | null>(null)
const shouldReactToPropChanges = ref(false)
const isMounted = ref(false)

interface GridRow {
  __rowKey: number
  cells: InfiniteScrollItem[]
}

function buildRows(source: InfiniteScrollItem[], columns: number): GridRow[] {
  if (columns <= 1) {
    return source.map((item, rowIndex) => ({ __rowKey: rowIndex, cells: [item] }))
  }

  const chunkedRows: GridRow[] = []
  source.forEach((item, index) => {
    const rowIndex = Math.floor(index / columns)
    if (chunkedRows[rowIndex]) {
      chunkedRows[rowIndex]!.cells.push(item)
    } else {
      chunkedRows[rowIndex] = { __rowKey: rowIndex, cells: [item] }
    }
  })
  return chunkedRows
}

const rows = computed(() => buildRows(items.value, columnCount.value))


let abortController: AbortController | null = null
let infiniteScrollController: { reset: () => void } | null = null

const { fetchPage: transportFetchPage } = useInfiniteScrollTransport()

async function defaultFetcher(context: FetchContext): Promise<FetchPayload<InfiniteScrollItem>> {
  return transportFetchPage(context)
}

async function loadNextPage(): Promise<void> {
  if (isLoading.value || !hasMore.value) return

  const hasFetchSource = Boolean(props.fetcher) || endpointRef.value.length > 0
  if (!hasFetchSource) {
    hasMore.value = false
    return
  }

  isLoading.value = true
  fetchError.value = null

  abortController?.abort()
  abortController = new AbortController()

  const fetcher = props.fetcher ?? defaultFetcher

  try {
    const response = await fetcher({
      endpoint: endpointRef.value,
      page: currentPage.value,
      perPage: perPageRef.value,
      query: extraQueryRef.value,
      signal: abortController.signal
    })

    const newItems = Array.isArray(response) ? response : response.data
    if (newItems.length > 0) {
      items.value.push(...newItems)
      emit('loaded', { page: currentPage.value, items: newItems })
    }

    const metaReference = { page: currentPage.value, perPage: perPageRef.value }
    hasMore.value = evaluateHasMore(response, newItems, metaReference)
    currentPage.value += 1
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'AbortError')) {
      hasMore.value = false
      fetchError.value = error
      emit('error', error)
    }
  } finally {
    isLoading.value = false
  }
}

function reset(): void {
  abortController?.abort()
  items.value = []
  currentPage.value = props.initialPage
  hasMore.value = true
  fetchError.value = null
}

async function reload(): Promise<void> {
  reset()
  await loadNextPage()
  infiniteScrollController?.reset()
}

onBeforeUnmount(() => abortController?.abort())

if (import.meta.client) {
  watch([endpointRef, perPageRef, () => props.fetcher, () => props.initialPage], () => {
    if (!shouldReactToPropChanges.value) return
    void reload()
  })

  watch(
    extraQueryRef,
    () => {
      if (!shouldReactToPropChanges.value) return
      void reload()
    },
    { deep: true }
  )

  infiniteScrollController = useInfiniteScroll(
    () => window,
    async () => {
      if (!hasMore.value) return
      await loadNextPage()
    },
    {
      distance: props.loadDistance,
      interval: props.loadInterval,
      canLoadMore: () => hasMore.value
    }
  )
}

onMounted(() => {
  if (!import.meta.client) return
  isMounted.value = true
  shouldReactToPropChanges.value = true
  void loadNextPage()
})

defineExpose({
  reload,
  reset,
  loadNextPage,
  state: {
    items,
    isLoading,
    hasMore,
    error: fetchError
  }
})
</script>

<template>
  <ClientOnly :ssr="false">
    <template #fallback>
      <div class="min-h-14 py-6 text-center text-md font-semibold text-white/70">
        <slot name="loading">Loading…</slot>
      </div>
    </template>
    <div :aria-busy="isLoading" class="min-h-14">
      <DynamicScroller
          :items="rows"
          key-field="__rowKey"
          :min-item-size="minItemSize"
          page-mode
          class="mt-2"
      >
      <template #default="{ item: rowGroup, active }">
        <DynamicScrollerItem
            :item="rowGroup"
            :active="active"
            :size-dependencies="[columnCount]"
        >
          <div
              class="grid gap-3"
              :class="gridColumnsClass"
              role="list"
          >
            <!-- Default cell render; override via #cell slot -->
            <template v-for="(cellItem, cellIndex) in rowGroup.cells" :key="cellItem.id">
              <slot
                  name="cell"
                  :cell="cellItem"
                  :index="cellIndex"
                  :columns="columnCount"
                  :is-list="isListView"
                  :aspect-class="aspectRatio"
              >
                <NuxtLink to="/" class="pb-2" role="listitem">
                  <RoomCard :room="cellItem" :class="[aspectRatio, 'w-full']">
                    Live / <span class="tabular-nums">{{ cellItem.id }}</span>
                  </RoomCard>
                </NuxtLink>
              </slot>
            </template>
          </div>
        </DynamicScrollerItem>
      </template>
      </DynamicScroller>

      <!-- Unified min-height + font-weight avoids CLS when swapping loading / empty / complete -->
      <div v-if="fetchError" class="min-h-14 py-6 text-center text-md font-semibold text-rose-300">
        <slot name="error" :error="fetchError">Something went wrong. Please try again.</slot>
      </div>
      <div v-else-if="isLoading" class="min-h-14 py-6 text-center text-md font-semibold text-white">
        <slot name="loading">Loading…</slot>
      </div>
      <div v-else-if="rows.length === 0" class="min-h-14 py-6 text-center text-md font-semibold text-white/70">
        <slot name="empty">No results yet.</slot>
      </div>
      <div v-else-if="!hasMore" class="min-h-14 py-6 text-center text-md font-semibold text-white">
        <slot name="complete">You're all caught up.</slot>
      </div>
    </div>
  </ClientOnly>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount, watch, toRef } from 'vue'
import { useInfiniteScroll } from '@vueuse/core'

defineOptions({ name: 'InfiniteScroll' })
// Generic item shape; needs an id
type Id = string | number
type AnyItem = { id: Id } & Record<string, unknown>

// API helpers
type ApiMeta = { page: number; perPage: number; total: number }
type Paginated<T> = { data: T[]; meta?: ApiMeta }
type ApiResponse<T> = Paginated<T> | T[]
const isPaginated = <T,>(r: ApiResponse<T>): r is Paginated<T> =>
    !Array.isArray(r) && 'data' in r

const props = withDefaults(defineProps<{
  endpoint?: string
  perPage?: number
  view?: 'grid' | 'list'
  cols?: 1 | 2 | 3 | 4
  aspectGrid?: string
  aspectList?: string
  extraQuery?: Record<string, unknown>
  minItemSize?: number
}>(), {
  endpoint: 'https://dummyjson.com/c/0188-d62d-4dd7-9ad2',
  perPage: 10,
  view: 'grid',
  cols: 2,
  aspectGrid: 'aspect-[16/9]',
  aspectList: 'aspect-[3/4]',
  extraQuery: () => ({}),
  minItemSize: 96
})

const endpoint = toRef(props, 'endpoint')
const extraQuery = toRef(props, 'extraQuery')

const isList = computed(() => props.view === 'list')
const cols = computed(() => (isList.value ? 1 : props.cols))
const aspect = computed(() => (isList.value ? props.aspectList : props.aspectGrid))
const gridClass = computed(() =>
    ({ 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' } as const)[cols.value]
)

const items = ref<AnyItem[]>([])
const page = ref(1)
const loading = ref(false)
const canLoadMore = ref(true)

let aborter: AbortController | null = null

async function fetchPage(): Promise<void> {
  if (loading.value || !canLoadMore.value) return
  loading.value = true

  aborter?.abort()
  aborter = new AbortController()

  try {
    const res = await $fetch<ApiResponse<AnyItem>>(endpoint.value, {
      query: { page: page.value, perPage: props.perPage, ...extraQuery.value },
      signal: aborter.signal
    })

    const data = isPaginated(res) ? res.data : res
    if (data.length) items.value.push(...data)
    page.value++

    if (isPaginated(res) && res.meta) {
      const { page: p, perPage: pp, total } = res.meta
      canLoadMore.value = p * pp < total
    } else {
      canLoadMore.value = data.length >= props.perPage
    }
  } catch (err) {
    if (!(err instanceof DOMException && err.name === 'AbortError')) {
      canLoadMore.value = false
    }
  } finally {
    loading.value = false
  }
}

type Row = { __rowKey: number; cells: AnyItem[] }
const rows = computed<Row[]>(() => {
  const out: Row[] = []
  const a = items.value
  const c = cols.value
  for (let i = 0; i < a.length; i += c) out.push({ __rowKey: out.length, cells: a.slice(i, i + c) })
  return out
})

function reset(): void {
  aborter?.abort()
  items.value = []
  page.value = 1
  canLoadMore.value = true
}
async function reload(): Promise<void> {
  reset()
  await fetchPage()
}

useInfiniteScroll(
    window,
    () => { if (canLoadMore.value) return fetchPage() },
    { distance: 800, throttle: 100 }
)

watch(
    [cols, endpoint, extraQuery],
    () => { void reload() }, // fire-and-forget; guards already prevent overlap
    { flush: 'post', deep: true }
)

onBeforeUnmount(() => aborter?.abort())

defineExpose({ reload, reset })
</script>

<template>
  <DynamicScroller
      :items="rows"
      key-field="__rowKey"
      :min-item-size="minItemSize"
      page-mode
      class="mt-2"
  >
    <template #default="{ item, active }">
      <DynamicScrollerItem
          :item="item"
          :active="active"
          :size-dependencies="[cols]"
      >
        <div
            class="grid gap-3"
            :class="gridClass"
            style="contain: content; content-visibility: auto;"
            role="list"
        >
          <!-- Default cell render; override via #cell slot -->
          <template v-for="(r, idx) in item.cells" :key="r.id">
            <slot name="cell" :cell="r" :index="idx">
              <NuxtLink to="/" class="pb-2" role="list-item">
                <RoomCard :image-src="(r as any).thumbnail" :class="[aspect, 'w-full']">
                  Live / <span class="tabular-nums">{{ r.id }}</span>
                </RoomCard>
              </NuxtLink>
            </slot>
          </template>
        </div>
      </DynamicScrollerItem>
    </template>
  </DynamicScroller>

  <div v-if="loading" class="py-4 text-center text-md text-white font-bold">Loading…</div>
  <div v-else-if="!canLoadMore" class="py-6 text-center text-md text-white font-bold">You’re all caught up.</div>
</template>

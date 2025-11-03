<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useVirtualList, useInfiniteScroll } from '@vueuse/core'

type Room = { id: string; thumbnail: string; active_users: number }
interface PaginatedRooms {
  data: Room[]
  meta?: {
    page: number
    perPage: number
    total: number
  }
}
type RoomsApiResponse = PaginatedRooms | Room[]

// ─────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────
const view = ref<'grid' | 'list'>('grid') // switchable layout
const columns = computed(() => (view.value === 'list' ? 1 : 2))
const aspect = computed(() => (view.value === 'list' ? 'aspect-[16/9]' : 'aspect-[3/4]'))
const gap = 12 // px
const perPage = 40

// ─────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────
const rooms = ref<Room[]>([])
const page = ref(1)
const loading = ref(false)
const canLoadMore = ref(true)
let fetchAbortController: AbortController | null = null

// ─────────────────────────────────────────────────────────────
// FETCH
// ─────────────────────────────────────────────────────────────
async function fetchPage() {
  if (loading.value || !canLoadMore.value) return
  loading.value = true
  fetchAbortController?.abort()
  fetchAbortController = new AbortController()
  try {
    const response = await $fetch<RoomsApiResponse>('https://dummyjson.com/c/3229-4208-4c0e-8571', {
      query: { page: page.value, perPage },
      signal: fetchAbortController.signal,
    })

    const nextRooms: Room[] = Array.isArray(response) ? response : response.data ?? []
    rooms.value.push(...nextRooms)
    page.value += 1

    if (!Array.isArray(response) && response.meta) {
      const { page: currentPage, perPage: pageSize, total } = response.meta
      canLoadMore.value = typeof total === 'number'
        ? currentPage * pageSize < total
        : nextRooms.length >= perPage
    } else {
      canLoadMore.value = nextRooms.length >= perPage
    }
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'AbortError')) {
      canLoadMore.value = false
    }
  } finally {
    loading.value = false
    fetchAbortController = null
  }
}

// ─────────────────────────────────────────────────────────────
// VIRTUALIZATION
// ─────────────────────────────────────────────────────────────
const grouped = computed(() => {
  const roomCollection = rooms.value
  if (columns.value === 1) return roomCollection.map(room => [room])
  const groupedRooms: Room[][] = []
  for (let index = 0; index < roomCollection.length; index += columns.value)
    groupedRooms.push(roomCollection.slice(index, index + columns.value))
  return groupedRooms
})

// Measure responsive height once
const cardHeight = ref(0)
onMounted(() => {
  const el = document.querySelector('.room-probe') as HTMLElement | null
  cardHeight.value = el?.offsetHeight || 240
  void fetchPage()
})
const rowHeight = computed(() => cardHeight.value + gap)

const { list, containerProps, wrapperProps } = useVirtualList(grouped, {
  itemHeight: rowHeight.value, // must be a number
  overscan: 6,
})

// ─────────────────────────────────────────────────────────────
// INFINITE SCROLL
// ─────────────────────────────────────────────────────────────
if (import.meta.client) {
  useInfiniteScroll(
      () => window,
      async () => { if (canLoadMore.value) await fetchPage() },
      { distance: 800, interval: 150 },
  )
}

onBeforeUnmount(() => fetchAbortController?.abort())

</script>

<template>
  <div v-bind="containerProps">
    <!-- probe to measure responsive height -->
    <div class="room-probe invisible absolute" :class="[aspect, view === 'list' ? 'w-[90vw]' : 'w-[45vw] sm:w-[22vw]']" />
    <div v-bind="wrapperProps" class="mt-4">
      <div
          v-for="{ index, data: row } in list"
          :key="index"
          class="grid gap-3 px-3"
          :class="[`grid-cols-${columns}`]"
          style="contain: content; content-visibility: auto; padding-bottom: 12px;"
      >
        <NuxtLink
            v-for="room in row"
            :key="room.id"
            to="/"
            class="block"
        >
          <RoomCard
              :image-src="room.thumbnail"
              :class="[aspect, 'w-full']"
          >
            Live / <span class="tabular-nums">{{ room.active_users }}</span>
          </RoomCard>
        </NuxtLink>
      </div>
    </div>
    <div v-if="loading" class="py-4 text-center text-sm opacity-70">Loading…</div>
    <div v-else-if="!canLoadMore" class="py-6 text-center text-xs opacity-60">You’re all caught up.</div>
  </div>
</template>

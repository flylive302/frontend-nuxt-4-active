<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useVirtualList, useInfiniteScroll } from '@vueuse/core'

type Room = { id: string; thumbnail: string; active_users: number }

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

// ─────────────────────────────────────────────────────────────
// FETCH
// ─────────────────────────────────────────────────────────────
async function fetchPage() {
  if (loading.value || !canLoadMore.value) return
  loading.value = true
  try {
    const res = await $fetch('https://dummyjson.com/c/3229-4208-4c0e-8571', {
      query: { page: page.value, perPage },
    }) as any

    const data: Room[] = Array.isArray(res) ? res : res.data ?? []
    rooms.value.push(...data)
    page.value++

    if (!Array.isArray(res) && res?.meta) {
      const { page: p, perPage: pp, total } = res.meta
      canLoadMore.value = p * pp < total
    } else canLoadMore.value = data.length >= perPage
  } finally {
    loading.value = false
  }
}

// ─────────────────────────────────────────────────────────────
// VIRTUALIZATION
// ─────────────────────────────────────────────────────────────
const grouped = computed(() => {
  const arr = rooms.value
  if (columns.value === 1) return arr.map(i => [i])
  const out: Room[][] = []
  for (let i = 0; i < arr.length; i += columns.value)
    out.push(arr.slice(i, i + columns.value))
  return out
})

// Measure responsive height once
const cardHeight = ref(0)
onMounted(() => {
  const el = document.querySelector('.room-probe') as HTMLElement | null
  cardHeight.value = el?.offsetHeight || 240
})
const rowHeight = computed(() => cardHeight.value + gap)

const { list, containerProps, wrapperProps } = useVirtualList(grouped, {
  itemHeight: rowHeight.value, // must be a number
  overscan: 6,
})

// ─────────────────────────────────────────────────────────────
// INFINITE SCROLL
// ─────────────────────────────────────────────────────────────
useInfiniteScroll(
    window,
    async () => { if (canLoadMore.value) await fetchPage() },
    { distance: 800 },
)

// first page
fetchPage()
</script>

<template>
  <div v-bind="containerProps">
    <!-- probe to measure responsive height -->
    <div class="room-probe invisible absolute" :class="[aspect, view === 'list' ? 'w-[90vw]' : 'w-[45vw] sm:w-[22vw]']"></div>
    <div v-bind="wrapperProps" class="mt-4">
      <div
          v-for="{ index, data: row } in list"
          :key="index"
          class="grid gap-3 px-3"
          :class="[`grid-cols-${columns}`]"
          style="contain: content; content-visibility: auto; padding-bottom: 12px;"
      >
        <NuxtLink
            v-for="r in row"
            :key="r.id"
            to="/"
            class="block"
        >
          <RoomCard
              :imageSrc="r.thumbnail"
              :class="[aspect, 'w-full']"
          >
            Live / <span class="tabular-nums">{{ r.active_users }}</span>
          </RoomCard>
        </NuxtLink>
      </div>
    </div>
    <div v-if="loading" class="py-4 text-center text-sm opacity-70">Loading…</div>
    <div v-else-if="!canLoadMore" class="py-6 text-center text-xs opacity-60">You’re all caught up.</div>
  </div>
</template>

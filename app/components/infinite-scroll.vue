<script setup lang="ts">
import { ref, computed } from 'vue'
import { useInfiniteScroll } from '@vueuse/core'
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller'

type Room = { id: string | number; thumbnail: string; active_users: number }
type RowItem = { __rowKey: number; cells: Room[] }

const props = withDefaults(defineProps<{
  endpoint?: string
  perPage?: number
  view?: 'grid' | 'list'
  cols?: 1 | 2 | 3 | 4
  aspectGrid?: string
  aspectList?: string
  extraQuery?: Record<string, any>
}>(), {
  endpoint: 'https://dummyjson.com/c/0188-d62d-4dd7-9ad2',
  perPage: 10,
  view: 'grid',
  cols: 2,
  aspectGrid: 'aspect-[16/9]',
  aspectList: 'aspect-[3/4]',
  extraQuery: () => ({})
})

const isList = computed(() => props.view === 'list')
const cols = computed(() => (isList.value ? 1 : props.cols))
const aspect = computed(() => (isList.value ? props.aspectList : props.aspectGrid))
const gridClass = computed(() => ({ 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' }[cols.value]))

const rooms = ref<Room[]>([])
const page = ref(1)
const loading = ref(false)
const canLoadMore = ref(true)

async function fetchPage() {
  if (loading.value || !canLoadMore.value) return
  loading.value = true
  try {
    const res = await $fetch(props.endpoint, { query: { page: page.value, perPage: props.perPage, ...props.extraQuery } }) as any
    const data: Room[] = Array.isArray(res) ? res : (res?.data ?? [])
    rooms.value.push(...data)
    page.value++
    if (!Array.isArray(res) && res?.meta) {
      const { page: p, perPage: pp, total } = res.meta
      canLoadMore.value = p * pp < total
    } else {
      canLoadMore.value = data.length >= props.perPage
    }
  } finally { loading.value = false }
}

// rows as objects with a stable key
const rows = computed<RowItem[]>(() => {
  const a = rooms.value, out: RowItem[] = []
  for (let i = 0; i < a.length; i += cols.value) {
    out.push({ __rowKey: out.length, cells: a.slice(i, i + cols.value) })
  }
  return out
})

useInfiniteScroll(window, async () => { if (canLoadMore.value) await fetchPage() }, { distance: 800 })
fetchPage()
</script>

<template>
  <DynamicScroller
      :items="rows"
      key-field="__rowKey"
      :min-item-size="80"
      page-mode
      class="mt-2"
  >
    <template #default="{ item, index, active }">
      <!-- item is RowItem -->
      <DynamicScrollerItem
          :item="item"
          :active="active"
          :size-dependencies="[cols]"
      >
        <div
            class="grid gap-3"
            :class="gridClass"
            style="contain: content; content-visibility: auto;"
        >
          <NuxtLink
              v-for="r in item.cells"
              :key="r.id"
              to="/"
              class="pb-2"
          >
            <RoomCard :imageSrc="r.thumbnail" :class="[aspect, 'w-full']">
              Live / <span class="tabular-nums">{{ r.id }}</span>
            </RoomCard>
          </NuxtLink>
        </div>
      </DynamicScrollerItem>
    </template>
  </DynamicScroller>

  <div v-if="loading" class="py-4 text-center text-md text-white font-bold">Loading…</div>
  <div v-else-if="!canLoadMore" class="py-6 text-center text-md text-white font-bold">You’re all caught up.</div>
</template>

<style scoped>
@import 'vue-virtual-scroller/dist/vue-virtual-scroller.css';
</style>

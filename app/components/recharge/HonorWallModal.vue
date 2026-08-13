<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'
import { RECHARGE_ACTIVITY, ASSETS } from '~/constants/assets'
import { formatCurrency } from '~/utils/currency'

// ========================================
// Props & Emits
// ========================================

defineOptions({ name: 'RechargeHonorWallModal' })

const props = defineProps<{
  open: boolean
  initialTimeframe?: 'weekly' | 'monthly'
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

// ========================================
// Data
// ========================================

const { data, isLoading, error, fetch } = useHonorWall()

// ========================================
// Tabs
// ========================================

const items: TabsItem[] = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
]

const activeTab = ref<string>(props.initialTimeframe ?? 'weekly')

// ========================================
// Fetch on open (lazy — once per mount)
// ========================================

watch(() => props.open, (val) => {
  if (val && !data.value) fetch()
})

// ========================================
// Derived
// ========================================

// `data` is exposed as a readonly ref, so the derived types are DeepReadonly —
// let inference flow that through rather than annotating a mutable shape.
const section = computed(() =>
  data.value ? data.value[activeTab.value as 'weekly' | 'monthly'] : null,
)

// Visual order: 2 — 1 — 3 (left-to-right, mirrors active podium)
const visualOrder = computed(() => {
  const entries = section.value?.entries ?? []
  const [first, second, third] = entries
  return [second ?? null, first ?? null, third ?? null]
})

function rankBg(rank: number): string {
  switch (rank) {
    case 1: return RECHARGE_ACTIVITY.honarWallUserDisplayBgTop1
    case 2: return RECHARGE_ACTIVITY.honarWallUserDisplayBgTop2
    default: return RECHARGE_ACTIVITY.honarWallUserDisplayBgTop3
  }
}

function formatInstanceKey(key: string | null, timeframe: string): string {
  if (!key) return ''
  const period = key.slice(key.indexOf(':') + 1)
  if (timeframe === 'weekly') {
    const m = period.match(/^(\d{4})-W(\d+)$/)
    return m ? `Week ${parseInt(m[2]!)}, ${m[1]}` : period
  }
  const m = period.match(/^(\d{4})-(\d{2})$/)
  if (m) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${months[parseInt(m[2]!) - 1] ?? m[2]} ${m[1]}`
  }
  return period
}
</script>

<template>
  <UModal
    :open="open"
    :ui="{ overlay: 'bg-transparent backdrop-blur-sm' }"
    @update:open="(val) => !val && emit('close')"
  >
    <template #content>
      <div class="relative overflow-hidden rounded-2xl">
        <!-- Modal background frame -->
        <img
          :src="RECHARGE_ACTIVITY.honarWallModelBg"
          alt=""
          class="w-full"
          aria-hidden="true"
        >

        <!-- Overlay content -->
        <div class="absolute inset-0 flex flex-col px-4 pt-15 pb-4">
          <!-- Close button -->
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="sm"
            class="absolute top-3 right-3 text-white/70"
            @click="emit('close')"
          />

          <!-- Timeframe tabs -->
          <UTabs
            v-model="activeTab"
            :items="items"
            class="mb-3"
            :ui="{
              root: 'min-w-full',
              list: 'rounded-full w-fit mx-auto',
              indicator: 'bg-linear-to-b from-amber-500 to-amber-800 rounded-full',
              trigger: 'grow',
              label: 'text-white text-sm',
            }"
          />

          <!-- Loading -->
          <div v-if="isLoading && !data" class="flex justify-center py-10">
            <div class="w-6 h-6 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
          </div>

          <!-- Error -->
          <div v-else-if="error && !data" class="text-center py-8">
            <p class="text-white/60 text-sm">{{ error }}</p>
            <UButton
              size="sm"
              class="mt-3 bg-amber-400 text-black font-bold rounded-lg"
              @click="fetch"
            >
              Retry
            </UButton>
          </div>

          <!-- Empty state: no closed instance yet for this timeframe -->
          <div
            v-else-if="section && section.instance_key === null"
            class="flex flex-col items-center justify-center py-10 gap-2"
          >
            <UIcon name="i-lucide-trophy" class="w-10 h-10 text-white/30" />
            <p class="text-white/50 text-sm text-center">
              No {{ activeTab }} winners yet — check back after the first close.
            </p>
          </div>

          <!-- Honor Wall display -->
          <template v-else-if="section && section.instance_key">
            <!-- Instance label -->
            <p class="text-center text-amber-300 text-xs font-semibold mb-3 tracking-wide">
              {{ formatInstanceKey(section.instance_key, activeTab) }}
            </p>

            <!-- 3 rank slots in 2–1–3 order -->
            <div class="grid grid-cols-3 items-end gap-2 px-1">
              <template v-for="(entry, idx) in visualOrder" :key="idx">
                <!-- Empty slot -->
                <div v-if="entry === null" />

                <!-- Rank slot -->
                <div v-else class="flex flex-col items-center gap-1">
                  <!-- Rank background frame with avatar overlay -->
                  <div class="relative w-full flex justify-center">
                    <img
                      :src="rankBg(entry.rank)"
                      :alt="`Rank ${entry.rank}`"
                      class="w-full"
                    >
                    <div
                      class="absolute inset-0 flex items-center justify-center"
                      :class="entry.rank === 1 ? '-mt-2' : 'mt-1'"
                    >
                      <UserAvatar
                        :img="entry.user.avatar ?? ASSETS.AVATAR_PLACEHOLDER"
                        :frame-id="entry.user.frame_id"
                        :user-name="entry.user.name"
                        animated
                        :class="entry.rank === 1 ? 'w-16' : 'w-12'"
                        class="rounded-full"
                      />
                    </div>
                  </div>

                  <!-- Name -->
                  <p class="text-white text-xs font-semibold truncate max-w-full text-center leading-tight">
                    {{ entry.user.name }}
                  </p>

                  <!-- Volume -->
                  <UBadge
                    icon="i-lucide-coins"
                    variant="outline"
                    size="xs"
                    class="backdrop-blur font-bold"
                    :class="entry.rank === 1 ? 'text-yellow-300' : entry.rank === 2 ? 'text-zinc-100' : 'text-amber-300'"
                  >
                    {{ formatCurrency(entry.volume) }}
                  </UBadge>
                </div>
              </template>
            </div>
          </template>
        </div>
      </div>
    </template>
  </UModal>
</template>

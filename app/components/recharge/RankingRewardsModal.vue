<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'
import type { RankingRewardItem, RewardType } from '~/types/mission/recharge'
import { RECHARGE_ACTIVITY, ASSETS } from '~/constants/assets'
import { resolveRewardAsset } from '~/utils/mission/resolveRewardAsset'
import type { ResolvedRewardAsset } from '~/utils/mission/resolveRewardAsset'
import { resolveMiceWaveRingColor } from '~/utils/mice-wave-ring-color'

// ========================================
// Props & Emits
// ========================================

defineOptions({ name: 'RechargeRankingRewardsModal' })

const props = defineProps<{
  open: boolean
  initialTimeframe?: 'weekly' | 'monthly'
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

// ========================================
// Data + Stores
// ========================================

const { data, isLoading, error, fetch } = useRankingRewards()
const mallStore = useMallStore()
const bootstrapStore = useBootstrapStore()

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
// Preview modal state
// ========================================

const previewReward = ref<{ reward: RankingRewardItem; resolved: ResolvedRewardAsset } | null>(null)

// ========================================
// Derived
// ========================================

// `data` is exposed as a readonly ref; let inference flow the DeepReadonly type
// rather than annotating a mutable array shape.
const timeframeRewards = computed(
  () => data.value?.[activeTab.value as 'weekly' | 'monthly'] ?? [],
)

interface RankGroup {
  rank: 1 | 2 | 3
  items: Array<{ reward: RankingRewardItem; resolved: ResolvedRewardAsset | null }>
}

const rankGroups = computed<RankGroup[]>(() => {
  const byRank: Record<number, RankingRewardItem[]> = {}
  for (const r of timeframeRewards.value) {
    ;(byRank[r.rank] ??= []).push(r)
  }
  return ([1, 2, 3] as const).map(rank => ({
    rank,
    items: (byRank[rank] ?? []).map(reward => ({
      reward,
      resolved: resolveRewardAsset(
        reward,
        mallStore.propIndex,
        bootstrapStore.vipLevels,
        bootstrapStore.badgeMap,
      ),
    })),
  }))
})

function rankLabel(rank: number): string {
  return rank === 1 ? '1st Place' : rank === 2 ? '2nd Place' : '3rd Place'
}

function rankAccent(rank: number): string {
  return rank === 1 ? 'text-yellow-300 border-yellow-400/40' : rank === 2 ? 'text-zinc-200 border-zinc-400/40' : 'text-amber-400 border-amber-600/40'
}

function rankIcon(rank: number): string {
  return rank === 1 ? 'i-lucide-trophy' : rank === 2 ? 'i-lucide-medal' : 'i-lucide-award'
}

function openPreview(reward: RankingRewardItem, resolved: ResolvedRewardAsset): void {
  previewReward.value = { reward, resolved }
}
</script>

<template>
  <UModal
    :open="open"
    :ui="{ overlay: 'bg-black/80 backdrop-blur-sm' }"
    @update:open="(val) => !val && emit('close')"
  >
    <template #content>
      <div class="relative overflow-hidden rounded-2xl">
        <!-- Modal background frame -->
        <img
          :src="RECHARGE_ACTIVITY.winnersRankRewardsModelBg"
          alt=""
          class="w-full"
          aria-hidden="true"
        >

        <!-- Overlay content -->
        <div class="absolute inset-0 flex flex-col px-4 pt-12 pb-4 overflow-y-auto">
          <!-- Close button -->
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="sm"
            class="absolute top-3 right-3 text-white/70 z-10"
            @click="emit('close')"
          />

          <!-- Timeframe tabs -->
          <UTabs
            v-model="activeTab"
            :items="items"
            class="mb-4 shrink-0"
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

          <!-- Empty state: no rewards configured for this timeframe -->
          <div
            v-else-if="data && timeframeRewards.length === 0"
            class="flex flex-col items-center justify-center py-10 gap-2"
          >
            <UIcon name="i-lucide-gift" class="w-10 h-10 text-white/30" />
            <p class="text-white/50 text-sm text-center">
              No {{ activeTab }} rewards configured yet.
            </p>
          </div>

          <!-- Rank groups -->
          <div v-else-if="data" class="flex flex-col gap-4">
            <div
              v-for="group in rankGroups"
              :key="group.rank"
            >
              <!-- Rank header -->
              <div
                class="flex items-center gap-2 mb-2 pb-1 border-b"
                :class="rankAccent(group.rank)"
              >
                <UIcon :name="rankIcon(group.rank)" class="w-4 h-4" :class="rankAccent(group.rank).split(' ')[0]" />
                <span class="font-bold text-sm" :class="rankAccent(group.rank).split(' ')[0]">
                  {{ rankLabel(group.rank) }}
                </span>
              </div>

              <!-- No rewards for this rank -->
              <p
                v-if="group.items.length === 0"
                class="text-white/40 text-xs text-center py-2"
              >
                No rewards for this rank.
              </p>

              <!-- Reward items row -->
              <div
                v-else
                class="flex flex-wrap gap-3 justify-center"
              >
                <div
                  v-for="{ reward, resolved } in group.items"
                  :key="reward.id"
                  class="flex flex-col items-center gap-1 w-16"
                >
                  <!-- Coins -->
                  <template v-if="reward.reward_type === 'coins'">
                    <img :src="ASSETS.COIN_ICON_LARGE" alt="" class="w-14" aria-hidden="true">
                    <span class="text-xs text-center font-bold text-white leading-tight">
                      +{{ reward.coin_value?.toLocaleString() }}
                      <template v-if="reward.coin_mode === 'percentage'">%</template>
                    </span>
                  </template>

                  <!-- VIP: animated emblem -->
                  <template v-else-if="reward.reward_type === 'vip' && resolved?.thumbnailUrl">
                    <button
                      v-if="resolved.assetUrl"
                      class="w-14 rounded-lg overflow-hidden focus:outline-none cursor-pointer"
                      @click="openPreview(reward, resolved)"
                    >
                      <AssetPlayer :src="resolved.thumbnailUrl" :muted="true" class="w-full" />
                    </button>
                    <AssetPlayer v-else :src="resolved.thumbnailUrl" :muted="true" class="w-14" />
                    <span class="text-xs text-center text-amber-300 font-bold leading-tight">
                      {{ resolved.name }}
                    </span>
                    <span v-if="reward.duration_days" class="text-xs text-white/50 leading-tight">
                      {{ reward.duration_days }}d
                    </span>
                  </template>

                  <!-- Mice wave: static ring, click opens the animated preview modal -->
                  <template v-else-if="reward.reward_type === 'prop' && resolved?.propType === 'mice_wave'">
                    <button
                      class="w-14 rounded-lg focus:outline-none cursor-pointer"
                      @click="openPreview(reward, resolved)"
                    >
                      <MiceWaveRing :color="resolveMiceWaveRingColor(resolved.metadata)" :animated="false" />
                    </button>
                    <span class="text-xs text-center text-amber-300 font-bold leading-tight">
                      {{ resolved.name }}
                    </span>
                    <span v-if="reward.duration_days" class="text-xs text-white/50 leading-tight">
                      {{ reward.duration_days }}d
                    </span>
                  </template>

                  <!-- Prop / Badge: static image -->
                  <template v-else-if="resolved?.thumbnailUrl">
                    <button
                      v-if="resolved.assetUrl"
                      class="w-14 focus:outline-none cursor-pointer"
                      @click="openPreview(reward, resolved)"
                    >
                      <img :src="resolved.thumbnailUrl" :alt="resolved.name" class="w-full rounded-lg">
                    </button>
                    <img v-else :src="resolved.thumbnailUrl" :alt="resolved.name" class="w-14 rounded-lg">
                    <span class="text-xs text-center text-amber-300 font-bold leading-tight">
                      {{ resolved.name }}
                    </span>
                    <span v-if="reward.duration_days" class="text-xs text-white/50 leading-tight">
                      {{ reward.duration_days }}d
                    </span>
                  </template>

                  <!-- Bootstrap miss: graceful fallback -->
                  <template v-else>
                    <img :src="ASSETS.COIN_ICON_LARGE" alt="" class="w-14" aria-hidden="true">
                    <span class="text-xs text-center text-amber-300 font-bold leading-tight">
                      {{ reward.reward_type }}
                    </span>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Reward preview modal (nested) -->
      <RechargeRewardPreviewModal
        :open="previewReward !== null"
        :reward-type="(previewReward?.reward.reward_type as RewardType | null) ?? null"
        :resolved="previewReward?.resolved ?? null"
        @close="previewReward = null"
      />
    </template>
  </UModal>
</template>

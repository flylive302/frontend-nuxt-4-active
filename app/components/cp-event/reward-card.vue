<script setup lang="ts">
import type { CpRewardItem } from '~/types/cp'
import type { ResolvedRewardAsset } from '~/utils/mission/resolveRewardAsset'
import { ASSETS } from '~/constants/assets'
import { withImageKitTransform } from '~/utils/imagekit'
import { resolveRewardAsset } from '~/utils/mission/resolveRewardAsset'

// ========================================
// Props & Emits
// ========================================

const props = defineProps<{
  rank: number
  rewards: readonly CpRewardItem[]
}>()

const emit = defineEmits<{
  (e: 'preview', payload: { reward: CpRewardItem; resolved: ResolvedRewardAsset }): void
}>()

// ========================================
// Stores
// ========================================

const mallStore = useMallStore()
const bootstrapStore = useBootstrapStore()

// ========================================
// Derived (display only)
// ========================================

const rankLabel = computed(() =>
  props.rank === 1 ? '1st Place' : props.rank === 2 ? '2nd Place' : '3rd Place',
)

const entries = computed(() =>
  props.rewards.map(reward => ({
    reward,
    resolved: resolveRewardAsset(
      reward,
      mallStore.propIndex,
      bootstrapStore.vipLevels,
      bootstrapStore.badgeMap,
    ),
  })),
)

/** Tiles are `w-20` (80 CSS px). */
function tileSrc(url: string | null | undefined): string {
  return withImageKitTransform(url, { w: 200, q: 75 })
}
</script>

<template>
  <section class="rounded-2xl border border-amber-400/30 bg-black/30 p-4">
    <h2 class="mb-3 text-center text-lg font-bold text-amber-300">{{ rankLabel }}</h2>

    <p v-if="entries.length === 0" class="text-center text-sm text-white/60">No rewards set</p>

    <div v-else class="grid grid-cols-2 gap-3">
      <div
        v-for="{ reward, resolved } in entries"
        :key="reward.id"
        class="flex flex-col items-center gap-2"
      >
        <template v-if="reward.reward_type === 'coins'">
          <img :src="ASSETS.COIN_ICON_LARGE" alt="" class="w-20" aria-hidden="true">
          <span class="text-center text-md font-bold text-white">+{{ reward.coin_value?.toLocaleString() }} Coins</span>
        </template>

        <template v-else-if="resolved">
          <template v-if="reward.reward_type === 'vip' && resolved.thumbnailUrl">
            <button
              v-if="resolved.assetUrl"
              class="w-20 cursor-pointer overflow-hidden rounded-lg focus:outline-none"
              @click="emit('preview', { reward, resolved })"
            >
              <AssetPlayer :src="resolved.thumbnailUrl" :muted="true" class="w-full" />
            </button>
            <AssetPlayer v-else :src="resolved.thumbnailUrl" :muted="true" class="w-20" />
          </template>

          <template v-else-if="resolved.thumbnailUrl">
            <button
              v-if="resolved.assetUrl"
              class="w-20 cursor-pointer focus:outline-none"
              @click="emit('preview', { reward, resolved })"
            >
              <img :src="tileSrc(resolved.thumbnailUrl)" :alt="resolved.name" class="w-full rounded-lg">
            </button>
            <img v-else :src="tileSrc(resolved.thumbnailUrl)" :alt="resolved.name" class="w-20 rounded-lg">
          </template>

          <img v-else :src="ASSETS.COIN_ICON_LARGE" alt="" class="w-20" aria-hidden="true">

          <span class="text-center text-md font-bold text-amber-300">{{ resolved.name }}</span>
        </template>

        <template v-else>
          <img :src="ASSETS.COIN_ICON_LARGE" alt="" class="w-20" aria-hidden="true">
          <span class="text-center text-md font-bold text-amber-300">{{ reward.reward_type }}</span>
        </template>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { MilestoneProgress, MilestoneReward, RewardType } from '~/types/mission/recharge'
import { RECHARGE_ACTIVITY, ASSETS } from '~/constants/assets'
import { resolveRewardAsset } from '~/utils/mission/resolveRewardAsset'
import type { ResolvedRewardAsset } from '~/utils/mission/resolveRewardAsset'

// ========================================
// Props
// ========================================

const props = defineProps<{
  milestone: MilestoneProgress
  netVolume: number
  timeframe: string
}>()

// ========================================
// Stores + actions
// ========================================

const mallStore = useMallStore()
const bootstrapStore = useBootstrapStore()
const { claimMilestone, claimingMilestoneId } = useMissionActions()

// ========================================
// Modal state
// ========================================

const previewReward = ref<{ reward: MilestoneReward; resolved: ResolvedRewardAsset } | null>(null)

// ========================================
// Derived state (INTENT — pure display)
// ========================================

const progressPercent = computed(() => {
  if (props.milestone.threshold === 0) return 100
  return Math.min(100, Math.round((props.netVolume / props.milestone.threshold) * 100))
})

const isClaimable = computed(() => props.milestone.state === 'claimable')

const isClaiming = computed(() => claimingMilestoneId.value === props.milestone.id)

const buttonLabel = computed(() => {
  if (props.milestone.state === 'claimed') return 'Received'
  if (props.milestone.state === 'claimable') return isClaiming.value ? 'Claiming...' : 'Claim Now'
  return 'Not There Yet'
})

const buttonDisabled = computed(
  () => props.milestone.state !== 'claimable' || isClaiming.value,
)

/** Precompute resolved asset metadata for each reward to avoid repeated lookups in template. */
const rewardEntries = computed(() =>
  props.milestone.rewards.map(reward => ({
    reward,
    resolved: resolveRewardAsset(
      reward,
      mallStore.propIndex,
      bootstrapStore.vipLevels,
      bootstrapStore.badgeMap,
    ),
  }))
)

function openPreview(reward: MilestoneReward, resolved: ResolvedRewardAsset): void {
  previewReward.value = { reward, resolved }
}

// ========================================
// Stretchable card frame (9-slice border-image)
// ========================================
// task Bg is a decorative frame (gold rounded top/sides, diamond center, bottom
// flourishes). Used as a border-image so the card grows/shrinks with the rewards
// grid instead of being locked to the image's fixed aspect ratio.
const taskCardStyle = { borderImageSource: `url(${RECHARGE_ACTIVITY.taskBg})` }
</script>

<template>
  <div class="w-full">
    <div class="w-3/4 mx-auto relative z-10">
      <img :src="RECHARGE_ACTIVITY.topHeader" alt="recharge activity" class="w-full">
      <p class="font-bold absolute inset-0 flex items-center justify-center text-md mt-2 text-white">
        {{ milestone.threshold.toLocaleString() }} Coins
      </p>
    </div>

    <!-- Stretchable task card: taskBg as a 9-slice border-image so the frame grows
         with the rewards grid (1, 2, or 4+ rewards) instead of a fixed-aspect image. -->
    <div class="task-card w-full -mt-6" :style="taskCardStyle">
      <div class="flex items-center justify-center gap-2 mb-3 px-8">
        <!-- Progress bar -->
        <div class="h-4 w-full rounded-full bg-tertiary/30 overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-500"
            :class="isClaimable ? 'bg-amber-400' : 'bg-amber-600'"
            :style="{ width: `${progressPercent}%` }"
          />
        </div>
        <!-- Volume label -->
        <p class="text-white w-fit text-md" style="white-space: nowrap; width: max-content;">
          {{ formatCurrency(netVolume) }} / {{ formatCurrency(milestone.threshold) }}
        </p>
      </div>

      <!-- Rewards grid: 2 columns, flows to new rows for >2 rewards -->
      <div
        v-if="milestone.rewards.length > 0"
        class="grid gap-2 w-fit mx-auto"
        :class="milestone.rewards.length > 1 ? 'grid-cols-2' : 'grid-cols-1'"
      >
        <div
          v-for="{ reward, resolved } in rewardEntries"
          :key="reward.id"
          class="flex flex-col justify-center items-center gap-2"
        >
          <!-- Coin reward -->
          <template v-if="reward.reward_type === 'coins'">
            <img :src="ASSETS.COIN_ICON_LARGE" alt="" class="w-20 sm:w-24" aria-hidden="true">
            <span class="text-md text-center font-bold">+{{ reward.coin_value?.toLocaleString() }} Coins</span>
          </template>

          <!-- Resolved reward (prop / vip / badge) -->
          <template v-else-if="resolved">
            <!-- VIP emblem thumbnail: always an animated svga — use AssetPlayer -->
            <template v-if="reward.reward_type === 'vip' && resolved.thumbnailUrl">
              <button
                v-if="resolved.assetUrl"
                class="w-20 sm:w-24 rounded-lg overflow-hidden focus:outline-none cursor-pointer"
                @click="openPreview(reward, resolved)"
              >
                <AssetPlayer :src="resolved.thumbnailUrl" :muted="true" class="w-full" />
              </button>
              <AssetPlayer v-else :src="resolved.thumbnailUrl" :muted="true" class="w-20 sm:w-24" />
            </template>

            <!-- Prop / badge thumbnail: static image -->
            <template v-else-if="resolved?.thumbnailUrl">
              <button
                v-if="resolved.assetUrl"
                class="w-20 sm:w-24 focus:outline-none cursor-pointer"
                @click="openPreview(reward, resolved)"
              >
                <img
                  :src="resolved.thumbnailUrl"
                  :alt="resolved.name"
                  class="w-full rounded-lg"
                >
              </button>
              <img
                v-else
                :src="resolved.thumbnailUrl"
                :alt="resolved.name"
                class="w-20 sm:w-24 rounded-lg"
              >
            </template>

            <!-- No thumbnail: generic fallback -->
            <template v-else>
              <img :src="ASSETS.COIN_ICON_LARGE" alt="" class="w-20 sm:w-24" aria-hidden="true">
            </template>

            <span class="text-amber-300 text-md text-center font-bold">{{ resolved.name }}</span>
          </template>

          <!-- Store miss (reward data not in bootstrap yet): graceful fallback -->
          <template v-else>
            <img :src="ASSETS.COIN_ICON_LARGE" alt="" class="w-20 sm:w-24" aria-hidden="true">
            <span class="text-amber-300 text-md text-center font-bold">{{ reward.reward_type }}</span>
          </template>
        </div>
      </div>

      <!-- Receive button -->
      <div class="w-full flex justify-center mt-4">
        <UButton
          variant="solid"
          size="xl"
          :disabled="buttonDisabled"
          :loading="isClaiming"
          class="mx-auto bg-linear-to-br from-tertiary-400 to-tertiary-800 rounded-full"
          :class="milestone.state === 'claimed' ? 'opacity-60' : ''"
          @click="claimMilestone(timeframe, milestone.id)"
        >
          {{ buttonLabel }}
        </UButton>
      </div>
    </div>

    <!-- Reward preview modal -->
    <RechargeRewardPreviewModal
      :open="previewReward !== null"
      :reward-type="(previewReward?.reward.reward_type as RewardType | null) ?? null"
      :resolved="previewReward?.resolved ?? null"
      @close="previewReward = null"
    />
  </div>
</template>

<style scoped>
/*
 * Stretchable card frame via 9-slice border-image (same technique as the room
 * chat bubble). The decorative frame lives entirely in the border; the content
 * flows inside the border box, so the card grows vertically with extra reward
 * rows and the top/banner edges stretch horizontally — corners (incl. the gold
 * bottom flourishes) stay undistorted.
 *
 * --- TUNING KNOBS (verify by eye on a real device — slices are estimates of the
 *     736x520 source: gold top, diamond center, bottom flourishes on red banner) ---
 *   border-image-slice : how much of the SOURCE forms each edge/corner (top right bottom left).
 *   border-image-width : how THICK the frame renders (may exceed border-width → draws inward).
 *   border-width       : content inset (kept slim on the sides so the 2-col grid fits on mobile).
 */
.task-card {
  box-sizing: border-box;
  border-style: solid;
  border-width: 30px 16px 52px 16px;            /* content inset: top right bottom left */
  border-image-slice: 60 110 130 110 fill;       /* source slices: top right bottom left */
  border-image-width: 44px 80px 100px 80px;      /* rendered frame thickness */
  border-image-repeat: stretch;
}
</style>

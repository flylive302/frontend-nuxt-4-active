<script setup lang="ts">
import type { CpRewardItem } from '~/types/cp'
import type { RewardType } from '~/types/mission/recharge'
import type { ResolvedRewardAsset } from '~/utils/mission/resolveRewardAsset'

definePageMeta({ layout: 'cp', middleware: ['auth', 'cp-enabled'] })

const { data, isLoading, error, fetchRewards } = useCpRewards()

const previewReward = ref<{ reward: CpRewardItem; resolved: ResolvedRewardAsset } | null>(null)

const hasAnyRewards = computed(() => data.value?.ranks.some(r => r.rewards.length > 0) ?? false)

onMounted(() => {
  void fetchRewards()
})
</script>

<template>
  <div class="flex flex-col gap-4 p-4">
    <p v-if="isLoading && !data" class="py-10 text-center text-white/70">Loading...</p>
    <div v-else-if="error && !data" class="py-10 text-center">
      <p class="text-white/70">{{ error }}</p>
      <UButton class="mt-2" variant="soft" @click="fetchRewards">Retry</UButton>
    </div>
    <p v-else-if="data && !hasAnyRewards" class="py-10 text-center text-white/70">No rewards yet</p>

    <template v-else-if="data">
      <CpEventRewardCard
        v-for="entry in data.ranks"
        :key="entry.rank"
        :rank="entry.rank"
        :rewards="entry.rewards"
        @preview="previewReward = $event"
      />
    </template>

    <RechargeRewardPreviewModal
      :open="previewReward !== null"
      :reward-type="(previewReward?.reward.reward_type as RewardType | null) ?? null"
      :resolved="previewReward?.resolved ?? null"
      @close="previewReward = null"
    />
  </div>
</template>

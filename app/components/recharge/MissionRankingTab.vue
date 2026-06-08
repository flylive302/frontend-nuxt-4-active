<script setup lang="ts">
/**
 * Ranking tab content for weekly/monthly mission pages.
 *
 * Mounts inside UTabs (unmountOnHide: true), so lifecycle naturally
 * pauses polling when the Task tab is active.
 * Adaptive polling and finale.ready echo live in useRechargeLeaderboard.
 *
 * Sound priming: prefetches the announcement sound and attaches a
 * one-shot pointerdown listener here (before the finale fires) so the
 * later programmatic play() on reveal is not blocked by autoplay policy.
 */
import {ASSETS, RECHARGE_ACTIVITY} from '~/constants/assets'
import {formatCurrency} from "~/utils/currency";

const props = defineProps<{
  timeframe: 'weekly' | 'monthly'
}>()

const { leaderboard, isLoading, error, refresh } = useRechargeLeaderboard(props.timeframe)

// ========================================
// Finale sound priming
// ========================================

const store = useMissionStore()
const sound = useMissionFinaleSound()

watch(
  () => store.progressFor(props.timeframe)?.config?.announcement_sounds,
  (sounds) => {
    const url = sounds?.[props.timeframe] ?? null
    if (url) sound.prefetch(props.timeframe, url)
  },
  { immediate: true },
)

onMounted(() => {
  sound.primeGesture()
})

// Top-1 entry shown in the hero frame; rest listed below
const top1 = computed(() => leaderboard.value?.entries?.[0] ?? null)
const restEntries = computed(() => leaderboard.value?.entries.slice(1) ?? [])

// Self: show pinned row only when self exists and isn't in the displayed list
const self = computed(() => leaderboard.value?.self ?? null)
const selfInTop = computed(() =>
  self.value !== null
  && (leaderboard.value?.entries ?? []).some(e => e.rank === self.value!.rank),
)

const rewardsOpen = ref(false)

const top1FrameAsset = computed(() =>
    props.timeframe === 'monthly'
        ? RECHARGE_ACTIVITY.top1Fame_monthly
        : RECHARGE_ACTIVITY.top1Frame_weekly,
)
</script>

<template>
  <div class="relative pb-4">
    <button
        class="h-13 w-20 bg-cover bg-center bg-no-repeat absolute right-0 top-34 z-50 font-bold text-sm text-white pb-1 text-right"
        :style="{ backgroundImage: `url(${RECHARGE_ACTIVITY.btnRules})` }"
          @click="rewardsOpen = true"
    >
      Rewards
    </button>
    <div v-if="top1" class="relative flex flex-col items-center justify-center">
      <img :src="top1FrameAsset" class="relative w-98 z-10" alt="">
      <img :src="top1.user?.avatar ?? ASSETS.AVATAR_PLACEHOLDER" class="w-24 absolute mt-11 z-0 rounded-full" alt="avatar">
    </div>
    <!-- Empty state -->
    <p v-if="leaderboard?.entries.length === 0" class="text-center text-white/60 text-sm py-6">
      No rankings yet — be the first to recharge!
    </p>
    <!-- Background decoration -->
    <img :src="RECHARGE_ACTIVITY.rankingListBg" alt="" class="w-full" aria-hidden="true">

    <div class="absolute top-54 px-8 space-y-2 w-full">
      <!-- Loading skeleton -->
      <template v-if="isLoading && !leaderboard">
        <div v-for="i in 5" :key="i" class="flex items-center gap-3 px-3 py-2">
          <USkeleton class="w-8 h-8 rounded-full" />
          <USkeleton class="w-10 h-10 rounded-full" />
          <USkeleton class="h-4 flex-1" />
          <USkeleton class="h-4 w-16" />
        </div>
      </template>

      <!-- Error state -->
      <div v-else-if="error && !leaderboard" class="text-center py-6">
        <p class="text-white/60 text-sm">{{ error }}</p>
        <UButton
            size="sm"
            class="mt-3 bg-amber-400 text-black font-bold"
            @click="refresh"
        >
          Retry
        </UButton>
      </div>

      <template v-else-if="leaderboard">
        <TransitionGroup
            v-if="restEntries.length > 0"
            name="ranking-row"
            tag="div"
            class="h-[88vh] overflow-scroll flex flex-col gap-3"
        >
            <MinimalUserList v-for="entry in restEntries" :key="entry.user.id" :user="entry.user">
              <div class="flex flex-col items-end pr-1 gap-0.5">
                <span class="text-xs font-semibold text-primary">
                  {{ formatCurrency(entry.volume) }}
                </span>
                <span class="text-[10px] text-white/50">#{{ entry.rank }}</span>
              </div>
            </MinimalUserList>
        </TransitionGroup>

        <!-- Pinned self-row (only when self is outside the displayed list) -->
        <RechargeMissionRankingSelfRow
            v-if="self && !selfInTop"
            :self="self"
            class="mt-2"
        />
      </template>
    </div>

    <RechargeRankingRewardsModal
      :open="rewardsOpen"
      :initial-timeframe="props.timeframe"
      @close="rewardsOpen = false"
    />

    <!-- Finale cinematic overlay — auto-manages open/close via useMissionFinale -->
    <RechargeMissionFinaleOverlay :timeframe="props.timeframe" />
  </div>
</template>

<style scoped>
/* FLIP animation: applied to each row when it moves to a new position in the
   list without being destroyed/recreated (key="entry.user.id" enables this). */
.ranking-row-move {
  transition: transform 0.35s ease;
}
</style>

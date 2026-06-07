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
import { RECHARGE_ACTIVITY } from '~/constants/assets'

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

// Top-3 entries and the rest (4..N) split
const top3 = computed(() => leaderboard.value?.entries.slice(0, 3) ?? [])
const restEntries = computed(() => leaderboard.value?.entries.slice(3) ?? [])

// Self: show pinned row only when self exists and isn't in the top list
const self = computed(() => leaderboard.value?.self ?? null)
const selfInTop = computed(() =>
  self.value !== null
  && (leaderboard.value?.entries ?? []).some(e => e.rank === self.value!.rank),
)

// ========================================
// Modal state
// ========================================

const honorWallOpen = ref(false)
const rewardsOpen = ref(false)
</script>

<template>
  <div class="relative pb-4">
    <!-- Background decoration -->
    <img :src="RECHARGE_ACTIVITY.rankingListBg" alt="" class="w-full" aria-hidden="true">

    <!-- Honor Wall + Rewards quick-access buttons -->
    <div class="relative -mt-2 px-2 pb-2 flex justify-center gap-3">
      <UButton
        icon="i-lucide-trophy"
        size="sm"
        variant="outline"
        class="border-amber-400/50 text-amber-300 font-semibold"
        @click="honorWallOpen = true"
      >
        Hall of Fame
      </UButton>
      <UButton
        icon="i-lucide-gift"
        size="sm"
        variant="outline"
        class="border-amber-400/50 text-amber-300 font-semibold"
        @click="rewardsOpen = true"
      >
        Rewards
      </UButton>
    </div>

    <div class="relative px-2 space-y-2">
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
        <!-- Podium: top-3 featured -->
        <RechargeMissionRankingPodium
          v-if="top3.length > 0"
          :entries="top3"
          :timeframe="timeframe"
        />

        <!-- Empty state -->
        <p v-if="leaderboard.entries.length === 0" class="text-center text-white/60 text-sm py-6">
          No rankings yet — be the first to recharge!
        </p>

        <!-- List: ranks 4..N; keyed by user.id so FLIP (TransitionGroup move)
             animates position swaps instead of destroying/recreating nodes. -->
        <TransitionGroup
          v-if="restEntries.length > 0"
          name="ranking-row"
          tag="div"
          class="flex flex-col gap-1 border border-white/20 rounded-xl overflow-hidden backdrop-blur shadow-md"
        >
          <RechargeMissionRankingRow
            v-for="entry in restEntries"
            :key="entry.user.id"
            :entry="entry"
          />
        </TransitionGroup>

        <!-- Pinned self-row (only when self is outside the displayed list) -->
        <RechargeMissionRankingSelfRow
          v-if="self && !selfInTop"
          :self="self"
          class="mt-2"
        />
      </template>
    </div>

    <!-- Modals -->
    <RechargeHonorWallModal
      :open="honorWallOpen"
      :initial-timeframe="timeframe"
      @close="honorWallOpen = false"
    />
    <RechargeRankingRewardsModal
      :open="rewardsOpen"
      :initial-timeframe="timeframe"
      @close="rewardsOpen = false"
    />

    <!-- Finale cinematic overlay — auto-manages open/close via useMissionFinale -->
    <RechargeMissionFinaleOverlay :timeframe="timeframe" />
  </div>
</template>

<style scoped>
/* FLIP animation: applied to each row when it moves to a new position in the
   list without being destroyed/recreated (key="entry.user.id" enables this). */
.ranking-row-move {
  transition: transform 0.35s ease;
}
</style>

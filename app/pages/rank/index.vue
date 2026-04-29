<script setup lang="ts">
/**
 * /rank — Global rankings page.
 *
 * Outer tabs select category (wealth/charm/room/agency); inner tabs
 * select time window (daily/weekly/monthly). Selection is reflected
 * in the URL query string so links are shareable.
 */
import { useRankingData } from '~/composables/ranking/useRankingData'
import { useAuthStore } from '~/stores/auth'
import {
  RANKING_CATEGORIES,
  RANKING_PERIODS,
  CATEGORY_LABELS,
  PERIOD_LABELS,
  type RankingCategory,
  type RankingPeriod,
} from '~/constants/ranking'

definePageMeta({ layout: 'alt', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

// ========================================
// Selection (URL-driven)
// ========================================

function isCategory(value: unknown): value is RankingCategory {
  return typeof value === 'string'
    && (RANKING_CATEGORIES as readonly string[]).includes(value)
}

function isPeriod(value: unknown): value is RankingPeriod {
  return typeof value === 'string'
    && (RANKING_PERIODS as readonly string[]).includes(value)
}

const category = computed<RankingCategory>(() =>
  isCategory(route.query.cat) ? route.query.cat : 'wealth',
)
const period = computed<RankingPeriod>(() =>
  isPeriod(route.query.period) ? route.query.period : 'daily',
)

function setCategory(value: RankingCategory): void {
  void router.replace({ query: { ...route.query, cat: value } })
}

function setPeriod(value: RankingPeriod): void {
  void router.replace({ query: { ...route.query, period: value } })
}

// ========================================
// Data
// ========================================

const { ensureLoaded, refresh, bindToSelection } = useRankingData()
const { entries, currentUser, isLoading, error } = bindToSelection(
  () => category.value,
  () => period.value,
)

const podiumTop3 = computed(() => entries.value.slice(0, 3))
const restEntries = computed(() => entries.value.slice(3))

watch(
  [category, period],
  ([cat, per]) => {
    void ensureLoaded(cat, per)
  },
  { immediate: true },
)

useHead({
  title: computed(() => `${CATEGORY_LABELS[category.value]} · ${PERIOD_LABELS[period.value]} · Leaderboard`),
})
</script>

<template>
  <main class="px-3 pt-2 pb-24">

    <NavAlt back-to="/">Ranking</NavAlt>
    <div class="h-12"></div>
    <RankingCategoryTabs
      :model-value="category"
      @update:model-value="setCategory"
    />

    <div class="mt-3">
      <RankingPeriodTabs
        :model-value="period"
        @update:model-value="setPeriod"
      />
    </div>

    <RankingError
      v-if="error"
      :message="error"
      class="mt-6"
      @retry="refresh(category, period)"
    />

    <RankingPodium
      :top3="podiumTop3"
      :category="category"
    />

    <RankingList
      v-if="!error"
      :entries="restEntries"
      :category="category"
      :loading="isLoading"
      class="mt-2"
    />

    <RankingEmpty
      v-if="!error && !isLoading && entries.length === 0"
    />

    <RankingCurrentUserBar
      v-if="authStore.isAuthenticated"
      :rank="currentUser"
      :category="category"
    />
  </main>
</template>

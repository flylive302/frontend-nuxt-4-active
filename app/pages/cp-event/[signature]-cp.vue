<script setup lang="ts">
import { ASSETS } from '~/constants/assets'
import { formatCurrency } from '~/utils/currency'

definePageMeta({
  middleware: ['auth', 'cp-enabled'],
})

const route = useRoute()
const signature = computed(() => route.params.signature as string)

const { profile, status, refetch } = useCpProfile(signature)
const { frameAnimationEnabled } = useFrameAnimationBudget()

const topPair = computed(() => profile.value?.top_pair ?? null)
const pairs = computed(() => profile.value?.pairs ?? [])
</script>

<template>
  <main>
    <NavAlt spacer back-to="/profile">CP Event</NavAlt>
    <div class="relative h-screen max-h-screen overflow-y-auto bg-cover pb-24" :style="{ backgroundImage: `url(${ASSETS.CP_USER_BACKGROUND})` }">
      <p v-if="status === 'loading' || status === 'idle'" class="py-16 text-center font-semibold">Loading…</p>
      <p v-else-if="status === 'blocked'" class="py-16 text-center font-semibold">This CP profile is unavailable.</p>
      <p v-else-if="status === 'not_found'" class="py-16 text-center font-semibold">User not found.</p>
      <div v-else-if="status === 'error'" class="py-16 text-center">
        <p class="font-semibold">Could not load this profile.</p>
        <UButton class="mt-2" variant="soft" @click="refetch">Retry</UButton>
      </div>

      <template v-else>
        <img :src="ASSETS.CP_USER_DECORATION" alt="">

        <template v-if="topPair">
          <div class="px-22 -mt-50">
            <CpEventCouplePair :pair="topPair" variant="hero" :animated="frameAnimationEnabled" />
            <div class="h-24 mt-4 relative">
              <img :src="ASSETS.CP_USER_STATS_DECOR" class="relative z-0" alt="">
              <p class="text-xl w-full mx-auto font-bold text-center -mt-14 relative z-10">{{ formatCurrency(topPair.lifetime_intimacy) }}</p>
            </div>
          </div>

          <CpEventStatRow
            class="mx-4 mt-2"
            :days="topPair.days"
            :intimacy="topPair.lifetime_intimacy"
            :rank="topPair.lifetime_rank"
            :points="topPair.points"
          />
        </template>

        <p v-else class="px-4 py-10 text-center text-lg font-semibold">No CP yet</p>

        <div v-for="pair in pairs" :key="pair.pair_id" class="px-4">
          <CpEventCardFrame>
            <CpEventCouplePair :pair="pair" variant="hero" />
            <img alt="" :src="ASSETS.CP_DEVIDER">
            <CpEventStatRow
              class="mt-3 -mb-6"
              :days="pair.days"
              :intimacy="pair.lifetime_intimacy"
              :rank="pair.lifetime_rank"
              :points="pair.points"
            />
            <CpEventBreakButton v-if="pair.can_break" :pair-id="pair.pair_id" @broken="refetch" />
          </CpEventCardFrame>
        </div>
      </template>
    </div>
  </main>
</template>

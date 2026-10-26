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
          <div class="px-4 -mt-50">
            <CpEventCouplePair :pair="topPair" class="mx-14" variant="hero" :animated="frameAnimationEnabled" />
            <div class="relative -mt-10">
              <img :src="ASSETS.CP_USER_STATS_DECOR" class="relative z-0" alt="">
              <div class="flex justify-between absolute top-0 w-full px-14 mt-18">
                <div class="">
                  <p class="text-xl font-bold text-center">{{topPair.days}}</p>
                  <p class="text-sm font-semibold text-center">Days</p>
                </div>
                <div class="">
                  <p class="text-xl font-bold text-center">{{formatCurrency( topPair.lifetime_intimacy )}}</p>
                  <p class="text-sm font-semibold text-center">Intimacy</p>
                </div>
                <div class="">
                  <p class="text-xl font-bold text-center">{{topPair.lifetime_rank ?? '-'}}</p>
                  <p class="text-sm font-semibold text-center">All-time rank</p>
                </div>
                <div class="">
                  <p class="text-xl font-bold text-center">{{formatCurrency(topPair.points)}}</p>
                  <p class="text-sm font-semibold text-center">Points</p>
                </div>
              </div>
            </div>
          </div>
        </template>

        <p v-else class="px-4 py-10 text-center text-lg font-semibold">No CP yet</p>

        <div v-for="pair in pairs" :key="pair.pair_id" class="px-4">
          <CpEventCardFrame>
            <CpEventCouplePair :pair="pair" variant="hero" class="px-4" />
            <CpEventStatRow
              :days="pair.days"
              :intimacy="pair.lifetime_intimacy"
              :rank="pair.lifetime_rank"
              :points="pair.points"
              class="-mt-8 relative z-10"
            />
            <CpEventBreakButton
                v-if="pair.can_break"
                :pair-id="pair.pair_id"
                class="relative z-0 -mt-3"
                @broken="refetch"
            />
          </CpEventCardFrame>
        </div>
      </template>
    </div>
  </main>
</template>

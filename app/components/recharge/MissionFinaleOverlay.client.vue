<script setup lang="ts">
/**
 * Full-screen cinematic overlay for the Recharge Activity ranking finale.
 *
 * Phases rendered:
 *   warning → live Top-3 with amber fire rings + "finale soon" message
 *   burst   → 2 s gold-dust CSS burst (placeholder; swap for VAP asset once available)
 *   reveal  → server-finalized Top-3 + announcement sound plays
 *
 * Asset note: fire-ring and burst visuals are CSS placeholders. When the
 * designer delivers VAP/SVGA burst assets, replace the .burst-placeholder div
 * with <VapPlayer :name="BURST_VAP_URL" :loop="1" @complete="burstComplete" />.
 *
 * HITL checklist (required before shipping):
 *   [ ] Visual sign-off on fire rings, burst, and reveal layout
 *   [ ] Audio autoplay verified on iOS and Android after gesture prime
 *   [ ] Overlay dismissed state persists correctly across tab re-mounts
 */

import { RECHARGE_ACTIVITY, ASSETS } from '~/constants/assets'
import { formatCurrency } from '~/utils/currency'

const props = defineProps<{
  timeframe: 'weekly' | 'monthly'
}>()

const store = useMissionStore()
const { phase, isOpen, dismiss, burstComplete } = useMissionFinale(props.timeframe)
const sound = useMissionFinaleSound()

// ========================================
// Data derived from store
// ========================================

const liveTop3 = computed(() =>
  store.leaderboardFor(props.timeframe)?.entries.slice(0, 3) ?? [],
)

const finalizedTop3 = computed(() =>
  store.finaleSnapshotFor(props.timeframe)?.entries.slice(0, 3) ?? [],
)

// ========================================
// Phase side-effects
// ========================================

watch(phase, (p) => {
  if (p === 'burst') {
    // Auto-advance to reveal after CSS animation completes.
    // Replace this with VapPlayer @complete once the designer delivers the burst asset.
    setTimeout(burstComplete, 2_000)
  }
  if (p === 'reveal') {
    sound.play(props.timeframe)
  }
})

// ========================================
// Helpers
// ========================================

function rankRingClass(rank: number): string {
  if (rank === 1) return 'ring-yellow-400'
  if (rank === 2) return 'ring-zinc-300'
  return 'ring-amber-600'
}

function rankLabelClass(rank: number): string {
  if (rank === 1) return 'text-yellow-300'
  if (rank === 2) return 'text-zinc-100'
  return 'text-amber-300'
}
</script>

<template>
  <Teleport to="body">
    <Transition name="finale-overlay">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm"
        aria-modal="true"
        role="dialog"
        aria-label="Ranking Finale"
      >
        <!-- Dismiss -->
        <button
          class="absolute top-4 right-4 p-2 text-white/50 hover:text-white transition-colors"
          aria-label="Dismiss finale overlay"
          @click="dismiss"
        >
          <span class="i-lucide-x text-xl" />
        </button>

        <!-- ============================================================
             WARNING: Live Top-3 with amber fire rings
             ============================================================ -->
        <div v-if="phase === 'warning'" class="w-full max-w-xs px-4 text-center space-y-6">
          <div class="space-y-1">
            <p class="text-amber-300 font-extrabold text-xl tracking-widest uppercase">
              Finale In Progress!
            </p>
            <p class="text-white/60 text-sm">
              Rankings are locking in — hold your position!
            </p>
          </div>

          <div class="flex justify-center items-end gap-6">
            <div
              v-for="entry in liveTop3"
              :key="entry.user.id"
              class="flex flex-col items-center gap-1"
            >
              <!-- Fire ring: CSS pulse around avatar -->
              <div class="relative">
                <div class="fire-ring absolute inset-0 rounded-full" />
                <UserAvatar
                  :img="entry.user.avatar ?? ASSETS.AVATAR_PLACEHOLDER"
                  :frame-id="entry.user.frame_id"
                  :user-name="entry.user.name"
                  animated
                  class="relative z-10 rounded-full ring-2"
                  :class="[entry.rank === 1 ? 'w-16' : 'w-12', rankRingClass(entry.rank)]"
                />
                <span
                  class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 text-[10px] font-bold px-1 rounded-full bg-black/70 ring-1 z-20"
                  :class="rankRingClass(entry.rank) + ' ' + rankLabelClass(entry.rank)"
                >
                  {{ entry.rank }}
                </span>
              </div>
              <p class="text-white text-[11px] font-semibold truncate max-w-[64px]">
                {{ entry.user.name }}
              </p>
              <span class="text-[10px]" :class="rankLabelClass(entry.rank)">
                {{ formatCurrency(entry.volume) }}
              </span>
            </div>
          </div>
        </div>

        <!-- ============================================================
             BURST: Gold-dust particle animation (CSS placeholder)
             ============================================================ -->
        <div
          v-else-if="phase === 'burst'"
          class="flex flex-col items-center gap-6"
          aria-hidden="true"
        >
          <div class="burst-container">
            <div class="burst-core" />
            <div v-for="i in 12" :key="i" class="burst-particle" :style="{ '--i': i }" />
          </div>
          <p class="text-amber-300 font-extrabold text-2xl tracking-wide animate-pulse">
            Finalizing Rankings…
          </p>
        </div>

        <!-- ============================================================
             REVEAL: Finalized Top-3 + dismiss CTA
             ============================================================ -->
        <div v-else-if="phase === 'reveal'" class="w-full max-w-xs px-4 text-center space-y-5">
          <img
            :src="RECHARGE_ACTIVITY.topHeader"
            alt="Top Rankings"
            class="mx-auto w-44"
          >

          <div class="flex justify-center items-end gap-5">
            <NuxtLink
              v-for="entry in finalizedTop3"
              :key="entry.user.id"
              :to="entry.user.signature ? `/profile/${entry.user.signature}` : ''"
              class="flex flex-col items-center gap-1"
            >
              <UserAvatar
                :img="entry.user.avatar ?? ASSETS.AVATAR_PLACEHOLDER"
                :frame-id="entry.user.frame_id"
                :user-name="entry.user.name"
                animated
                class="rounded-full ring-2"
                :class="[entry.rank === 1 ? 'w-16' : 'w-12', rankRingClass(entry.rank)]"
              />
              <p class="text-white text-[11px] font-semibold truncate max-w-[64px]">
                {{ entry.user.name }}
              </p>
              <UBadge
                icon="i-lucide-coins"
                variant="outline"
                size="xs"
                class="backdrop-blur font-bold"
                :class="rankLabelClass(entry.rank)"
              >
                {{ formatCurrency(entry.volume) }}
              </UBadge>
            </NuxtLink>
          </div>

          <UButton
            class="bg-amber-400 hover:bg-amber-300 text-black font-bold px-8"
            @click="dismiss"
          >
            Awesome!
          </UButton>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.finale-overlay-enter-active,
.finale-overlay-leave-active {
  transition: opacity 0.4s ease;
}
.finale-overlay-enter-from,
.finale-overlay-leave-to {
  opacity: 0;
}

/* Amber fire ring: pulsing glow around Top-3 avatars in the warning phase.
   Designer replacement target: swap for a VAP/SVGA ring animation. */
.fire-ring {
  background: radial-gradient(circle, transparent 40%, rgba(251, 191, 36, 0.35) 60%, transparent 75%);
  animation: fire-pulse 0.9s ease-in-out infinite alternate;
}

@keyframes fire-pulse {
  from { transform: scale(1);    opacity: 0.7; }
  to   { transform: scale(1.18); opacity: 1;   }
}

/* Gold-dust burst: CSS particle explosion placeholder.
   Designer replacement target: swap .burst-container with a VapPlayer canvas. */
.burst-container {
  position: relative;
  width: 180px;
  height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.burst-core {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: radial-gradient(circle, #fff9c4 0%, #ffd700 50%, #ff8c00 100%);
  animation: core-expand 2s ease-out forwards;
  box-shadow: 0 0 40px 10px rgba(255, 215, 0, 0.6);
}

@keyframes core-expand {
  0%   { transform: scale(0.1); opacity: 1; }
  60%  { transform: scale(1.4); opacity: 0.9; }
  100% { transform: scale(1);   opacity: 0.6; }
}

.burst-particle {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ffd700;
  animation: particle-fly 2s ease-out forwards;
  transform-origin: center;
  --angle: calc(var(--i, 1) * 30deg);
}

@keyframes particle-fly {
  0%   { transform: rotate(var(--angle)) translateX(0)    scale(1);   opacity: 1; }
  70%  { transform: rotate(var(--angle)) translateX(75px) scale(0.8); opacity: 0.9; }
  100% { transform: rotate(var(--angle)) translateX(90px) scale(0.3); opacity: 0; }
}
</style>

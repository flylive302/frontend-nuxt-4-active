<script setup lang="ts">
// ========================================
// Income Target Modal
// ========================================
// Celebratory modal shown when user completes an agency income target tier.
// Uses GPU-friendly animations (transform + opacity only).

const { incomeTargetModalOpen, incomeTargetModalData, closeIncomeTargetModal } = useAchievementModals()

// ========================================
// Computed
// ========================================

/**
 * Style based on view type (member vs owner).
 */
const style = computed(() => {
  if (incomeTargetModalData.value?.isOwnerView) {
    return {
      bgColor: 'bg-emerald-500/20',
      textColor: 'text-emerald-400',
      gradientFrom: 'from-emerald-500',
      gradientTo: 'to-green-300',
      icon: 'i-lucide-crown',
      title: 'Milestone Reached! 🎉',
      subtitle: 'Your team member crossed a tier',
    }
  }
  return {
    bgColor: 'bg-purple-500/20',
    textColor: 'text-purple-400',
    gradientFrom: 'from-purple-500',
    gradientTo: 'to-violet-300',
    icon: 'i-lucide-target',
    title: 'Milestone Reached! 🎯',
    subtitle: 'Congratulations!',
  }
})

/**
 * Tier label, e.g. "Tier 3".
 */
const tierLabel = computed(() =>
  incomeTargetModalData.value ? `Tier ${incomeTargetModalData.value.tier}` : ''
)

/**
 * Format reward with thousands separator.
 */
const formattedReward = computed(() => {
  if (!incomeTargetModalData.value) return '0'
  const reward = incomeTargetModalData.value.isOwnerView 
    ? incomeTargetModalData.value.ownerReward 
    : incomeTargetModalData.value.memberReward
  return new Intl.NumberFormat().format(reward)
})
</script>

<template>
  <UModal
    :open="incomeTargetModalOpen"
    :ui="{
      content: 'bg-transparent shadow-none border-none focus-outline-none ring-0',
      overlay: 'bg-neutral-950/20 backdrop-blur-xs',
    }"
    class="z-90"
    @close="closeIncomeTargetModal"
  >
    <template #content>
      <Transition
        enter-active-class="duration-300 ease-out"
        enter-from-class="opacity-0 scale-90"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-90"
        appear
      >
        <div
          v-if="incomeTargetModalData"
          class="relative mx-auto max-w-sm overflow-hidden rounded-2xl bg-linear-to-b from-neutral-700 to-neutral-950 p-6 text-center shadow-2xl"
          role="dialog"
          aria-labelledby="income-target-modal-title"
          aria-describedby="income-target-modal-description"
        >
          <!-- Animated Background Glow -->
          <div class="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              class="absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 animate-pulse rounded-full blur-xl"
              :class="style.bgColor"
            />
          </div>

          <!-- Target Icon Display -->
          <div class="relative mb-4">
            <div
              class="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-linear-to-br ring-4 ring-white/10"
              :class="[style.gradientFrom, style.gradientTo]"
            >
              <UIcon :name="style.icon" class="h-14 w-14 text-white drop-shadow-lg" />
            </div>

            <!-- Tier Badge -->
            <div class="absolute -left-2 top-0 rounded-full bg-amber-500/80 px-3 py-1 text-xs font-bold text-white">
              T{{ incomeTargetModalData.tier }}
            </div>
          </div>

          <!-- Title -->
          <h2
            id="income-target-modal-title"
            class="mb-1 text-xl font-bold text-white"
          >
            {{ style.title }}
          </h2>

          <!-- Tier -->
          <p
            id="income-target-modal-description"
            class="mb-2 text-lg font-semibold"
            :class="style.textColor"
          >
            {{ tierLabel }}
          </p>

          <!-- Subtitle -->
          <p class="mb-4 text-sm text-neutral-400">
            {{ style.subtitle }}
          </p>

          <!-- Reward Display -->
          <div
            class="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
            :class="[style.bgColor, style.textColor]"
          >
            <UIcon name="i-lucide-gem" class="h-4 w-4" />
            +{{ formattedReward }} 💎 Diamonds
          </div>

          <!-- Close Button -->
          <UButton
            variant="soft"
            color="error"
            class="absolute right-0 top-0"
            aria-label="Close"
            icon="i-heroicons-x-mark"
            @click="closeIncomeTargetModal"
          />
        </div>
      </Transition>
    </template>
  </UModal>
</template>

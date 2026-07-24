<script setup lang="ts">
// ========================================
// Income Target Modal
// ========================================
// Member-view celebration for an agency-milestone tier crossed since the
// device's last visit to /agency/my-income (level-up-celebrations, ticket 05).
// Page-gated: props/emits driven, hosted by the income page via
// useMilestoneDrain — no global queue coupling. The owner-view path was
// dropped with this ticket. Uses GPU-friendly animations (transform/opacity).

import type { MilestoneModalItem } from '~/composables/progression/useMilestoneDrain'

// ========================================
// Props / Emits
// ========================================

const props = defineProps<{
  open: boolean
  modal: MilestoneModalItem | null
}>()

const emit = defineEmits<{
  close: []
}>()

// ========================================
// Computed
// ========================================

const tierLabel = computed(() => (props.modal ? `Tier ${props.modal.tier}` : ''))

const formattedReward = computed(() =>
  props.modal ? new Intl.NumberFormat().format(props.modal.memberReward) : '0',
)

// ========================================
// Handlers
// ========================================

function handleClose(): void {
  emit('close')
}
</script>

<template>
  <UModal
    :open="open"
    :ui="{
      content: 'bg-transparent shadow-none border-none focus-outline-none ring-0',
      overlay: 'bg-neutral-950/20 backdrop-blur-xs',
    }"
    class="z-90"
    @close="handleClose"
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
          v-if="modal"
          class="relative mx-auto max-w-sm overflow-hidden rounded-2xl bg-linear-to-b from-neutral-700 to-neutral-950 p-6 text-center shadow-2xl"
          role="dialog"
          aria-labelledby="income-target-modal-title"
          aria-describedby="income-target-modal-description"
        >
          <!-- Animated Background Glow -->
          <div class="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              class="absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 animate-pulse rounded-full blur-xl bg-purple-500/20"
            />
          </div>

          <!-- Target Icon Display -->
          <div class="relative mb-4">
            <div
              class="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-linear-to-br from-purple-500 to-violet-300 ring-4 ring-white/10"
            >
              <UIcon name="i-lucide-target" class="h-14 w-14 text-white drop-shadow-lg" />
            </div>

            <!-- Tier Badge -->
            <div class="absolute -left-2 top-0 rounded-full bg-amber-500/80 px-3 py-1 text-xs font-bold text-white">
              T{{ modal.tier }}
            </div>
          </div>

          <!-- Title -->
          <h2
            id="income-target-modal-title"
            class="mb-1 text-xl font-bold text-white"
          >
            {{ modal.kind === 'summary' ? 'Milestones Reached! 🎯' : 'Milestone Reached! 🎯' }}
          </h2>

          <!-- Tier -->
          <p
            id="income-target-modal-description"
            class="mb-2 text-lg font-semibold text-purple-400"
          >
            {{ tierLabel }}
          </p>

          <!-- Subtitle -->
          <p class="mb-4 text-sm text-neutral-400">
            <template v-if="modal.kind === 'summary'">
              You crossed <span class="font-medium text-white">{{ modal.crossedCount }}</span> tiers
            </template>
            <template v-else>
              Congratulations!
            </template>
          </p>

          <!-- Reward Display -->
          <div
            class="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium bg-purple-500/20 text-purple-400"
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
            @click="handleClose"
          />
        </div>
      </Transition>
    </template>
  </UModal>
</template>

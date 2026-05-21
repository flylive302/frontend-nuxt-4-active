<script setup lang="ts">
import { useLuckyOdds, type OddsTier } from '~/composables/lucky/useLuckyOdds'

const SESSION_KEY = 'lucky_odds_acknowledged'

const { fetchOdds: fetchOddsTiers } = useLuckyOdds()

const emit = defineEmits<{
  acknowledged: []
  dismissed: []
}>()

const isOpen = ref(false)
const tiers = ref<OddsTier[]>([])
const isLoading = ref(false)
const understood = ref(false)

async function fetchOdds(): Promise<void> {
  isLoading.value = true
  tiers.value = await fetchOddsTiers()
  isLoading.value = false
}

/**
 * Call this before the first lucky gift send in a session.
 * Returns true if the modal was opened, false if already acknowledged (event fired immediately).
 */
async function show(): Promise<boolean> {
  if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(SESSION_KEY) === '1') {
    emit('acknowledged')
    return false
  }
  await fetchOdds()
  understood.value = false
  isOpen.value = true
  return true
}

function handleConfirm(): void {
  if (!understood.value) return
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(SESSION_KEY, '1')
  }
  isOpen.value = false
  emit('acknowledged')
}

function handleDismiss(): void {
  isOpen.value = false
  emit('dismissed')
}

defineExpose({ show })
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :dismissible="false"
    title="Lucky Draw — Prize Odds"
    :ui="{
      content: 'bg-neutral-900 border border-white/10',
    }"
  >
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-neutral-400 leading-relaxed">
          Lucky Draw prizes are determined randomly from the tiers below. Spending virtual coins does not guarantee any particular outcome.
          <span class="text-white font-medium">No real-world currency or prizes are involved.</span>
        </p>

        <div v-if="isLoading" class="py-4 flex justify-center">
          <UIcon name="i-lucide-loader-circle" class="size-5 text-neutral-400 animate-spin" />
        </div>

        <table v-else class="w-full text-sm">
          <thead>
            <tr class="border-b border-white/10 text-left">
              <th class="pb-2 text-neutral-400 font-medium">Prize</th>
              <th class="pb-2 text-neutral-400 font-medium text-right">Multiplier</th>
              <th class="pb-2 text-neutral-400 font-medium text-right">Probability</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="tier in tiers"
              :key="tier.name"
              class="border-b border-white/5 last:border-0"
            >
              <td class="py-2 text-white">{{ tier.name }}</td>
              <td class="py-2 text-primary text-right font-mono">{{ tier.multiplier }}×</td>
              <td class="py-2 text-neutral-300 text-right font-mono">{{ tier.probability }}%</td>
            </tr>
          </tbody>
        </table>

        <UCheckbox
          v-model="understood"
          label="I understand that Lucky Draw prizes are virtual and have no real-world monetary value."
          :ui="{ label: 'text-sm text-neutral-300' }"
        />
      </div>
    </template>

    <template #footer>
      <div class="flex gap-3 w-full">
        <UButton
          variant="ghost"
          color="neutral"
          class="flex-1"
          @click="handleDismiss"
        >
          Not Now
        </UButton>
        <UButton
          color="primary"
          class="flex-1"
          :disabled="!understood || isLoading"
          @click="handleConfirm"
        >
          Continue
        </UButton>
      </div>
    </template>
  </UModal>
</template>

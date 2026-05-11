<!-- ~/components/from-conversion-request.vue -->
<!-- Coin Request Form - Creates coin grant requests using the user's default reviewer -->
<script setup lang="ts">
import { onBeforeUnmount, ref, toRef } from 'vue'
import type { Colors } from '~/types/colors'
import type { CoinRequest } from '~/types/economy/coin-request'
import { useCoinRequests } from '~/composables/economy/useCoinRequests'
import { useColorClasses } from '~/composables/shared/useColorClasses'

// ========================================
// Props & Emits
// ========================================
const props = withDefaults(defineProps<{
  color?: Colors
  disabled?: boolean
}>(), {
  color: 'tertiary',
  disabled: false
})

const color = toRef(props, 'color')
const { gradientClass } = useColorClasses(color)

const emit = defineEmits<{
  (e: 'success', request: CoinRequest): void
  (e: 'error', payload: { message: string; details?: unknown }): void
}>()

// ========================================
// Constants & State
// ========================================
const AMOUNTS = [3_000, 10_000, 50_000, 100_000, 250_000, 500_000] as const

const selectedAmount = ref<number>(3_000)
const lastClaimedAmount = ref<number>(3_000)
const showSuccess = ref(false)
const formError = ref('')
const isSubmitting = ref(false)
let abortController: AbortController | null = null

// ========================================
// Composables
// ========================================
const { createRequest, normalizeError } = useCoinRequests()
const toast = useToast()

// ========================================
// Handlers
// ========================================
async function onClaim() {
  if (props.disabled || isSubmitting.value) return

  formError.value = ''
  isSubmitting.value = true
  abortController = new AbortController()

  try {
    const response = await createRequest({ amount: selectedAmount.value })

    if (response.status === 'success' && response.data) {
      lastClaimedAmount.value = selectedAmount.value
      toast.add({
        title: 'Coins claimed!',
        description: `${selectedAmount.value.toLocaleString()} coins added to your account`,
        color: 'success'
      })
      showSuccess.value = true
      emit('success', response.data)
    }
  } catch (error: unknown) {
    const normalized = normalizeError(error)
    formError.value = normalized.message
    toast.add({ title: 'Error', description: normalized.message, color: 'error' })
    emit('error', { message: normalized.message, details: normalized })
  } finally {
    isSubmitting.value = false
    abortController = null
  }
}

function claimAnother() {
  showSuccess.value = false
  formError.value = ''
}

onBeforeUnmount(() => {
  abortController?.abort()
})
</script>

<template>
  <div>
    <UAlert
      v-if="formError"
      icon="i-lucide-alert-triangle"
      color="error"
      variant="subtle"
      :description="formError"
      class="mb-4"
      aria-live="assertive"
    />

    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="!showSuccess"
        class="relative overflow-hidden rounded-2xl p-6 space-y-4"
        :class="[gradientClass]"
      >
        <span class="shimmer pointer-events-none absolute inset-0" aria-hidden="true" />

        <!-- Amount grid -->
        <div class="relative grid grid-cols-2 sm:grid-cols-3 gap-3">
          <button
            v-for="amount in AMOUNTS"
            :key="amount"
            class="amount-card relative rounded-xl px-3 py-4 text-white text-center transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            :class="selectedAmount === amount
              ? 'bg-white/30 ring-2 ring-white shadow-lg scale-[1.04]'
              : 'bg-white/10 ring-1 ring-white/20 opacity-60 hover:opacity-90 hover:bg-white/20 hover:scale-[1.02]'"
            :disabled="isSubmitting"
            @click="selectedAmount = amount"
          >
            <UIcon
              name="i-lucide-coins"
              class="h-5 w-5 mx-auto mb-1.5 opacity-80"
              :class="{ 'coin-float': selectedAmount === amount }"
            />
            <div class="text-xl font-black tabular-nums leading-tight">
              {{ amount.toLocaleString() }}
            </div>
            <div class="text-xs font-medium opacity-70 mt-0.5 tracking-widest uppercase">
              Coins
            </div>
            <div
              v-if="selectedAmount === amount"
              class="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-white flex items-center justify-center shadow"
            >
              <UIcon name="i-lucide-check" class="h-2.5 w-2.5 text-black" />
            </div>
          </button>
        </div>

        <!-- Claim button -->
        <button
          class="claim-btn group relative w-full overflow-hidden rounded-xl py-4 px-6 text-white text-center cursor-pointer select-none transition-all duration-300 bg-white/20 hover:bg-white/30 ring-1 ring-white/30 backdrop-blur-sm hover:scale-[1.01] hover:shadow-xl active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100"
          :disabled="disabled || isSubmitting"
          @click="onClaim"
        >
          <div class="relative flex items-center justify-center gap-3">
            <UIcon
              :name="isSubmitting ? 'i-lucide-loader-2' : 'i-lucide-zap'"
              class="h-5 w-5 shrink-0"
              :class="{ 'animate-spin': isSubmitting }"
            />
            <span class="text-lg font-bold tracking-tight">
              {{ isSubmitting ? 'Claiming…' : `Claim ${selectedAmount.toLocaleString()} Coins` }}
            </span>
          </div>
        </button>
      </div>
    </Transition>

    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-1"
    >
      <div
        v-if="showSuccess"
        class="rounded-2xl border-2 border-success/30 bg-success/5 p-8 text-center"
      >
        <div class="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-success/20">
          <UIcon name="i-lucide-badge-check" class="h-7 w-7 text-success" />
        </div>
        <p class="text-lg font-semibold">{{ lastClaimedAmount.toLocaleString() }} coins claimed!</p>
        <p class="mt-1 text-sm text-gray-500">
          Your coins have been added to your account.
        </p>
        <UButton class="mt-5" :color="color" @click="claimAnother">
          Claim again
        </UButton>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.shimmer {
  background: linear-gradient(
    105deg,
    transparent 40%,
    rgba(255, 255, 255, 0.15) 50%,
    transparent 60%
  );
  background-size: 200% 100%;
  animation: shimmer 2.5s ease-in-out infinite;
}

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.coin-float {
  animation: coin-float 3s ease-in-out infinite;
}

@keyframes coin-float {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  50%       { transform: translateY(-4px) rotate(4deg); }
}
</style>

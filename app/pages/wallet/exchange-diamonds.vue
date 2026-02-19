<script setup lang="ts">
// ========================================
// Imports & Types
// ========================================

import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { ref, reactive, computed, onMounted } from 'vue'
import type { ExchangeInfo, ExchangeResult } from '~/types/economy/exchange'
import { formatCurrency } from '~/utils/currency'

// ========================================
// Page Configuration
// ========================================

definePageMeta({
  layout: 'alt',
  middleware: 'auth',
})

// ========================================
// Composables / Injected Dependencies
// ========================================

const authStore = useAuthStore()
const agencyStore = useAgencyStore()
const { api, normalizeError } = useApi()
const toast = useToast()
const { fetchUserAgency } = useAgencyMembership()

// ========================================
// Access Control
// ========================================

onMounted(async () => {
  // Ensure agency context is loaded
  if (!agencyStore.isAgencyMember) {
    await fetchUserAgency()
  }
  
  // Redirect non-agency members
  if (!agencyStore.isAgencyMember) {
    toast.add({
      title: 'Access Denied',
      description: 'Only agency members can exchange diamonds for coins.',
      color: 'error',
    })
    await navigateTo('/profile')
    return
  }
  
  // Fetch exchange info (balance updates via socket 'balance.updated')
  await fetchExchangeInfo()
})

// ========================================
// Schema & Form State
// ========================================

const schema = z.object({
  diamonds: z.coerce
    .number({ message: 'Invalid amount' })
    .int('Must be a whole number')
    .positive('Must be at least 1'),
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  diamonds: undefined,
})

// ========================================
// State
// ========================================

const exchangeInfo = ref<ExchangeInfo | null>(null)
const isLoading = ref(true)
const isSubmitting = ref(false)

// ========================================
// Computed
// ========================================

/**
 * Check if user is an agency member (for conditional rendering).
 */
const isAgencyMember = computed(() => agencyStore.isAgencyMember)

/**
 * User's current diamond balance from exchange info or auth store.
 */
const userDiamonds = computed((): number => {
  if (exchangeInfo.value) return exchangeInfo.value.user_diamonds_balance
  const diamonds = authStore.user?.diamonds
  return typeof diamonds === 'string' ? parseFloat(diamonds) : (diamonds ?? 0)
})

/**
 * User's current coin balance from exchange info or auth store.
 */
const userCoins = computed((): number => {
  if (exchangeInfo.value) {
    return parseFloat(exchangeInfo.value.user_coins_balance)
  }
  const coins = authStore.user?.coins
  return typeof coins === 'string' ? parseFloat(coins) : (coins ?? 0)
})

/**
 * Exchange rate: coins received per diamond.
 */
const exchangeRate = computed(() => 
  exchangeInfo.value?.coins_per_diamond ?? 1750
)

/**
 * Preview calculation showing balance changes after exchange.
 */
const preview = computed(() => {
  if (!state.diamonds || state.diamonds < 1) return null
  if (state.diamonds > userDiamonds.value) return null
  
  const coinsToReceive = state.diamonds * exchangeRate.value
  
  return {
    diamondsAfter: userDiamonds.value - state.diamonds,
    coinsAfter: userCoins.value + coinsToReceive,
    coinsToReceive,
  }
})

/**
 * Whether exchange can be submitted.
 */
const canExchange = computed(() => {
  if (!exchangeInfo.value?.is_enabled) return false
  if (!state.diamonds || state.diamonds < 1) return false
  if (state.diamonds > userDiamonds.value) return false
  return true
})

// ========================================
// Actions
// ========================================

/**
 * Fetch exchange info from API.
 */
async function fetchExchangeInfo(): Promise<void> {
  isLoading.value = true
  
  try {
    const response = await api<{
      success: true
      data: ExchangeInfo
    }>('/user/exchange')
    
    exchangeInfo.value = response.data
  } catch (err) {
    const normalized = normalizeError(err)
    toast.add({
      title: 'Failed to load exchange info',
      description: normalized.message,
      color: 'error',
    })
  } finally {
    isLoading.value = false
  }
}

/**
 * Submit exchange request.
 */
async function onSubmit(_e: FormSubmitEvent<Schema>): Promise<void> {
  if (!canExchange.value || isSubmitting.value) return
  
  isSubmitting.value = true
  
  try {
    const response = await api<{
      success: true
      data: ExchangeResult
      message: string
    }>('/user/exchange', {
      method: 'POST',
      body: { diamond_amount: state.diamonds },
    })
    
    // Update local exchange info with new balances
    if (exchangeInfo.value) {
      exchangeInfo.value.user_coins_balance = response.data.new_coin_balance
      exchangeInfo.value.user_diamonds_balance = response.data.new_diamond_balance
    }
    
    // Clear form
    state.diamonds = undefined
    
    toast.add({
      title: 'Exchange Successful',
      description: `Received ${response.data.coins_received.toLocaleString()} coins`,
      color: 'success',
      icon: 'i-lucide-coins',
    })
  } catch (err) {
    const normalized = normalizeError(err)
    toast.add({
      title: 'Exchange Failed',
      description: normalized.message,
      color: 'error',
    })
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <main>
    <NavAlt 
      color="secondary" 
      back-to="/profile" 
      :linked="true" 
      first-link="/wallet/purchase-coins" 
      second-link="/wallet/exchange-diamonds"
    >
      <template #first-link-text>Coins</template>
      <template #second-link-text>Diamonds</template>
    </NavAlt>
    
    <AltHero class="z-10" image-src="https://ik.imagekit.io/flylive/siteAssets/alt-hero/secondary.webp">
      <div class="flex p-2 bg-linear-to-br to-secondary/40">
        <div class="flex flex-col justify-end items-center">
          <NuxtImg 
            src="https://ik.imagekit.io/flylive/siteAssets/props/prop-diamond.svg" 
            format="webp" 
            class="w-14" 
          />
        </div>
        <div class="flex-auto flex flex-col justify-between items-center">
          <NuxtImg 
            src="https://ik.imagekit.io/flylive/siteAssets/props/flylive-diamond.webp" 
            class="w-full mb-2 max-w-28" 
          />
          <UButton 
            to="/wallet/transaction-history" 
            color="secondary" 
            icon="i-lucide-gem" 
            trailing-icon="i-lucide-history"
          >
            {{ formatCurrency(userDiamonds) }}
          </UButton>
        </div>
        <div class="flex flex-col justify-end">
          <NuxtImg 
            src="https://ik.imagekit.io/flylive/siteAssets/props/prop-diamond.svg" 
            format="webp" 
            class="transform -scale-x-100 w-14" 
          />
        </div>
      </div>
    </AltHero>
    
    <div class="h-10" />

    <!-- Access Denied State -->
    <section v-if="!isAgencyMember && !isLoading" class="px-3 py-14 text-center">
      <UIcon name="i-lucide-lock" class="size-16 text-muted mb-4" />
      <h2 class="text-lg font-semibold mb-2">Agency Members Only</h2>
      <p class="text-sm text-muted mb-4">
        You need to be a member of an agency to exchange diamonds for coins.
      </p>
      <UButton to="/agency/list" color="primary">
        Browse Agencies
      </UButton>
    </section>

    <!-- Exchange Section (Agency Members Only) -->
    <section v-else class="px-3">
      <h2 class="text-lg font-bold leading-tight">
        Exchange Your Diamonds with <span class="text-tertiary">FlyLive Coins</span>
      </h2>
      <p class="text-sm text-success">
        Exchange Rate: 1 Diamond = {{ exchangeRate.toLocaleString() }} Coins
      </p>

      <!-- Exchange Disabled Alert -->
      <UAlert
        v-if="exchangeInfo?.is_enabled === false"
        color="warning"
        variant="subtle"
        icon="i-lucide-alert-triangle"
        title="Exchange Unavailable"
        description="Diamond to coin exchange is currently disabled."
        class="mt-3"
      />

      <!-- Exchange Form -->
      <UForm 
        v-else
        :schema="schema" 
        :state="state" 
        class="space-y-3 mt-3" 
        @submit="onSubmit"
      >
        <UFormField label="Enter Number of Diamonds" name="diamonds" class="w-full" required>
          <template #description>
            <span class="text-xs text-muted">
              Available: {{ userDiamonds.toLocaleString() }} diamonds
            </span>
          </template>
          <UInputNumber 
            v-model="state.diamonds" 
            :min="1"
            :max="userDiamonds"
            placeholder="Enter amount" 
            color="secondary" 
            class="w-full"
          />
        </UFormField>

        <!-- Preview Section -->
        <template v-if="preview">
          <p class="font-semibold text-base leading-none">Change in Balances after Exchange:</p>
          <div class="flex items-center gap-2 bg-linear-to-br from-neutral-950 to-primary-950 px-2 py-1 inset-shadow-sm ring ring-primary/50 rounded-md">
            <div class="flex items-center gap-1 w-full">
              <NuxtImg src="https://ik.imagekit.io/flylive/siteAssets/props/flylive-diamond.webp" class="w-8" />
              <p class="text-base font-semibold leading-none">
                Diamonds: <br> 
                <span class="text-secondary-400 font-bold text-base">
                  {{ preview.diamondsAfter.toLocaleString() }}
                </span>
              </p>
            </div>

            <USeparator color="primary" orientation="vertical" class="h-8" />

            <div class="flex items-center gap-1 w-full">
              <NuxtImg src="https://ik.imagekit.io/flylive/siteAssets/props/flylive_coin.webp" class="w-8" />
              <p class="text-base font-semibold leading-none">
                Coins: <br>
                <span class="text-success font-semibold text-base ml-1">
                  (+{{ preview.coinsToReceive.toLocaleString() }})
                </span>
                <span class="text-tertiary text-xs">
                  {{ preview.coinsAfter.toLocaleString() }}
                </span>
              </p>
            </div>
          </div>
        </template>

        <!-- Insufficient Diamonds Warning -->
        <UAlert
          v-else-if="state.diamonds && state.diamonds > userDiamonds"
          color="error"
          variant="subtle"
          icon="i-lucide-alert-circle"
          title="Insufficient Diamonds"
          :description="`You only have ${userDiamonds.toLocaleString()} diamonds available.`"
        />

        <UButton 
          size="lg" 
          class="w-full justify-center mt-2" 
          icon="i-lucide-repeat" 
          color="secondary" 
          type="submit"
          :loading="isSubmitting"
          :disabled="!canExchange"
        >
          Exchange
        </UButton>
      </UForm>

      <USeparator color="secondary" class="my-4" label="OR" />

      <h2 class="text-lg font-bold leading-tight">
        Request Payout of your Diamonds in <span class="text-success">Real Money</span>.
      </h2>
      <EconomyChooseDefaultReseller color="secondary" />
      <EconomyFromConversionRequest color="secondary" class="mb-18 mt-4" />
    </section>
  </main>
</template>
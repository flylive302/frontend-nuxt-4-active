<script setup lang="ts">
// ========================================
// Imports & Types
// ========================================

import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { onMounted, computed, reactive, ref } from 'vue'
import type { ExchangeInfo, ExchangeResult } from '~/types/exchange'

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

const incomeStore = useIncomeStore()
const authStore = useAuthStore()
const agencyStore = useAgencyStore()
const { api, normalizeError } = useApi()
const toast = useToast()

// ========================================
// Exchange Schema
// ========================================

const exchangeSchema = z.object({
  coins: z.coerce
    .number({ message: 'Invalid amount' })
    .int('Must be a whole number')
    .positive('Must be greater than 0'),
})

type ExchangeSchema = z.output<typeof exchangeSchema>

const exchangeState = reactive<Partial<ExchangeSchema>>({
  coins: undefined,
})

// ========================================
// State
// ========================================

const exchangeInfo = ref<ExchangeInfo | null>(null)
const exchangeLoading = ref(false)
const exchangeSubmitting = ref(false)

// ========================================
// Computed
// ========================================

const isAgencyMember = computed(() => agencyStore.isAgencyMember)

const userCoins = computed((): number => {
  if (exchangeInfo.value) return exchangeInfo.value.user_coins_balance
  const coins = authStore.user?.coins
  return typeof coins === 'string' ? parseFloat(coins) : (coins ?? 0)
})

const userDiamonds = computed((): number => {
  if (exchangeInfo.value) return exchangeInfo.value.user_diamonds_balance
  const diamonds = authStore.user?.diamonds
  return typeof diamonds === 'string' ? parseFloat(diamonds) : (diamonds ?? 0)
})

const exchangeRate = computed(() => 
  exchangeInfo.value?.coins_per_diamond ?? 1750
)

const minExchange = computed(() => 
  exchangeInfo.value?.min_exchange_amount ?? 1750
)

const previewResult = computed(() => {
  if (!exchangeState.coins || exchangeState.coins < minExchange.value) return null
  
  const coinsToUse = Math.floor(exchangeState.coins / exchangeRate.value) * exchangeRate.value
  const diamonds = Math.floor(exchangeState.coins / exchangeRate.value)
  
  return {
    coinsAfter: userCoins.value - coinsToUse,
    diamondsAfter: userDiamonds.value + diamonds,
    diamondsToReceive: diamonds,
    coinsToDeduct: coinsToUse,
  }
})

const canExchange = computed(() => {
  if (!exchangeInfo.value?.is_enabled) return false
  if (!exchangeState.coins || exchangeState.coins < minExchange.value) return false
  if (exchangeState.coins > userCoins.value) return false
  return true
})

// ========================================
// Actions
// ========================================

async function fetchExchangeInfo(): Promise<void> {
  exchangeLoading.value = true
  
  try {
    const response = await api<{
      status: string
      data: ExchangeInfo
    }>('/user/exchange')
    
    exchangeInfo.value = response.data
  } catch (err) {
    console.error('[MyIncome] fetchExchangeInfo failed:', err)
  } finally {
    exchangeLoading.value = false
  }
}

async function onExchangeSubmit(_e: FormSubmitEvent<ExchangeSchema>): Promise<void> {
  if (!canExchange.value || exchangeSubmitting.value) return
  
  exchangeSubmitting.value = true
  
  try {
    const response = await api<{
      status: string
      data: ExchangeResult
      message: string
    }>('/user/exchange', {
      method: 'POST',
      body: { coin_amount: exchangeState.coins },
    })
    
    // Update local exchange info
    if (exchangeInfo.value) {
      exchangeInfo.value.user_coins_balance = parseFloat(response.data.new_coin_balance)
      exchangeInfo.value.user_diamonds_balance = response.data.new_diamond_balance
    }
    
    // Clear form
    exchangeState.coins = undefined
    
    toast.add({
      title: 'Exchange Successful',
      description: `Received ${response.data.diamonds_received} diamonds`,
      color: 'success',
      icon: 'i-lucide-gem',
    })
  } catch (err) {
    const normalized = normalizeError(err)
    toast.add({
      title: 'Exchange Failed',
      description: normalized.message,
      color: 'error',
    })
  } finally {
    exchangeSubmitting.value = false
  }
}

// ========================================
// Lifecycle
// ========================================

onMounted(async () => {
  // Check if user is agency member
  if (!agencyStore.isAgencyMember) {
    await agencyStore.fetchUserAgency()
  }
  
  // Fetch income data and exchange info in parallel
  await Promise.all([
    incomeStore.fetchAll(),
    fetchExchangeInfo(),
  ])
})
</script>

<template>
  <main>
    <NavAlt color="tertiary" back-to="/agency/my-agency">My Income</NavAlt>
    
    <!-- Not Agency Member -->
    <div v-if="!isAgencyMember" class="px-3 py-14 text-center">
      <icon name="i-lucide-building-2" class="size-16 text-muted mb-4" />
      <h2 class="text-lg font-semibold mb-2">Agency Members Only</h2>
      <p class="text-sm text-muted mb-4">
        You need to be a member of an agency to view your income.
      </p>
      <UButton to="/agency/list" color="primary">
        Browse Agencies
      </UButton>
    </div>
    
    <!-- Income Dashboard -->
    <div v-else class="px-3 py-14 space-y-6">
      <!-- Total Coins Section -->
      <section>
        <SectionTitle type="tertiary">Total Coins Available</SectionTitle>
        
        <div class="flex items-center border border-tertiary rounded-lg p-2 bg-tertiary/20 mt-2">
          <NuxtImg 
            provider="imagekit" 
            src="/siteAssets/props/flylive_coin.webp" 
            class="w-14" 
            alt="Coins"
          />
          <h2 v-if="exchangeLoading" class="text-4xl font-bold leading-none text-center w-full animate-pulse">
            --
          </h2>
          <h2 v-else class="text-4xl font-bold leading-none text-center w-full">
            {{ Math.floor(Number(userCoins)).toLocaleString() }}
          </h2>
        </div>
        
        <h2 class="text-lg font-bold mt-2">
          Convert Your Coins into Diamonds to later Withdraw as 
          <span class="text-success">Cash.</span>
        </h2>
        <p class="text-success text-sm font-semibold">
          Exchange Rate: 1 Diamond = {{ exchangeRate.toLocaleString() }} Coins
        </p>
      </section>
      
      <!-- Exchange Form -->
      <section v-if="exchangeInfo?.is_enabled !== false">
        <UForm 
          :schema="exchangeSchema" 
          :state="exchangeState" 
          class="space-y-3" 
          @submit="onExchangeSubmit"
        >
          <UFormField label="Enter Number of Coins" name="coins" required>
            <template #description>
              <span class="text-xs text-muted">
                Minimum: {{ minExchange.toLocaleString() }} coins
              </span>
            </template>
            <UInputNumber 
              v-model="exchangeState.coins" 
              :min="minExchange"
              :max="Number(userCoins)"
              :step="exchangeRate"
              placeholder="Enter amount" 
              color="tertiary" 
              class="w-full"
            />
          </UFormField>
          
          <!-- Preview -->
          <div v-if="previewResult" class="space-y-2">
            <p class="font-semibold text-sm">Change in Balances after Exchange:</p>
            <div class="flex items-center gap-2 bg-linear-to-br to-primary/30 px-3 py-2 border border-primary rounded-md">
              <div class="flex items-center gap-2 w-full">
                <NuxtImg 
                  provider="imagekit" 
                  src="/siteAssets/props/flylive_coin.webp" 
                  class="w-8"
                  alt="Coins"
                />
                <div class="text-sm font-semibold leading-tight">
                  <p class="text-muted">Coins:</p>
                  <p class="text-tertiary font-bold">
                    {{ Math.floor(previewResult.coinsAfter).toLocaleString() }}
                  </p>
                </div>
              </div>
              
              <USeparator color="primary" orientation="vertical" class="h-10" />
              
              <div class="flex items-center gap-2 w-full">
                <NuxtImg 
                  provider="imagekit" 
                  src="/siteAssets/props/flylive-diamond.webp" 
                  class="w-8"
                  alt="Diamonds" 
                />
                <div class="text-sm font-semibold leading-tight">
                  <p class="text-muted">Diamonds:</p>
                  <p class="text-secondary-400 font-bold">
                    {{ previewResult.diamondsAfter.toLocaleString() }}
                    <span class="text-success text-xs">(+{{ previewResult.diamondsToReceive }})</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <UButton
            type="submit"
            size="lg" 
            class="w-full justify-center" 
            icon="i-lucide-repeat" 
            color="tertiary"
            :loading="exchangeSubmitting"
            :disabled="!canExchange"
          >
            Convert to Diamonds
          </UButton>
        </UForm>
      </section>
      
      <!-- Exchange Disabled -->
      <UAlert
        v-else-if="exchangeInfo?.is_enabled === false"
        color="warning"
        variant="subtle"
        icon="i-lucide-alert-triangle"
        title="Exchange Unavailable"
        description="Coin to diamond exchange is currently disabled."
      />
      
      <USeparator color="neutral" class="my-4" />
      
      <!-- Active Income Target -->
      <section v-if="incomeStore.hasActiveTarget">
        <SectionTitle type="tertiary">Current Income Target</SectionTitle>
        <AgencyIncomeTargetProgress class="mt-2" />
      </section>
      
      <!-- No Active Target -->
      <div 
        v-else-if="!incomeStore.isTargetLoading" 
        class="text-center py-6 bg-elevated rounded-lg"
      >
        <icon name="i-lucide-target" class="size-10 text-muted mb-2" />
        <p class="text-sm text-muted">No active income target</p>
      </div>
      
      <!-- Recent Earnings -->
      <section v-if="incomeStore.recentEarnings.length > 0">
        <SectionTitle type="tertiary">Recent Earnings</SectionTitle>
        <AgencyRecentEarnings class="mt-2" />
      </section>
      
      <!-- Loading States -->
      <div v-if="incomeStore.isLoading || incomeStore.isTargetLoading" class="space-y-4">
        <div class="animate-pulse space-y-2">
          <div class="h-20 bg-muted rounded-lg" />
          <div class="h-4 bg-muted rounded w-3/4" />
          <div class="h-4 bg-muted rounded w-1/2" />
        </div>
      </div>
      
      <!-- Error State -->
      <UAlert
        v-if="incomeStore.error"
        color="error"
        variant="subtle"
        icon="i-lucide-alert-circle"
        :title="incomeStore.error"
      />
    </div>
  </main>
</template>

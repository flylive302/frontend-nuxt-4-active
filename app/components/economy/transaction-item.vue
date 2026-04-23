<!-- ~/components/transaction-item.vue -->
<!-- Displays a single transaction with minimal view + expandable details -->
<script setup lang="ts">
import type { Transaction, BalanceSnapshot } from '~/types/economy/wallet'
import { TRANSACTION_TYPE_LABELS } from '~/constants/economy/transactionConstants'
import { isPositiveTransaction, getOtherPartyDisplay } from '~/utils/economy/transactionHelpers'
import { formatCurrency } from '~/utils/currency'

// ========================================
// Props
// ========================================

defineOptions({ name: 'TransactionItem' })

const props = defineProps<{
  transaction: Transaction
}>()

// ========================================
// State
// ========================================

const isExpanded = ref(false)

// ========================================
// Computed - Display Values
// ========================================

/**
 * Get formatted time from timestamp.
 */
const formattedTime = computed(() => {
  const date = new Date(props.transaction.timestamp)
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
})

/**
 * Get display title for transaction.
 */
const displayTitle = computed(() => 
  props.transaction.title || TRANSACTION_TYPE_LABELS[props.transaction.type] || 'Transaction'
)

/**
 * Get the other party display name.
 */
const otherPartyName = computed(() => getOtherPartyDisplay(props.transaction))

/**
 * Get change color based on amount value.
 */
const changeColor = computed(() => 
  isPositiveTransaction(props.transaction) ? 'success' : 'error'
)

/**
 * Get background gradient based on transaction direction.
 */
const backgroundClass = computed(() => 
  isPositiveTransaction(props.transaction) ? 'to-success-950' : 'to-error-950'
)

/**
 * Get thumbnail URL with fallback.
 */
const thumbnailUrl = computed(() => 
  props.transaction.thumbnail_url ?? 'https://assets.flyliveapp.com/badges/charm/level_0.webp'
)

/**
 * Get direction label based on a role.
 */
const directionLabel = computed(() => 
  props.transaction.my_role === 'initiator' ? 'To' : 'From'
)

/**
 * Check if we have any expandable details.
 */
const hasDetails = computed(() => 
  props.transaction.my_balance !== null || props.transaction.my_xp !== null
)

// ========================================
// Computed - Expandable Details
// ========================================

interface DetailItem {
  label: string
  before: string
  after: string
  change: string
}

/**
 * Build detail items for balance/XP changes.
 */
const detailItems = computed<DetailItem[]>(() => {
  const items: DetailItem[] = []
  const balance = props.transaction.my_balance
  const xp = props.transaction.my_xp

  // Coins
  if (balance?.coins) {
    items.push(formatDetailItem('Coins', balance.coins))
  }

  // Diamonds
  if (balance?.diamonds) {
    items.push(formatDetailItem('Diamonds', balance.diamonds))
  }

  // Wealth XP
  if (xp?.wealth) {
    items.push(formatDetailItem('Wealth XP', xp.wealth))
  }

  // Charm XP
  if (xp?.charm) {
    items.push(formatDetailItem('Charm XP', xp.charm))
  }

  return items
})

/**
 * Format a balance snapshot into a detail item.
 */
function formatDetailItem(label: string, snapshot: BalanceSnapshot): DetailItem {
  const change = snapshot.after - snapshot.before
  const changeStr = change >= 0 ? `+${formatCurrency(String(change))}` : formatCurrency(String(change))
  
  return {
    label,
    before: formatCurrency(String(snapshot.before)),
    after: formatCurrency(String(snapshot.after)),
    change: changeStr,
  }
}

/**
 * Toggle expanded state.
 */
function toggleExpand() {
  if (hasDetails.value) {
    isExpanded.value = !isExpanded.value
  }
}
</script>

<template>
  <div
    class="overflow-hidden cursor-pointer transition-all duration-200"
    @click="toggleExpand"
  >
    <!-- Main Row (Always Visible) -->
    <div
      class="grid grid-cols-14 gap-2 p-2 bg-linear-to-br from-neutral-950 shadow-xl shadow-neutral"
      :class="backgroundClass"
    >
      <!-- Thumbnail -->
      <div class="rounded-full bg-elevated border inset-shadow-sm col-span-2 overflow-hidden aspect-square">
        <NuxtImg
          class="h-full mx-auto rounded"
          :src="thumbnailUrl"
          :alt="displayTitle"
        />
      </div>

      <!-- Main Info -->
      <div class="col-span-9 flex flex-col justify-center">
        <p v-if="transaction.description" class="text-sm font-bold leading-tight truncate">
          {{ transaction.description }}
        </p>
        <p v-else class="text-sm font-bold leading-tight truncate">
          {{ displayTitle }}
        </p>
        <p class="text-xs text-muted leading-tight truncate">
          {{ directionLabel }}: {{ otherPartyName }}
        </p>
         <!-- Transaction ID -->
        <div class="flex text-xs gap-2">
          <span class="text-muted">Transaction ID:</span>
          <span class="font-mono">{{ transaction.id }}</span>
        </div>
      </div>

      <!-- Amount & Time -->
      <div class="col-span-3 flex flex-col items-end justify-between">
        <p class="text-xs text-muted leading-tight">{{ formattedTime }}</p>
        <UButton
          class="shadow-lg text-white"
          size="xs"
          :trailing-icon="hasDetails ? (isExpanded ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down') : undefined"
          variant="subtle"
          :color="changeColor"
        >
          {{ transaction.amount.formatted }}
        </UButton>
      </div>
    </div>

    <!-- Expandable Details -->
    <Transition
      name="expand"
      @enter="(el: Element) => { const html = el as HTMLElement; html.style.height = '0'; html.offsetHeight; html.style.height = html.scrollHeight + 'px' }"
      @after-enter="(el: Element) => { (el as HTMLElement).style.height = 'auto' }"
      @leave="(el: Element) => { const html = el as HTMLElement; html.style.height = html.scrollHeight + 'px'; html.offsetHeight; html.style.height = '0' }"
    >
      <div
        v-if="isExpanded && hasDetails"
        class="overflow-hidden bg-linear-to-tr from-neutral-950"
        :class="backgroundClass"
      >
        <!-- Divider -->
        <USeparator/>

        <div class="px-3 py-2 space-y-2">
          <!-- Transaction ID -->
          <div class="flex justify-between text-xs">
            <span class="text-muted">Transaction ID</span>
            <span class="font-mono">{{ transaction.id }}</span>
          </div>

          <!-- Status -->
          <div class="flex justify-between text-xs">
            <span class="text-muted">Status</span>
            <UBadge 
              :color="transaction.status === 'completed' ? 'success' : 'warning'" 
              variant="subtle"
              size="xs"
            >
              {{ transaction.status }}
            </UBadge>
          </div>

          <!-- Divider -->
          <USeparator />

          <!-- Balance/XP Details -->
          <div
            v-for="item in detailItems"
            :key="item.label"
            class="space-y-1"
          >
            <p class="text-xs font-semibold text-muted">{{ item.label }}</p>
            <div class="grid grid-cols-3 gap-2 text-xs">
              <div class="text-center">
                <p class="text-muted">Before</p>
                <p class="font-semibold">{{ item.before }}</p>
              </div>
              <div class="text-center">
                <p class="text-muted">After</p>
                <p class="font-semibold">{{ item.after }}</p>
              </div>
              <div class="text-center">
                <p class="text-muted">Change</p>
                <p class="font-semibold" :class="item.change.startsWith('+') ? 'text-success-400' : 'text-error-400'">
                  {{ item.change }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.expand-enter-active,
.expand-leave-active {
  transition: height 0.2s ease-out;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  height: 0;
}
</style>

<!-- ~/components/economy/transaction-item.vue -->
<!-- One activity row: what happened, with whom, how much — plus an expandable
     receipt (id, status, balance & XP before/after).

     Controlled component: `expanded` comes from the parent, keyed by
     transaction id, so open rows survive pagination merges and tab churn. -->
<script setup lang="ts">
import type { Transaction, BalanceSnapshot } from '~/types/economy/wallet'
import { ASSETS } from '~/constants/assets'
import { TRANSACTION_TYPE_LABELS } from '~/constants/economy/transactionConstants'
import { isPositiveTransaction, getOtherPartyDisplay } from '~/utils/economy/transactionHelpers'
import { formatCurrency } from '~/utils/currency'
import { withImageKitTransform } from '~/utils/imagekit'

// ========================================
// Props / Emits
// ========================================

defineOptions({ name: 'TransactionItem' })

const props = defineProps<{
  transaction: Transaction
  expanded: boolean
}>()

const emit = defineEmits<{
  toggle: []
}>()

// ========================================
// Computed - Row
// ========================================

const formattedTime = computed(() =>
  new Date(props.transaction.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }),
)

/** Primary line: the perspective-aware sentence from the API, else the type label. */
const headline = computed(() =>
  props.transaction.description
  || props.transaction.title
  || TRANSACTION_TYPE_LABELS[props.transaction.type]
  || 'Transaction',
)

/** Secondary line: counterparty and room, joined with a dot. */
const subline = computed(() => {
  const parts: string[] = []
  if (props.transaction.other_party) {
    parts.push(`${props.transaction.my_role === 'initiator' ? 'To' : 'From'} ${getOtherPartyDisplay(props.transaction)}`)
  }
  const room = props.transaction.room?.name ?? props.transaction.metadata?.room_name
  if (room) parts.push(`in ${room}`)
  return parts.join(' · ')
})

const isPositive = computed(() => isPositiveTransaction(props.transaction))

const amountClass = computed(() => (isPositive.value ? 'text-success-400' : 'text-error-400'))

const backgroundClass = computed(() => (isPositive.value ? 'to-success-950/60' : 'to-error-950/60'))

const thumbnailUrl = computed(() =>
  withImageKitTransform(props.transaction.thumbnail_url ?? ASSETS.DEFAULT_TRANSACTION_THUMB, { w: 96 }),
)

const isPending = computed(() => props.transaction.status !== 'completed')

// ========================================
// Computed - Receipt (expanded)
// ========================================

interface DetailItem {
  label: string
  before: string
  after: string
  change: string
  positive: boolean
}

function toDetailItem(label: string, snapshot: BalanceSnapshot): DetailItem {
  const change = snapshot.after - snapshot.before
  return {
    label,
    before: formatCurrency(snapshot.before),
    after: formatCurrency(snapshot.after),
    change: `${change >= 0 ? '+' : ''}${formatCurrency(change)}`,
    positive: change >= 0,
  }
}

const detailItems = computed<DetailItem[]>(() => {
  const items: DetailItem[] = []
  const balance = props.transaction.my_balance
  const xp = props.transaction.my_xp

  if (balance?.coins) items.push(toDetailItem('Coins', balance.coins))
  if (balance?.diamonds) items.push(toDetailItem('Diamonds', balance.diamonds))
  if (xp?.wealth) items.push(toDetailItem('Wealth XP', xp.wealth))
  if (xp?.charm) items.push(toDetailItem('Charm XP', xp.charm))

  return items
})

// ========================================
// Handlers
// ========================================

const { copy: copyToClipboard, copied } = useClipboard({ copiedDuring: 1500 })

function copyId(event: Event): void {
  event.stopPropagation()
  void copyToClipboard(props.transaction.id)
}
</script>

<template>
  <div
    class="activity-row cursor-pointer select-none bg-linear-to-br from-neutral-950 shadow-xl shadow-neutral"
    :class="backgroundClass"
    role="button"
    :aria-expanded="expanded"
    @click="emit('toggle')"
  >
    <!-- Row -->
    <div class="flex items-center gap-3 px-3 py-2">
      <div class="size-11 shrink-0 overflow-hidden rounded-full border bg-elevated inset-shadow-sm">
        <NuxtImg class="size-full object-cover" :src="thumbnailUrl" :alt="headline" />
      </div>

      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-bold leading-tight">{{ headline }}</p>
        <p class="truncate text-xs leading-tight text-muted">
          {{ formattedTime }}<template v-if="subline"> · {{ subline }}</template>
        </p>
      </div>

      <div class="flex shrink-0 items-center gap-1">
        <div class="text-right">
          <p class="text-sm font-bold tabular-nums leading-tight" :class="amountClass">
            {{ transaction.amount.formatted }}
          </p>
          <UBadge v-if="isPending" color="warning" variant="subtle" size="xs">{{ transaction.status }}</UBadge>
        </div>
        <UIcon
          name="i-lucide-chevron-down"
          class="size-4 text-muted transition-transform"
          :class="{ 'rotate-180': expanded }"
        />
      </div>
    </div>

    <!-- Receipt: grid-template-rows 0fr→1fr gives a real slide without JS
         height measuring. Safe because the list is plain DOM (no virtual
         scroller caching row heights). -->
    <Transition name="receipt">
      <div v-if="expanded" class="receipt grid">
        <div class="min-h-0 overflow-hidden">
          <div class="border-t border-white/5 px-3 py-2 text-xs">
        <div class="flex items-center justify-between py-1">
          <span class="text-muted">Transaction ID</span>
          <button type="button" class="flex items-center gap-1 font-mono" @click="copyId">
            {{ transaction.id }}
            <UIcon :name="copied ? 'i-lucide-check' : 'i-lucide-copy'" class="size-3.5 text-muted" />
          </button>
        </div>

        <div class="flex items-center justify-between py-1">
          <span class="text-muted">Status</span>
          <UBadge :color="isPending ? 'warning' : 'success'" variant="subtle" size="xs">
            {{ transaction.status }}
          </UBadge>
        </div>

        <div v-if="transaction.room?.name" class="flex items-center justify-between py-1">
          <span class="text-muted">Room</span>
          <span>{{ transaction.room.name }}</span>
        </div>

        <template v-if="detailItems.length">
          <USeparator class="my-1" />
          <div
            v-for="item in detailItems"
            :key="item.label"
            class="flex items-center justify-between py-1 tabular-nums"
          >
            <span class="text-muted">{{ item.label }}</span>
            <span>
              {{ item.before }}
              <UIcon name="i-lucide-arrow-right" class="mx-1 size-3 text-muted" />
              {{ item.after }}
              <span class="ml-2 font-semibold" :class="item.positive ? 'text-success-400' : 'text-error-400'">
                {{ item.change }}
              </span>
            </span>
          </div>
        </template>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* Native lazy rendering: off-screen rows skip layout/paint. The intrinsic
   size keeps the scrollbar stable before a row is first rendered. */
.activity-row {
  content-visibility: auto;
  contain-intrinsic-size: auto 60px;
}
.receipt {
  grid-template-rows: 1fr;
}
.receipt-enter-active,
.receipt-leave-active {
  transition: grid-template-rows 0.2s ease-out;
}
.receipt-enter-from,
.receipt-leave-to {
  grid-template-rows: 0fr;
}
</style>

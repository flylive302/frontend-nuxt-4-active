<!-- ~/components/coin-requests-list.vue -->
<!-- Displays user's coin requests with tabbed status filtering -->
<script setup lang="ts">
import { ref, computed, onMounted, toRef } from 'vue'
import type { CoinRequest, CoinRequestStatus } from '~/types/coin-request'
import { STATUS_COLORS } from '~/types/coin-request'
import { useCoinRequests } from '~/composables/useCoinRequests'
import { useColorClasses } from '~/composables/useColorClasses'
import type { Colors } from '~/types/colors'

defineOptions({ name: 'CoinRequestsList' })

// ========================================
// Props & Emits
// ========================================
const props = withDefaults(defineProps<{
  color?: Colors
}>(), {
  color: 'tertiary'
})

const emit = defineEmits<{
  (e: 'hasPending', value: boolean): void
  (e: 'requestCancelled', request: CoinRequest): void
}>()

const color = toRef(props, 'color')
const { borderClass } = useColorClasses(color)

// ========================================
// Types
// ========================================
interface TabItem {
  label: string
  value: CoinRequestStatus | 'all'
  icon?: string
}

// ========================================
// State
// ========================================
const requests = ref<CoinRequest[]>([])
const isLoading = ref(true)
const isCancelling = ref<number | null>(null)
const activeTab = ref<CoinRequestStatus | 'all'>('all')

// ========================================
// Composables
// ========================================
const { fetchMyRequests, cancelRequest, normalizeError } = useCoinRequests()
const toast = useToast()

// ========================================
// Tabs Configuration
// ========================================
const tabs: TabItem[] = [
  { label: 'All', value: 'all', icon: 'i-lucide-list' },
  { label: 'Pending', value: 'pending', icon: 'i-lucide-clock' },
  { label: 'Approved', value: 'approved', icon: 'i-lucide-check-circle' },
  { label: 'Rejected', value: 'rejected', icon: 'i-lucide-x-circle' },
  { label: 'Cancelled', value: 'cancelled', icon: 'i-lucide-ban' }
]

const tabItems = computed(() =>
  tabs.map(tab => ({ label: tab.label, value: tab.value, icon: tab.icon }))
)

// ========================================
// Computed
// ========================================
const hasPendingRequest = computed(() =>
  requests.value.some(r => r.status.value === 'pending')
)

const filteredRequests = computed(() => {
  if (activeTab.value === 'all') return requests.value
  return requests.value.filter(r => r.status.value === activeTab.value)
})

// ========================================
// Data Fetching
// ========================================
async function loadRequests(): Promise<void> {
  isLoading.value = true
  try {
    const response = await fetchMyRequests(1, 20)
    if (response.status === 'success') {
      requests.value = response.data
      emit('hasPending', hasPendingRequest.value)
    }
  } catch (err) {
    const normalized = normalizeError(err)
    toast.add({ title: 'Failed to load requests', description: normalized.message, color: 'error' })
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  void loadRequests()
})

// ========================================
// Public Methods
// ========================================
function addRequest(request: CoinRequest): void {
  requests.value.unshift(request)
  activeTab.value = 'pending'
  emit('hasPending', true)
}

async function handleCancelRequest(id: number): Promise<void> {
  if (isCancelling.value) return
  isCancelling.value = id

  try {
    const response = await cancelRequest(id)
    if (response.status === 'success' && response.data) {
      const index = requests.value.findIndex(r => r.id === id)
      if (index !== -1) requests.value[index] = response.data
      toast.add({ title: 'Request cancelled', color: 'success' })
      emit('hasPending', hasPendingRequest.value)
      emit('requestCancelled', response.data)
    }
  } catch (err) {
    const normalized = normalizeError(err)
    toast.add({ title: 'Failed to cancel', description: normalized.message, color: 'error' })
  } finally {
    isCancelling.value = null
  }
}

function handleTabChange(value: string | number): void {
  activeTab.value = value as CoinRequestStatus | 'all'
}

// ========================================
// Helpers
// ========================================
function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(dateString))
}

function getStatusIcon(status: CoinRequestStatus): string {
  const icons: Record<CoinRequestStatus, string> = {
    pending: 'i-lucide-clock',
    approved: 'i-lucide-check-circle',
    rejected: 'i-lucide-x-circle',
    cancelled: 'i-lucide-ban',
    expired: 'i-lucide-timer-off'
  }
  return icons[status]
}

defineExpose({ addRequest, hasPendingRequest, isLoading })
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h3 class="text-base font-semibold">Your Coin Requests</h3>
      <UBadge v-if="requests.length > 0" :color="color" variant="soft" size="sm">
        {{ requests.length }} total
      </UBadge>
    </div>

    <!-- Tabs -->
    <UTabs
      :items="tabItems"
      :model-value="activeTab"
      variant="link"
      :color="color"
      :ui="{ list: 'bg-elevated/20 rounded-md overflow-x-scroll overflow-y-hidden', trigger: 'min-w-fit' }"
      class="w-full"
      @update:model-value="handleTabChange"
    />

    <!-- Loading -->
    <div v-if="isLoading" class="flex flex-col items-center justify-center py-8 gap-3">
      <UProgress animation="carousel" :color="color" class="w-32" />
      <p class="text-sm text-muted">Loading requests...</p>
    </div>

    <!-- Empty -->
    <div v-else-if="filteredRequests.length === 0" class="flex flex-col items-center justify-center py-8 text-center">
      <div :class="`w-16 h-16 rounded-full bg-${color}/10 flex items-center justify-center mb-3`">
        <UIcon name="i-lucide-inbox" :class="`w-8 h-8 text-${color}`" />
      </div>
      <p class="text-sm font-medium">No {{ activeTab === 'all' ? '' : activeTab }} requests</p>
      <p class="text-xs text-muted mt-1">
        {{ activeTab === 'all' ? 'Submit your first coin request above!' : 'No requests with this status yet.' }}
      </p>
    </div>

    <!-- List -->
    <div v-else class="space-y-3">
      <TransitionGroup
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 translate-x-4"
        enter-to-class="opacity-100 translate-x-0"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
        move-class="transition duration-300"
      >
        <div
          v-for="request in filteredRequests"
          :key="request.id"
          :class="[borderClass]"
          class="rounded-xl border p-3 bg-linear-to-br to-tertiary/10 shadow-sm hover:shadow-md transition-all duration-200"
        >
          <!-- Header -->
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0 flex-1">
              <UAvatar
                :src="request.reseller.avatar || undefined"
                :alt="request.reseller.name"
                size="md"
                :class="[borderClass, 'ring-2 shrink-0']"
              />
              <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold truncate">{{ request.reseller.name }}</p>
                <p class="text-xs text-muted flex items-center gap-1">
                  <UIcon name="i-lucide-calendar" class="w-3 h-3" />
                  {{ formatDate(request.created_at) }}
                </p>
              </div>
            </div>
            <UBadge :color="STATUS_COLORS[request.status.value]" variant="subtle" size="sm">
              <UIcon :name="getStatusIcon(request.status.value)" class="w-3 h-3 mr-1" />
              {{ request.status.label }}
            </UBadge>
          </div>

          <!-- Amount -->
          <div :class="`bg-${color}/10`" class="flex items-center justify-between rounded-lg px-3 py-2 mt-2">
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-coins" :class="`w-5 h-5 text-${color}`" />
              <span :class="`text-lg font-bold text-${color}`">{{ request.final_amount }}</span>
              <span class="text-sm text-muted">coins</span>
            </div>
            <div class="flex items-center gap-2">
              <span v-if="request.was_adjusted" class="text-xs text-muted line-through">{{ request.amount }}</span>
              <UBadge
                v-if="request.status.value === 'approved' && request.type"
                :color="request.type.value === 'credit' ? 'info' : 'success'"
                variant="soft"
                size="xs"
              >
                {{ request.type.label }}
              </UBadge>
            </div>
          </div>

          <!-- Message -->
          <p v-if="request.message" class="mt-3 text-xs text-muted bg-muted/5 rounded-lg p-2 border border-muted/10">
            <UIcon name="i-lucide-message-square" class="w-3 h-3 inline mr-1" />
            {{ request.message }}
          </p>

          <!-- Cancel Action -->
          <div v-if="request.status.value === 'pending'" class="mt-3 flex justify-end">
            <UButton
              size="xs"
              color="error"
              variant="soft"
              icon="i-lucide-x"
              :loading="isCancelling === request.id"
              :disabled="isCancelling !== null"
              @click="handleCancelRequest(request.id)"
            >
              Cancel Request
            </UButton>
          </div>

          <!-- Credit Info -->
          <div
            v-if="request.status.value === 'approved' && request.type?.value === 'credit' && request.credit_days"
            class="mt-3 flex items-center gap-2 text-xs p-2 rounded-lg"
            :class="request.is_repayment_due ? 'bg-error/10 text-error' : 'bg-info/10 text-info'"
          >
            <UIcon :name="request.is_repayment_due ? 'i-lucide-alert-triangle' : 'i-lucide-info'" class="w-4 h-4" />
            <span v-if="request.is_repayment_due">Credit overdue - please repay!</span>
            <span v-else>Credit: {{ request.credit_days }} days {{ request.is_repaid ? '(Repaid)' : '' }}</span>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>

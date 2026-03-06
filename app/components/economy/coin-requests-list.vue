<!-- ~/components/coin-requests-list.vue -->
<!-- Displays user's coin requests with tabbed status filtering -->
<script setup lang="ts">
import { ref, computed, onMounted, toRef } from 'vue'
import type { CoinRequest, CoinRequestStatus } from '~/types/economy/coin-request'
import { useCoinRequests } from '~/composables/economy/useCoinRequests'
import { useColorClasses } from '~/composables/shared/useColorClasses'
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

defineExpose({ addRequest, loadRequests, hasPendingRequest, isLoading })
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
        <EconomyCoinRequestItem
          v-for="request in filteredRequests"
          :key="request.id"
          :request="request"
          :color="color"
          :border-class="borderClass"
          :is-cancelling="isCancelling"
          @cancel="handleCancelRequest"
        />
      </TransitionGroup>
    </div>
  </div>
</template>

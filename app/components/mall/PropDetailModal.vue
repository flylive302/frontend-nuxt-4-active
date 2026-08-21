<!-- ~/components/mall/PropDetailModal.vue -->
<!-- Modal for viewing prop details and purchasing -->
<script setup lang="ts">
import { computed } from 'vue'
import type { Prop } from '~/types/mall/prop'
import { PROP_TYPE_ICONS, PROP_TYPE_COLORS, PROP_TYPE_LABELS } from '~/constants/mall'
import { useAuthStore } from '~/stores/auth'

// ========================================
// Props & Emits
// ========================================

defineOptions({ name: 'PropDetailModal' })

const props = defineProps<{
  prop: Prop | null
  open: boolean
  isPurchasing?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'purchase', propId: number): void
}>()

// ========================================
// Stores
// ========================================

const authStore = useAuthStore()

// ========================================
// Computed
// ========================================

const icon = computed(() => props.prop ? PROP_TYPE_ICONS[props.prop.type] : '')
const iconColor = computed(() => props.prop ? PROP_TYPE_COLORS[props.prop.type] : '')
const typeLabel = computed(() => props.prop ? PROP_TYPE_LABELS[props.prop.type] : '')

const isAvailable = computed(() => 
  props.prop?.is_available && props.prop?.is_purchasable
)

const isSoldOut = computed(() => 
  props.prop?.inventory_count !== null && (props.prop?.inventory_count ?? 0) <= 0
)

/**
 * Format price for display.
 */
const priceDisplay = computed(() => {
  if (!props.prop) return '0'
  const price = props.prop.price
  return price.toLocaleString()
})

/**
 * Duration display.
 */
const durationDisplay = computed(() => {
  if (!props.prop?.duration_days) return 'Permanent'
  return `${props.prop.duration_days} days`
})

/**
 * Inventory display.
 */
const inventoryDisplay = computed(() => {
  if (!props.prop || props.prop.inventory_count === null) return 'Unlimited'
  return `${props.prop.inventory_count} left`
})

// ========================================
// Handlers
// ========================================

function handlePurchase(): void {
  if (props.prop && isAvailable.value) {
    emit('purchase', props.prop.id)
  }
}

function handleClose(): void {
  emit('close')
}
</script>

<template>
  <UModal 
    :open="open" 
    @update:open="(val) => !val && handleClose()"
  >
    <template #content>
      <UCard v-if="prop" class="bg-surface overflow-scroll">
        <!-- Header -->
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <icon :name="icon" class="size-5" :class="iconColor" />
              <span class="text-sm text-muted">{{ typeLabel }}</span>
            </div>
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="handleClose"
            />
          </div>
        </template>

        <!-- Content -->
        <div class="space-y-4 overflow-scroll">
          <!-- Asset Preview - Type Specific Rendering -->
          <div class="max-w-50 mx-auto">
            <MallPropAssetView
              :type="prop.type"
              :name="prop.name"
              :asset-url="prop.asset_url"
              :thumbnail-url="prop.thumbnail_url"
              :prop-id="prop.id"
              :signature-value="prop.signature_value"
              :metadata="prop.metadata"
              :avatar-img="authStore?.user?.avatar ?? undefined"
            />
          </div>

          <!-- Name -->
          <h2 class="text-xl font-bold text-center">{{ prop.name }}</h2>

          <!-- Description -->
          <p v-if="prop.description" class="text-sm text-muted text-center">
            {{ prop.description }}
          </p>

          <!-- Details -->
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div class="bg-muted/20 rounded-lg p-3 text-center">
              <p class="text-muted text-xs mb-1">Duration</p>
              <p class="font-bold">{{ durationDisplay }}</p>
            </div>
            <div class="bg-muted/20 rounded-lg p-3 text-center">
              <p class="text-muted text-xs mb-1">Stock</p>
              <p class="font-bold">{{ inventoryDisplay }}</p>
            </div>
          </div>

          <!-- VIP Requirement -->
          <div 
            v-if="prop.vip_level_required > 0" 
            class="flex items-center justify-center gap-2 text-warning text-sm"
          >
            <icon name="i-lucide-crown" class="size-4" />
            <span>Requires VIP Level {{ prop.vip_level_required }}</span>
          </div>
        </div>

        <!-- Footer -->
        <template #footer>
          <div class="flex flex-col gap-2">
            <!-- Price -->
            <div class="flex items-center justify-center gap-2 text-lg">
              <icon name="i-lucide-coins" class="size-5 text-amber-500" />
              <span class="font-bold text-amber-500">{{ priceDisplay }}</span>
              <span class="text-muted text-sm">coins</span>
            </div>

            <!-- Purchase Button -->
            <UButton
              block
              size="lg"
              :color="isSoldOut ? 'neutral' : 'primary'"
              :disabled="!isAvailable || isSoldOut"
              :loading="isPurchasing"
              @click="handlePurchase"
            >
              <template v-if="isSoldOut">Sold Out</template>
              <template v-else-if="!isAvailable">Unavailable</template>
              <template v-else>
                <icon name="i-lucide-shopping-cart" class="size-4 mr-2" />
                Purchase
              </template>
            </UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>

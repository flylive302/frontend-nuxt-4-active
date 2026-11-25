<!-- ~/components/mall/MyPropDetailModal.vue -->
<!-- Modal for previewing owned prop details with equip/unequip -->
<script setup lang="ts">
import { computed } from 'vue'
import type { UserProp } from '~/types/mall/prop'
import { PROP_TYPE_ICONS, PROP_TYPE_COLORS, PROP_TYPE_LABELS } from '~/constants/mall'
import { useAuthStore } from '~/stores/auth'
import { useMallStore } from '~/stores/mall'
import { formatUserPropExpiryLabel, userPropExpiryColorClass } from '~/utils/userPropExpiry'
import { canUnequipUserProp, isOriginalSignature, isRareId } from '~/utils/userPropOrigin'

// ========================================
// Props & Emits
// ========================================

defineOptions({ name: 'MyPropDetailModal' })

const props = defineProps<{
  userProp: UserProp | null
  open: boolean
  isEquipping?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'equip' | 'unequip', userPropId: number): void
}>()

// ========================================
// Stores
// ========================================

const authStore = useAuthStore()
const mallStore = useMallStore()

// ========================================
// Computed
// ========================================

/**
 * `UserProp` (GET /api/v1/user/props) does not carry `metadata` — resolve the
 * mice-wave ring color from `propIndex` (seeded at bootstrap / by the
 * failsafe fetch) instead, keyed by the catalog `prop_id`. Falls back to the
 * default ring color when the entry isn't indexed yet.
 */
const miceWaveMetadata = computed(() =>
  props.userProp ? mallStore.propIndex[props.userProp.prop_id]?.metadata ?? null : null,
)

const icon = computed(() => props.userProp ? PROP_TYPE_ICONS[props.userProp.type] : '')
const iconColor = computed(() => props.userProp ? PROP_TYPE_COLORS[props.userProp.type] : '')
const typeLabel = computed(() => props.userProp ? PROP_TYPE_LABELS[props.userProp.type] : '')

const isExpired = computed(() => !props.userProp?.is_valid)
const isEquipped = computed(() => props.userProp?.is_equipped ?? false)

/** Signature rows show their number; the user's original one is labelled and cannot be unequipped. */
const signatureNumber = computed(() =>
  props.userProp?.type === 'signature' ? props.userProp.signature_value : null,
)
const isOriginal = computed(() => props.userProp ? isOriginalSignature(props.userProp) : false)
const isRare = computed(() => props.userProp ? isRareId(props.userProp) : false)
const showUnequip = computed(() => props.userProp ? canUnequipUserProp(props.userProp) : false)

/** Expiry label + urgency colour (permanent rows read "Permanent" — ADR 0051). */
const expiryDisplay = computed(() => props.userProp ? formatUserPropExpiryLabel(props.userProp) : '')
const expiryColor = computed(() => props.userProp ? userPropExpiryColorClass(props.userProp) : 'text-muted')

/**
 * Source type label for display.
 */
const sourceLabel = computed(() => {
  if (!props.userProp) return ''
  const labels: Record<string, string> = {
    purchase: 'Purchased',
    gift: 'Received as Gift',
    reward: 'Reward',
    system: 'Original Signature',
  }
  return labels[props.userProp.source_type] ?? props.userProp.source_type
})

// ========================================
// Handlers
// ========================================

function handleToggleEquip(): void {
  if (!props.userProp || isExpired.value) return

  if (isEquipped.value) {
    if (showUnequip.value) emit('unequip', props.userProp.id)
  } else {
    emit('equip', props.userProp.id)
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
      <UCard v-if="userProp" class="bg-surface overflow-scroll">
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
              :type="userProp.type"
              :name="userProp.name"
              :asset-url="userProp.asset_url"
              :thumbnail-url="userProp.thumbnail_url"
              :prop-id="userProp.prop_id"
              :metadata="miceWaveMetadata"
              :avatar-img="authStore?.user?.avatar ?? undefined"
            />
          </div>

          <!-- Name -->
          <h2 class="text-xl font-bold text-center">{{ userProp.name }}</h2>

          <!-- Signature number + Original / Rare ID label -->
          <div v-if="signatureNumber" class="flex items-center justify-center gap-2">
            <span class="text-2xl font-bold tabular-nums tracking-wide">{{ signatureNumber }}</span>
            <UBadge v-if="isOriginal" color="neutral" size="xs" variant="subtle">Original</UBadge>
            <UBadge v-if="isRare" color="warning" size="xs" variant="subtle">Rare ID</UBadge>
          </div>

          <!-- Details -->
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div class="bg-muted/20 rounded-lg p-3 text-center">
              <p class="text-muted text-xs mb-1">Duration</p>
              <p class="font-bold" :class="expiryColor">{{ expiryDisplay }}</p>
            </div>
            <div class="bg-muted/20 rounded-lg p-3 text-center">
              <p class="text-muted text-xs mb-1">Source</p>
              <p class="font-bold">{{ sourceLabel }}</p>
            </div>
          </div>

          <!-- Equipped Status -->
          <div
            v-if="isEquipped"
            class="flex items-center justify-center gap-2 text-primary text-sm"
          >
            <icon name="i-lucide-circle-check-big" class="size-4" />
            <span>Currently Equipped</span>
          </div>

          <!-- Expired Warning -->
          <div
            v-if="isExpired"
            class="flex items-center justify-center gap-2 text-error text-sm"
          >
            <icon name="i-lucide-alert-circle" class="size-4" />
            <span>This prop has expired</span>
          </div>
        </div>

        <!-- Footer -->
        <template #footer>
          <div class="flex flex-col gap-2">
            <!-- Equip/Unequip Button -->
            <UButton
              v-if="!isExpired && (!isEquipped || showUnequip)"
              block
              size="lg"
              :color="isEquipped ? 'neutral' : 'primary'"
              :variant="isEquipped ? 'soft' : 'solid'"
              :loading="isEquipping"
              @click="handleToggleEquip"
            >
              <template v-if="isEquipped">
                <icon name="i-lucide-circle-x" class="size-4 mr-2" />
                Unequip
              </template>
              <template v-else>
                <icon name="i-lucide-circle-check-big" class="size-4 mr-2" />
                Equip
              </template>
            </UButton>

            <!-- Expired: Cannot equip -->
            <UButton
              v-else-if="isExpired"
              block
              size="lg"
              color="neutral"
              disabled
            >
              Expired
            </UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>

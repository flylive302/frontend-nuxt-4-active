<!-- ~/components/mall/MyPropDetailModal.vue -->
<!-- Modal for previewing owned prop details with equip/unequip -->
<script setup lang="ts">
import { computed } from 'vue'
import type { UserProp } from '~/types/mall/prop'
import { PROP_TYPE_ICONS, PROP_TYPE_COLORS, PROP_TYPE_LABELS } from '~/constants/mall'
import { useAuthStore } from '~/stores/auth'

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

// ========================================
// Computed
// ========================================

const icon = computed(() => props.userProp ? PROP_TYPE_ICONS[props.userProp.type] : '')
const iconColor = computed(() => props.userProp ? PROP_TYPE_COLORS[props.userProp.type] : '')
const typeLabel = computed(() => props.userProp ? PROP_TYPE_LABELS[props.userProp.type] : '')

const isExpired = computed(() => !props.userProp?.is_valid)
const isEquipped = computed(() => props.userProp?.is_equipped ?? false)

/**
 * Days remaining display.
 */
const expiryDisplay = computed(() => {
  if (!props.userProp) return ''
  if (!props.userProp.expires_at) return 'Permanent'
  if (!props.userProp.is_valid) return 'Expired'

  const days = props.userProp.days_remaining
  if (days === null) return ''
  if (days <= 0) return 'Expires today'
  if (days === 1) return '1 day left'
  return `${days} days left`
})

/**
 * Expiry urgency color.
 */
const expiryColor = computed(() => {
  if (isExpired.value) return 'text-error'
  const days = props.userProp?.days_remaining
  if (days !== null && days !== undefined && days <= 3) return 'text-warning'
  return 'text-muted'
})

/**
 * Source type label for display.
 */
const sourceLabel = computed(() => {
  if (!props.userProp) return ''
  const labels: Record<string, string> = {
    purchase: 'Purchased',
    gift: 'Received as Gift',
    reward: 'Reward',
  }
  return labels[props.userProp.source_type] ?? props.userProp.source_type
})

// ========================================
// Handlers
// ========================================

function handleToggleEquip(): void {
  if (!props.userProp || isExpired.value) return

  if (isEquipped.value) {
    emit('unequip', props.userProp.id)
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
            <!-- Frame: UserAvatar with frame -->
            <template v-if="userProp.type === 'frame'">
              <UserAvatar
                :animated="true"
                :frame-name="userProp.name"
                :frame-asset-url="userProp.asset_url"
                :img="authStore?.user?.avatar ?? undefined"
              />
            </template>

            <!-- Entry Animation / Chat Bubble: SvgaPlayer -->
            <template v-else-if="userProp.type === 'entry_animation' || userProp.type === 'chat_bubble'">
              <div class="aspect-square bg-muted/20 rounded-xl overflow-hidden flex items-center justify-center">
                <SvgaPlayer
                  class="relative min-w-full z-10"
                  :name="userProp.asset_url"
                  height="auto"
                />
              </div>
            </template>

            <!-- Room Theme: Show thumbnail and asset images -->
            <template v-else-if="userProp.type === 'room_theme'">
              <div class="space-y-2">
                <img
                  v-if="userProp.thumbnail_url"
                  :src="userProp.thumbnail_url"
                  :alt="userProp.name"
                  class="w-full h-auto object-contain rounded-xl"
                >
                <img
                  v-if="userProp.asset_url"
                  :src="userProp.asset_url"
                  :alt="userProp.name"
                  class="w-full h-auto object-contain rounded-xl"
                >
              </div>
            </template>

            <!-- Signature / Unique ID: ProfileBadge -->
            <template v-else-if="userProp.type === 'signature'">
              <div class="aspect-square bg-muted/20 rounded-xl overflow-hidden flex items-center justify-center">
                <ProfileBadge :txt="String(userProp.name)" />
              </div>
            </template>

            <!-- Fallback: Icon -->
            <template v-else>
              <div class="aspect-square bg-muted/20 rounded-xl overflow-hidden flex items-center justify-center">
                <icon :name="icon" class="size-16" :class="iconColor" />
              </div>
            </template>
          </div>

          <!-- Name -->
          <h2 class="text-xl font-bold text-center">{{ userProp.name }}</h2>

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
              v-if="!isExpired"
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
              v-else
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

<!-- ~/components/mall/MyPropCard.vue -->
<!-- Displays a user's owned prop with equip/unequip -->
<script setup lang="ts">
import { computed } from 'vue'
import type { UserProp } from '~/types/mall/prop'
import { PROP_TYPE_ICONS, PROP_TYPE_COLORS } from '~/constants/mall'

// ========================================
// Props & Emits
// ========================================

defineOptions({ name: 'MyPropCard' })

const props = defineProps<{
  userProp: UserProp
  isEquipping?: boolean
}>()

const emit = defineEmits<{
  (e: 'equip' | 'unequip', userPropId: number): void
  (e: 'select', userProp: UserProp): void
}>()

// ========================================
// Computed
// ========================================

const icon = computed(() => PROP_TYPE_ICONS[props.userProp.type])
const iconColor = computed(() => PROP_TYPE_COLORS[props.userProp.type])

const isExpired = computed(() => !props.userProp.is_valid)
const isEquipped = computed(() => props.userProp.is_equipped)

/**
 * Days remaining display.
 */
const expiryDisplay = computed(() => {
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
  const days = props.userProp.days_remaining
  if (days !== null && days <= 3) return 'text-warning'
  return 'text-muted'
})

// ========================================
// Handlers
// ========================================

function handleToggleEquip(): void {
  if (isExpired.value) return

  if (isEquipped.value) {
    emit('unequip', props.userProp.id)
  } else {
    emit('equip', props.userProp.id)
  }
}

function handleSelect(): void {
  emit('select', props.userProp)
}
</script>

<template>
  <div 
    class="bg-elevated rounded-xl overflow-hidden transition-all duration-200"
    :class="{ 
      'opacity-50': isExpired,
      'ring-2 ring-primary': isEquipped
    }"
  >
    <!-- Thumbnail -->
    <div 
      class="aspect-square relative bg-muted/20 cursor-pointer"
      @click="handleSelect"
    >
      <NuxtImg 
        v-if="userProp.thumbnail_url"
        :src="userProp.thumbnail_url"
        :alt="userProp.name"
        class="p-2 w-full h-full object-cover"
        loading="lazy"
      />
      <div v-else class="w-full h-full flex items-center justify-center">
        <icon :name="icon" class="size-10" :class="iconColor" />
      </div>

      <!-- Equipped Badge -->
      <div 
        v-if="isEquipped" 
        class="absolute top-1.5 right-1.5"
      >
        <UBadge color="primary" size="xs" variant="solid" class="text-white">
          <UIcon name="i-lucide-circle-check-big" class="size-3 mr-0.5" />
          ON
        </UBadge>
      </div>

      <!-- Expired Overlay -->
      <div 
        v-if="isExpired" 
        class="absolute inset-0 bg-black/60 flex items-center justify-center"
      >
        <span class="text-white font-bold text-xs">EXPIRED</span>
      </div>
    </div>

    <!-- Info -->
    <div class="p-2 space-y-1.5">
      <!-- Name -->
      <p class="font-medium text-xs truncate">{{ userProp.name }}</p>

      <!-- Expiry -->
      <p class="text-[10px]" :class="expiryColor">{{ expiryDisplay }}</p>

      <!-- Equip/Unequip Button -->
      <UButton
        v-if="!isExpired"
        size="xs"
        block
        :color="isEquipped ? 'neutral' : 'primary'"
        :variant="isEquipped ? 'soft' : 'solid'"
        :loading="isEquipping"
        @click="handleToggleEquip"
      >
        {{ isEquipped ? 'Unequip' : 'Equip' }}
      </UButton>
    </div>
  </div>
</template>

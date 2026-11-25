<!-- ~/components/mall/MyPropCard.vue -->
<!-- Displays a user's owned prop with equip/unequip -->
<script setup lang="ts">
import { computed } from 'vue'
import type { UserProp } from '~/types/mall/prop'
import { PROP_TYPE_ICONS, PROP_TYPE_COLORS } from '~/constants/mall'
import { resolveMiceWaveRingColor } from '~/utils/mice-wave-ring-color'
import { useMallStore } from '~/stores/mall'
import { withImageKitTransform } from '~/utils/imagekit'
import { formatUserPropExpiryLabel, userPropExpiryColorClass } from '~/utils/userPropExpiry'
import { canUnequipUserProp, isOriginalSignature, isRareId } from '~/utils/userPropOrigin'

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

const mallStore = useMallStore()

const icon = computed(() => PROP_TYPE_ICONS[props.userProp.type])
const iconColor = computed(() => PROP_TYPE_COLORS[props.userProp.type])

const isMiceWave = computed(() => props.userProp.type === 'mice_wave')

/**
 * `UserProp` doesn't carry `metadata` — resolve from `propIndex` (bootstrap /
 * failsafe fetch) keyed by catalog `prop_id`; defaults when not indexed.
 */
const miceWaveRingColor = computed(() =>
  resolveMiceWaveRingColor(mallStore.propIndex[props.userProp.prop_id]?.metadata),
)

/**
 * `my-props.vue` renders these 2-up (`grid-cols-2`) inside `px-3` — ~171 CSS
 * px per card at the 375px baseline viewport (`nuxt.config.ts` devtools `sm`
 * breakpoint). w=432 is that slot x DPR_FACTOR (2.5), rounded up.
 */
const thumbnailSrc = computed(() =>
  withImageKitTransform(props.userProp.thumbnail_url, { w: 432, q: 75 }),
)

const isExpired = computed(() => !props.userProp.is_valid)
const isEquipped = computed(() => props.userProp.is_equipped)

/** Signature rows show their number; the user's original one is labelled and cannot be unequipped. */
const signatureNumber = computed(() =>
  props.userProp.type === 'signature' ? props.userProp.signature_value : null,
)
const isOriginal = computed(() => isOriginalSignature(props.userProp))
const isRare = computed(() => isRareId(props.userProp))
const showUnequip = computed(() => canUnequipUserProp(props.userProp))

/** Expiry label + urgency colour (permanent rows read "Permanent" — ADR 0051). */
const expiryDisplay = computed(() => formatUserPropExpiryLabel(props.userProp))
const expiryColor = computed(() => userPropExpiryColorClass(props.userProp))

// ========================================
// Handlers
// ========================================

function handleToggleEquip(): void {
  if (isExpired.value) return

  if (isEquipped.value) {
    if (showUnequip.value) emit('unequip', props.userProp.id)
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
      'glowing-border': isEquipped
    }"
  >
    <!-- Thumbnail -->
    <div 
      class="aspect-square relative bg-muted/20 cursor-pointer"
      @click="handleSelect"
    >
      <MiceWaveRing v-if="isMiceWave" :color="miceWaveRingColor" :animated="false" />
      <img
        v-else-if="userProp.thumbnail_url"
        :src="thumbnailSrc"
        :alt="userProp.name"
        class="p-2 w-full h-full object-cover"
        loading="lazy"
        referrerpolicy="no-referrer"
      >
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
      <!-- Signature number -->
      <p
        v-if="signatureNumber"
        class="font-bold text-base tabular-nums tracking-wide truncate"
      >
        {{ signatureNumber }}
      </p>

      <!-- Name (+ Original / Rare ID label) -->
      <div class="flex items-center gap-1 min-w-0">
        <p class="font-medium text-xs truncate">{{ userProp.name }}</p>
        <UBadge v-if="isOriginal" color="neutral" size="xs" variant="subtle" class="shrink-0">
          Original
        </UBadge>
        <UBadge v-if="isRare" color="warning" size="xs" variant="subtle" class="shrink-0">
          Rare ID
        </UBadge>
      </div>

      <!-- Expiry -->
      <p class="text-[10px]" :class="expiryColor">{{ expiryDisplay }}</p>

      <!-- Equip/Unequip Button -->
      <UButton
        v-if="!isExpired && (!isEquipped || showUnequip)"
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

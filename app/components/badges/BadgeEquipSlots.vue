<!-- ~/components/badges/BadgeEquipSlots.vue -->
<!-- Equip-slot row: renders N slot cards above the badge grid. -->
<!-- Selection state is owned by the parent page (transient UI coordination). -->
<!-- Drag-and-drop is client-only (VueDraggable wrapped in <ClientOnly>).  -->
<script setup lang="ts">
import { VueDraggable, type DraggableEvent } from 'vue-draggable-plus'
import type { EquippedBadge } from '~/types/progression/badge'
import { withImageKitTransform } from '~/utils/imagekit'

// ========================================
// Props + Emits
// ========================================

defineOptions({ name: 'BadgeEquipSlots' })

const props = defineProps<{
  selectedSlot: number | null
  pendingBadgeId: number | null
}>()

const emit = defineEmits<{
  slotClick: [slotPosition: number]
  equip: []
  unequip: []
  // Drag events — resolved by the parent page orchestrator
  dropFromGrid: [slotPosition: number, badgeId: number]
  reorderSlots: [fromSlot: number, toSlot: number]
}>()

// ========================================
// Store
// ========================================

const store = useBadgesStore()

// ========================================
// Slots model (synced from store; VueDraggable v-model)
// ========================================

const slotsModel = ref<Array<EquippedBadge | null>>([])

function syncSlotsModel(): void {
  slotsModel.value = Array.from({ length: store.badgeSlotLimit }, (_, i) =>
    store.equippedBadges.find(e => e.slot_position === i + 1) ?? null,
  )
}

// flush: 'sync' so slotsModel stays in step with store during the same tick
watch(
  [() => store.equippedBadges, () => store.badgeSlotLimit],
  syncSlotsModel,
  { immediate: true, flush: 'sync' },
)

// ========================================
// Computed
// ========================================

const selectedBadge = computed<EquippedBadge | null>(() => {
  if (props.selectedSlot === null) return null
  return slotsModel.value[props.selectedSlot - 1] ?? null
})

const showEquipButton = computed(
  () => props.selectedSlot !== null && !selectedBadge.value && props.pendingBadgeId !== null,
)

const showUnequipButton = computed(
  () => props.selectedSlot !== null && selectedBadge.value !== null,
)

// ========================================
// Drag event handlers
// ========================================

// Fires when a badge is dragged from the grid and dropped onto this list.
// e.data is the CatalogBadgeEntry from the grid (cross-list, so type differs from slotsModel).
function onDropFromGrid(e: DraggableEvent): void {
  const entry = e.data as { badge?: { id: number } }
  const badgeId = entry?.badge?.id
  if (!badgeId) return

  const targetSlotPos = Math.min((e.newIndex ?? 0) + 1, store.badgeSlotLimit)

  syncSlotsModel() // Revert SortableJS's DOM insertion before Vue re-renders
  emit('dropFromGrid', targetSlotPos, badgeId)
}

// Fires when an occupied slot is dragged to another position within this list.
function onSlotsUpdate(e: DraggableEvent): void {
  const fromSlot = (e.oldIndex ?? 0) + 1
  const toSlot = (e.newIndex ?? 0) + 1

  syncSlotsModel() // Revert SortableJS's shift before Vue re-renders
  emit('reorderSlots', fromSlot, toSlot)
}

// ========================================
// Helpers
// ========================================

function slotImageUrl(imageUrl: string | null | undefined): string {
  if (!imageUrl) return ''
  return withImageKitTransform(imageUrl, { w: 64, q: 75 })
}
</script>

<template>
  <div>
    <!-- Section header -->
    <div class="flex items-center justify-between mb-2.5">
      <p class="text-[11px] font-bold tracking-widest text-muted uppercase">
        Equipped
      </p>
      <span class="text-xs text-muted tabular-nums">
        {{ store.equippedBadges.length }}/{{ store.badgeSlotLimit }}
      </span>
    </div>

    <!-- Slot grid -->
    <ClientOnly>
      <!-- DnD-enabled slot grid (client only; SortableJS is browser-only) -->
      <VueDraggable
        v-model="slotsModel"
        :group="{ name: 'badges-dnd', pull: false, put: true }"
        filter=".badge-slot-empty"
        :prevent-on-filter="false"
        :animation="150"
        :delay="100"
        :delay-on-touch-only="true"
        class="grid grid-cols-3 gap-3"
        @add="onDropFromGrid"
        @update="onSlotsUpdate"
      >
        <button
          v-for="(slot, i) in slotsModel"
          :key="i"
          type="button"
          class="relative aspect-square w-full rounded-xl flex items-center justify-center transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 active:scale-95"
          :class="[
            slot ? 'badge-slot-occupied' : 'badge-slot-empty',
            selectedSlot === (i + 1)
              ? 'ring-2 ring-primary-500 bg-primary-500/10 border-2 border-primary-500'
              : slot
                ? 'bg-elevated/50 border border-muted-400/20'
                : 'bg-elevated/30 border-2 border-dashed border-muted-400/40 hover:border-muted-400/70',
          ]"
          :aria-label="slot ? `Slot ${i + 1}: equipped` : `Empty slot ${i + 1}`"
          @click="emit('slotClick', i + 1)"
        >
          <template v-if="slot">
            <NuxtImg
              :src="slotImageUrl(slot.image_url)"
              :alt="`Slot ${i + 1}`"
              class="size-14 object-contain"
            />
            <span class="absolute bottom-1 right-1.5 text-[9px] font-bold text-muted leading-none">{{ i + 1 }}</span>
          </template>
          <template v-else>
            <div class="flex flex-col items-center gap-1">
              <UIcon name="i-lucide-plus" class="size-5 text-muted-400" />
              <span class="text-[10px] text-muted-400 font-medium">{{ i + 1 }}</span>
            </div>
          </template>
        </button>
      </VueDraggable>

      <!-- Static fallback: same visual, no DnD (shown during SSR / pre-hydration) -->
      <template #fallback>
        <div class="grid grid-cols-3 gap-3">
          <button
            v-for="(slot, i) in slotsModel"
            :key="i"
            type="button"
            class="relative aspect-square w-full rounded-xl flex items-center justify-center transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            :class="[
              selectedSlot === (i + 1)
                ? 'ring-2 ring-primary-500 bg-primary-500/10 border-2 border-primary-500'
                : slot
                  ? 'bg-elevated/50 border border-muted-400/20'
                  : 'bg-elevated/30 border-2 border-dashed border-muted-400/40',
            ]"
            :aria-label="slot ? `Slot ${i + 1}: equipped` : `Empty slot ${i + 1}`"
            @click="emit('slotClick', i + 1)"
          >
            <template v-if="slot">
              <NuxtImg
                :src="slotImageUrl(slot.image_url)"
                :alt="`Slot ${i + 1}`"
                class="size-14 object-contain"
              />
              <span class="absolute bottom-1 right-1.5 text-[9px] font-bold text-muted leading-none">{{ i + 1 }}</span>
            </template>
            <template v-else>
              <div class="flex flex-col items-center gap-1">
                <UIcon name="i-lucide-plus" class="size-5 text-muted-400" />
                <span class="text-[10px] text-muted-400 font-medium">{{ i + 1 }}</span>
              </div>
            </template>
          </button>
        </div>
      </template>
    </ClientOnly>

    <!-- Contextual action area -->
    <div v-if="selectedSlot !== null" class="mt-3 flex flex-col items-center gap-2">
      <p
        v-if="!selectedBadge && !pendingBadgeId"
        class="text-sm text-center text-muted"
      >
        Select a badge below to equip in slot {{ selectedSlot }}
      </p>
      <div v-if="showEquipButton || showUnequipButton" class="flex gap-2">
        <UButton
          v-if="showEquipButton"
          size="sm"
          color="primary"
          icon="i-lucide-check"
          @click="emit('equip')"
        >
          Equip
        </UButton>
        <UButton
          v-if="showUnequipButton"
          size="sm"
          color="neutral"
          variant="outline"
          icon="i-lucide-x"
          @click="emit('unequip')"
        >
          Unequip
        </UButton>
      </div>
    </div>
  </div>
</template>

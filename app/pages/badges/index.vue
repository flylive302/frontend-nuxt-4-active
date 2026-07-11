<script setup lang="ts">
// ========================================
// Imports
// ========================================

import { VueDraggable } from 'vue-draggable-plus'
import BadgeCard from '~/components/badges/BadgeCard.vue'
import BadgeEquipSlots from '~/components/badges/BadgeEquipSlots.vue'
import { assembleBadgeCatalog } from '~/utils/badgeCatalog'
import type { CatalogBadgeEntry } from '~/types/progression/badge'

// ========================================
// Page Configuration
// ========================================

definePageMeta({
  layout: 'alt',
  middleware: 'auth',
})

// ========================================
// Store + Composables
// ========================================

const badgesStore = useBadgesStore()
const { fetchCatalog, fetchUserBadges } = useBadgeData()
const { equip, unequip, reorder } = useBadgeActions()

// ========================================
// Equip Selection State (page-local, transient)
// ========================================

const selectedSlot = ref<number | null>(null)
const pendingBadgeId = ref<number | null>(null)

// ========================================
// Computed
// ========================================

const isLoading = computed(
  () => badgesStore.catalog.loading || badgesStore.userBadges.loading,
)

const equippedBadgeIds = computed(() =>
  badgesStore.equippedBadges.map(e => e.badge_id),
)

const catalogGrid = computed(() =>
  assembleBadgeCatalog(
    badgesStore.catalog.items,
    badgesStore.userBadges.items,
    equippedBadgeIds.value,
  ),
)

// True when user has tapped an empty slot and we're waiting for a badge selection
const isSelectingBadge = computed(() => {
  if (selectedSlot.value === null) return false
  return !badgesStore.equippedBadges.find(e => e.slot_position === selectedSlot.value)
})

// ========================================
// Grid model for VueDraggable (client-only)
// ========================================

// Separate ref so VueDraggable has a writable model; synced from the computed catalogGrid.
// pull:'clone' + put:false + sort:false means VueDraggable never mutates this array.
const gridModel = ref<CatalogBadgeEntry[]>([])
watch(catalogGrid, (grid) => { gridModel.value = [...grid] }, { immediate: true })

// ========================================
// Click Handlers
// ========================================

function onSlotClick(slotPos: number): void {
  if (selectedSlot.value === slotPos) {
    selectedSlot.value = null
    pendingBadgeId.value = null
    return
  }
  selectedSlot.value = slotPos
  pendingBadgeId.value = null
}

function onBadgeSelect(badgeId: number): void {
  if (!isSelectingBadge.value) return
  pendingBadgeId.value = pendingBadgeId.value === badgeId ? null : badgeId
}

async function onEquip(): Promise<void> {
  if (selectedSlot.value === null || pendingBadgeId.value === null) return
  await equip(selectedSlot.value, pendingBadgeId.value)
  selectedSlot.value = null
  pendingBadgeId.value = null
}

async function onUnequip(): Promise<void> {
  if (selectedSlot.value === null) return
  await unequip(selectedSlot.value)
  selectedSlot.value = null
}

// ========================================
// Drag Handlers (same equip/reorder actions as click flow)
// ========================================

async function onDropFromGrid(slotPos: number, badgeId: number): Promise<void> {
  await equip(slotPos, badgeId)
  selectedSlot.value = null
  pendingBadgeId.value = null
}

async function onReorderSlots(fromSlot: number, toSlot: number): Promise<void> {
  // Swap if the target slot is occupied; move (equip) if the target is empty.
  const toOccupied = badgesStore.equippedBadges.find(e => e.slot_position === toSlot)
  if (toOccupied) {
    await reorder(fromSlot, toSlot)
  } else {
    const fromBadge = badgesStore.equippedBadges.find(e => e.slot_position === fromSlot)
    if (fromBadge) await equip(toSlot, fromBadge.badge_id)
  }
  selectedSlot.value = null
  pendingBadgeId.value = null
}

// ========================================
// Lifecycle
// ========================================

onMounted(async () => {
  await Promise.all([
    fetchCatalog(true),
    fetchUserBadges(true),
  ])
})
</script>

<template>
  <main>
    <NavAlt color="secondary" back-to="/profile">Badges</NavAlt>

    <div class="px-3 mt-14 mb-32 overflow-hidden">
      <!-- Equip Slots Row (DnD handled inside via ClientOnly + VueDraggable) -->
      <div class="mb-4">
        <BadgeEquipSlots
          :selected-slot="selectedSlot"
          :pending-badge-id="pendingBadgeId"
          @slot-click="onSlotClick"
          @equip="onEquip"
          @unequip="onUnequip"
          @drop-from-grid="onDropFromGrid"
          @reorder-slots="onReorderSlots"
        />
      </div>

      <!-- Loading State -->
      <div v-if="isLoading && catalogGrid.length === 0" class="grid grid-cols-3 gap-2">
        <div v-for="i in 9" :key="i" class="animate-pulse bg-elevated rounded-lg aspect-square" />
      </div>

      <!-- Empty State -->
      <div v-else-if="catalogGrid.length === 0" class="py-16 text-center">
        <UIcon name="i-lucide-award" class="size-16 mx-auto text-muted mb-4" />
        <p class="text-lg font-semibold">No Badges Available</p>
        <p class="text-sm text-muted mt-1">Check back later for new badges!</p>
      </div>

      <!-- Unified Badge Grid -->
      <template v-else>
        <!-- Section divider -->
        <div class="flex items-center gap-3 mb-3">
          <div class="h-px flex-1 bg-muted-400/20" />
          <p class="text-[11px] font-bold tracking-widest text-muted uppercase">My Badges</p>
          <div class="h-px flex-1 bg-muted-400/20" />
        </div>

        <!-- Client: DnD-enabled grid (badges can be dragged into equip slots) -->
        <ClientOnly>
          <VueDraggable
            v-model="gridModel"
            :group="{ name: 'badges-dnd', pull: 'clone', put: false }"
            :sort="false"
            filter=".badge-locked, .badge-expired"
            :prevent-on-filter="false"
            :animation="150"
            :delay="100"
            :delay-on-touch-only="true"
            class="grid grid-cols-3 gap-3"
          >
            <BadgeCard
              v-for="entry in gridModel"
              :key="entry.badge.id"
              :class="{ 'badge-locked': entry.isLocked, 'badge-expired': entry.status === 'expired' }"
              :badge="entry.badge"
              :count="entry.count"
              :is-locked="entry.isLocked"
              :status="entry.status"
              :active-count="entry.activeCount"
              :days-remaining="entry.daysRemaining"
              :selectable="isSelectingBadge && !entry.isLocked && entry.status !== 'expired'"
              :selected="pendingBadgeId === entry.badge.id"
              @select="onBadgeSelect"
            />
          </VueDraggable>
          <!-- Fallback: same grid without DnD (SSR / pre-hydration) -->
          <template #fallback>
            <div class="grid grid-cols-3 gap-3">
              <BadgeCard
                v-for="entry in catalogGrid"
                :key="entry.badge.id"
                :badge="entry.badge"
                :count="entry.count"
                :is-locked="entry.isLocked"
                :status="entry.status"
                :active-count="entry.activeCount"
                :days-remaining="entry.daysRemaining"
                :selectable="isSelectingBadge && !entry.isLocked && entry.status !== 'expired'"
                :selected="pendingBadgeId === entry.badge.id"
                @select="onBadgeSelect"
              />
            </div>
          </template>
        </ClientOnly>
      </template>

      <!-- Loading More -->
      <div v-if="isLoading && catalogGrid.length > 0" class="py-4 text-center">
        <UIcon name="i-lucide-loader-2" class="size-6 animate-spin" />
      </div>
    </div>
  </main>
</template>

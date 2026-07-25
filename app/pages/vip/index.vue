<script setup lang="ts">
import { ASSETS, vipUIAssetBase } from '~/constants/assets'
// ========================================
// VIP Page
// ========================================
// API-driven VIP membership page with level browsing,
// purchase, gift, prop previews, recharge progress,
// and congratulations modal.

import type { VipLevel, VipPreviewItem, VipProp, VipTileItem } from '~/types/vip/vip-level'
import type { MinimalUser } from '~/types/user/bootstrap'
import { VIP_PRIVILEGE_LABELS, VIP_PRIVILEGE_ICONS } from '~/types/vip/vip-level'
import { vipCongratsEvent } from '~/utils/vip-congrats-event'

// ========================================
// Page Configuration
// ========================================

definePageMeta({
  middleware: 'auth',
})

// ========================================
// Constants
// ========================================

/**
 * Privileges that correspond to props (shown as thumbnails, not icons).
 * These are filtered out of the privilege icon grid.
 */
const PROP_PRIVILEGE_KEYS = new Set([
  'frame',
  'data_card',
  'chat_bubble',
  'entry_slide',
  'mice_wave',
])

// ========================================
// Composables
// ========================================

const { currentLevel, isVip, expiresAt, fetchLevels, purchaseVip, giftVip, normalizeError } = useVip()
const bootstrapStore = useBootstrapStore()

// ========================================
// State
// ========================================

// Note: levels & activeIndex declared below, preloader watches reactively


const levels = ref<VipLevel[]>([])
const activeIndex = ref(0)
const isLoadingLevels = ref(true)
const isPurchasing = ref(false)
const isGiftModalOpen = ref(false)

// Preload all VIP animation assets (SVGA + VAP) into plugin caches
useVipAssetPreloader(levels, activeIndex)

// Prop/badge preview modal
const selectedPreviewItem = ref<VipPreviewItem | null>(null)
const isPropPreviewOpen = ref(false)

// Congratulations modal
const isCongratsOpen = ref(false)
const congratsLevel = ref(0)

// ========================================
// Computed
// ========================================

/**
 * Currently viewed VIP level.
 */
const activeLevel = computed(() => levels.value[activeIndex.value] ?? null)

/**
 * Background color style derived from level color.
 */
const bgColor = computed(() => ({
  backgroundColor: activeLevel.value?.color ?? '#1a1a2e',
}))

/**
 * Styled privilege box with gradient and shadow.
 */
const privilegeBoxStyle = computed(() => {
  const color = activeLevel.value?.color ?? '#1a1a2e'
  return {
    background: `linear-gradient(to bottom right, rgba(255, 255, 255, 0.1), ${color})`,
    borderColor: color,
  }
})

/**
 * Whether the user already owns the currently viewed level.
 */
const ownsActiveLevel = computed(() =>
  activeLevel.value
    ? currentLevel.value >= activeLevel.value.level
    : false,
)

/**
 * Purchase button label — "Extend" if user already has VIP, "OWN" otherwise.
 */
const purchaseLabel = computed(() => {
  if (!activeLevel.value) return 'OWN'
  if (ownsActiveLevel.value) return 'Extend'
  return 'OWN'
})

/**
 * Formatted price for the active level.
 */
const formattedPrice = computed(() => {
  if (!activeLevel.value) return ''
  return `${activeLevel.value.price.toLocaleString()} / ${activeLevel.value.duration_days} Days`
})

/**
 * Formatted expiry date for user's VIP.
 */
const formattedExpiry = computed(() => {
  if (!expiresAt.value) return null
  return new Date(expiresAt.value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
})

/**
 * Entry animation prop for the active level (if any).
 */
const entryAnimationProp = computed(() =>
  (activeLevel.value?.props ?? []).find(p => p.type === 'entry_animation') ?? null,
)

/**
 * VIP props for the active level (excluding entry_animation, shown separately).
 */
const activeLevelProps = computed(() =>
  (activeLevel.value?.props ?? []).filter(p => p.type !== 'entry_animation'),
)

/**
 * Badges granted by the active level (API already scopes these to the level's own badges).
 */
const activeLevelBadges = computed(() => activeLevel.value?.badges ?? [])

/**
 * Merged prop + badge tiles rendered together in the "VIP Props" grid.
 * Badges are not props — this is purely a display-level merge.
 */
const activeLevelTiles = computed<VipTileItem[]>(() => [
  ...activeLevelProps.value.map((prop): VipTileItem => ({ kind: 'prop', data: prop })),
  ...activeLevelBadges.value.map((badge): VipTileItem => ({ kind: 'badge', data: badge })),
])

/**
 * Privileges that are NOT prop-based (shown as icon grid).
 */
const nonPropPrivileges = computed(() =>
  (activeLevel.value?.privileges ?? []).filter(p => !PROP_PRIVILEGE_KEYS.has(p)),
)

/**
 * VIP level data for the congrats modal.
 * Props and badges are both scoped to the purchased tier's own items, matching
 * how the browse grid presents them — the grant itself stays cumulative.
 */
const congratsLevelData = computed(() => {
  const level = levels.value.find(l => l.level === congratsLevel.value)
  return {
    name: level?.name ?? `VIP ${congratsLevel.value}`,
    color: level?.color ?? '#1a1a2e',
    props: level?.props ?? [],
    badges: level?.badges ?? [],
  }
})

// ========================================
// Data Fetching
// ========================================

async function loadLevels() {
  isLoadingLevels.value = true

  try {
    levels.value = await fetchLevels()

    // Set active to user's current level if they have one
    if (currentLevel.value > 0) {
      const idx = levels.value.findIndex(l => l.level === currentLevel.value)
      if (idx >= 0) activeIndex.value = idx
    }
  }
  catch (err) {
    const error = normalizeError(err)
    useToast().add({
      title: 'Failed to load VIP levels',
      description: error.message,
      color: 'error',
    })
  }
  finally {
    isLoadingLevels.value = false
  }
}

// ========================================
// Handlers
// ========================================

function setActiveLevel(index: number) {
  activeIndex.value = index
}

async function handlePurchase() {
  if (!activeLevel.value || isPurchasing.value) return
  isPurchasing.value = true

  try {
    await purchaseVip(activeLevel.value.id)
    useToast().add({
      title: 'VIP Purchased! 🎉',
      description: `You are now VIP ${activeLevel.value.level}!`,
      color: 'success',
    })
  }
  catch (err) {
    const error = normalizeError(err)
    useToast().add({
      title: 'Purchase Failed',
      description: error.message,
      color: 'error',
    })
  }
  finally {
    isPurchasing.value = false
  }
}

function handleGiftOpen() {
  isGiftModalOpen.value = true
}

async function handleGiftConfirm(recipient: MinimalUser) {
  if (!activeLevel.value) return
  isGiftModalOpen.value = false

  try {
    await giftVip(activeLevel.value.id, recipient.id)
    useToast().add({
      title: 'VIP Gifted! 🎁',
      description: `VIP ${activeLevel.value.level} gifted to ${recipient.name}!`,
      color: 'success',
    })
  }
  catch (err) {
    const error = normalizeError(err)
    useToast().add({
      title: 'Gift Failed',
      description: error.message,
      color: 'error',
    })
  }
}

function handlePropPreview(prop: VipProp) {
  selectedPreviewItem.value = { kind: 'prop', data: prop }
  isPropPreviewOpen.value = true
}

function handleTilePreview(tile: VipTileItem) {
  selectedPreviewItem.value = tile
  isPropPreviewOpen.value = true
}

function handlePropPreviewClose() {
  isPropPreviewOpen.value = false
  selectedPreviewItem.value = null
}

function handleCongratsClose() {
  isCongratsOpen.value = false
}

// ========================================
// Lifecycle
// ========================================

onMounted(() => {
  loadLevels()
})

// Listen for VIP congrats events from socket
let cleanupCongrats: (() => void) | null = null

onMounted(() => {
  cleanupCongrats = vipCongratsEvent.on((newLevel: number) => {
    congratsLevel.value = newLevel
    isCongratsOpen.value = true
    // Refresh data
    loadLevels()
  })
})

onUnmounted(() => {
  cleanupCongrats?.()
})

const bootstrapVipLevel = computed(() =>
  activeLevel.value
    ? (bootstrapStore.vipLevels.find(l => l.level === activeLevel.value!.level) ?? null)
    : null
)

const flagUrl = computed(() =>
  activeLevel.value ? `${vipUIAssetBase(activeLevel.value.level)}/flag.png` : ''
)

const emblemAnimatedUrl = computed(() =>
  bootstrapVipLevel.value?.emblem_animated_url ?? ''
)

const url = computed(() => bootstrapVipLevel.value?.card_animated_url ?? '')

const isSvga = computed(() => url.value.endsWith('.svga'))

const isVap = computed(() => url.value.endsWith('.mp4'))
</script>

<template>
  <main>
    <!-- Navigation -->
    <NavAlt back-to="/profile">
      VIP
    </NavAlt>

    <!-- Loading State -->
    <div v-if="isLoadingLevels" class="flex h-full items-center justify-center">
      <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 animate-spin text-white/60" />
    </div>

    <template v-else-if="activeLevel">

      <div class="fixed w-full top-0 min-h-screen">

        <!-- User VIP Status Banner -->
        <div
            v-if="isVip"
            class="absolute w-7/8 ml-7 mt-12 z-50 px-2 flex items-center gap-2 rounded-lg bg-white/40 py-2 backdrop-blur-sm"
        >
            <UIcon name="i-heroicons-shield-check-solid" class="h-5 w-5 text-tertiary" />
            <span class="text-sm font-medium text-white">
              VIP {{ currentLevel }}
            </span>
            <span v-if="formattedExpiry" class="ml-auto text-xs font-bold text-white bg-tertiary px-2 rounded-full">
              Expires {{ formattedExpiry }}
            </span>
        </div>

        <NuxtImg :src="ASSETS.VIP_BACKGROUND" :alt="`VIP Background`" class="absolute inset-0 z-0" />
        <NuxtImg :src="flagUrl" :alt="`VIP Flag`" class="relative z-20 mx-auto mt-12 max-w-3/4" />

        <div class="relative z-20 mx-auto -mt-52 max-w-36">
          <SvgaPlayer
            :key="`vip-emblem-${activeLevel?.level}`"
            :name="emblemAnimatedUrl"
          />
        </div>

      </div>

      <div class="relative z-10 mt-58">
        <div class="sticky top-20 z-0 mx-auto overflow-hidden">
          <SvgaPlayer v-if="isSvga" :key="`vip-svga-${activeLevel?.level}`" :name="url" class="-mt-26" />
          <VapPlayer v-else-if="isVap" :key="`vip-vap-${activeLevel?.level}`" :name="url" :muted="false" class="-mt-26" />
        </div>

        <!-- Main Content -->
        <div class="absolute top-30 z-10 max-h-10/12 pb-46 overflow-y-auto">
          <div class="pt-12 px-14">
            <!-- VIP Props Section (props + badges rendered as identical tiles) -->
            <div v-if="activeLevelTiles.length > 0" class="px-3">
              <h3 class="text-xl font-bold text-white mb-2 uppercase tracking-wide text-center">VIP Props</h3>

              <!-- Entry Animation (full-width above grid) -->
              <div v-if="entryAnimationProp" @click="handlePropPreview(entryAnimationProp)">
                <NuxtImg
                    v-if="entryAnimationProp.thumbnail_url"
                    :src="entryAnimationProp.thumbnail_url"
                    :alt="entryAnimationProp.name"
                    class="shadow-xl w-full"
                />
                <p class="text-sm font-bold text-center py-2 text-white">
                  {{ entryAnimationProp.name }}
                </p>
              </div>

              <div class="grid grid-cols-3 gap-2">
                <div
                    v-for="tile in activeLevelTiles"
                    :key="`vip-tile-${activeLevel.level}-${tile.kind}-${tile.data.id}`"
                    class="flex flex-col items-center justify-center gap-2 cursor-pointer"
                    @click="handleTilePreview(tile)"
                >
                  <div
                      class="
                        flex items-center justify-center aspect-square w-full
                        rounded-md transition-all duration-300 overflow-hidden
                        backdrop-blur-xs shadow-md border
                      "
                      :style="privilegeBoxStyle"
                  >
                    <img
                        v-if="tile.kind === 'prop' ? tile.data.thumbnail_url : tile.data.icon_url"
                        :src="tile.kind === 'prop' ? tile.data.thumbnail_url! : tile.data.icon_url!"
                        :alt="tile.data.name"
                        class="w-full h-full object-contain"
                    >
                    <UIcon v-else name="i-heroicons-gift" class="h-12 text-white/90" />
                  </div>
                  <p class="text-sm font-bold text-center leading-tight truncate w-24">
                    {{ tile.data.name }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Privileges Grid (non-prop privileges) -->
            <div v-if="nonPropPrivileges.length > 0" class="px-3 pt-4">
              <h3 class="text-xl font-bold text-white mb-2 uppercase tracking-wide text-center">
                Privileges
              </h3>
              <div class="grid grid-cols-3 gap-2">
                <div
v-for="privilege in nonPropPrivileges" :key="`privilege-${activeLevel.level}-${privilege}`"
                  class="flex flex-col items-center justify-center gap-2">
                  <div
class="flex aspect-square w-full items-center justify-center rounded-md transition-all duration-300"
                    :style="privilegeBoxStyle">
                    <UIcon :name="VIP_PRIVILEGE_ICONS[privilege] ?? 'i-heroicons-star'" class="size-12 text-white/90" />
                  </div>
                  <p class="text-sm font-bold text-center leading-tight truncate w-24">
                    {{ VIP_PRIVILEGE_LABELS[privilege] ?? privilege }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </template>

    <!-- VIP Gift Modal -->
    <VipGiftModal
v-if="activeLevel" v-model:open="isGiftModalOpen" :level-name="`VIP ${activeLevel.level}`"
      :price="activeLevel.price" @confirm="handleGiftConfirm" />

    <!-- VIP Prop/Badge Preview Modal -->
    <VipPropPreviewModal :item="selectedPreviewItem" :open="isPropPreviewOpen" @close="handlePropPreviewClose" />

    <!-- VIP Congratulations Modal -->
    <VipCongratsModal
:open="isCongratsOpen" :vip-level="congratsLevel" :vip-name="congratsLevelData.name"
      :vip-color="congratsLevelData.color" :vip-props="congratsLevelData.props"
      :vip-badges="congratsLevelData.badges" @close="handleCongratsClose" />

    <!-- Footer Controls -->
    <footer aria-label="VIP Level Selection" class="fixed inset-x-0 bottom-0 pb-2 z-50 backdrop-blur-lg">
      <!-- VIP Level Tabs -->
      <div class="flex w-full overflow-x-auto scrollbar-hide">
        <UButton
v-for="(level, index) in levels" :key="`vip-tab-${level.level}`" variant="soft"
          class="min-w-fit shrink-0 rounded-none transition-transform duration-200" :style="bgColor"
          :class="activeIndex === index ? 'scale-110 bg-tertiary!' : 'to-muted'" :aria-pressed="activeIndex === index"
          :aria-label="`Select VIP Level ${level.level}`" @click="setActiveLevel(index)">
          VIP {{ level.level }}
        </UButton>
      </div>

      <div class="text-md font-bold text-white text-center">
        PRICE {{ formattedPrice }}
      </div>

      <!-- Action Buttons -->
      <div class="flex gap-2 px-3 py-2">
        <UButton
size="md" variant="soft" color="tertiary" class="w-full justify-center"
          aria-label="Gift VIP to a friend" @click="handleGiftOpen">
          Gift
        </UButton>
        <UButton
size="md" variant="solid" color="tertiary" class="w-full justify-center" :loading="isPurchasing"
          :aria-label="purchaseLabel === 'Extend' ? 'Extend VIP membership' : 'Purchase VIP membership'"
          @click="handlePurchase">
          {{ purchaseLabel }}
        </UButton>
      </div>
    </footer>
  </main>
</template>

<style scoped>
/* Hide scrollbar for VIP tabs */
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>

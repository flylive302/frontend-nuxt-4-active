<script setup lang="ts">
// ========================================
// VIP Page
// ========================================
// API-driven VIP membership page with level browsing,
// purchase, gift, prop previews, recharge progress,
// and congratulations modal.

import type { VipLevel, VipProp, RechargeProgress } from '~/types/vip/vip-level'
import type { MinimalUser } from '~/types/user/bootstrap'
import { VIP_PRIVILEGE_LABELS, VIP_PRIVILEGE_ICONS } from '~/types/vip/vip-level'
import { vipCongratsEvent } from '~/utils/vip-congrats-event'
import { createLogger } from '~/utils/logger'

const log = createLogger('[VipPage]')

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
  'badge',
  'frame',
  'chat_bubble',
  'entrance_effect',
])

// ========================================
// Composables
// ========================================

const { currentLevel, isVip, expiresAt, fetchLevels, purchaseVip, giftVip, fetchRechargeProgress, normalizeError } = useVip()

// ========================================
// State
// ========================================

// Note: levels & activeIndex declared below, preloader watches reactively


const levels = ref<VipLevel[]>([])
const activeIndex = ref(0)
const isLoadingLevels = ref(true)
const isPurchasing = ref(false)
const isGiftModalOpen = ref(false)
const rechargeProgress = ref<RechargeProgress | null>(null)

// Preload all VIP SVGA assets progressively into plugin cache
useVipSvgaPreloader(levels, activeIndex)

// Prop preview modal
const selectedProp = ref<VipProp | null>(null)
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
 * Asset base path for current level's visual assets.
 */
const assetBasePath = computed(() =>
  activeLevel.value
    ? `https://assets.flyliveapp.com/vip/${activeLevel.value.level}`
    : '',
)

/**
 * Background color style derived from level color.
 */
const bgStyle = computed(() => ({
  backgroundColor: activeLevel.value?.color ?? '#1a1a2e',
}))

/**
 * Styled privilege box with gradient and shadow.
 */
const privilegeBoxStyle = computed(() => {
  const color = activeLevel.value?.color ?? '#1a1a2e'
  return {
    background: `linear-gradient(to bottom right, rgba(255, 255, 255, 0.1), ${color})`,
    boxShadow: `0 10px 15px -3px ${color}40, 0 4px 6px -4px ${color}40`,
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
 * VIP props for the active level.
 */
const activeLevelProps = computed(() =>
  activeLevel.value?.props ?? [],
)

/**
 * Privileges that are NOT prop-based (shown as icon grid).
 */
const nonPropPrivileges = computed(() =>
  (activeLevel.value?.privileges ?? []).filter(p => !PROP_PRIVILEGE_KEYS.has(p)),
)

/**
 * VIP level data for the congrats modal.
 */
const congratsLevelData = computed(() => {
  const level = levels.value.find(l => l.level === congratsLevel.value)
  return {
    name: level?.name ?? `VIP ${congratsLevel.value}`,
    color: level?.color ?? '#1a1a2e',
    props: level?.props ?? [],
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
    log.error('Failed to fetch VIP levels', error)
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

async function loadRechargeProgress() {
  try {
    rechargeProgress.value = await fetchRechargeProgress()
  }
  catch (err) {
    log.error('Failed to fetch recharge progress', normalizeError(err))
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
  selectedProp.value = prop
  isPropPreviewOpen.value = true
}

function handlePropPreviewClose() {
  isPropPreviewOpen.value = false
  selectedProp.value = null
}

function handleCongratsClose() {
  isCongratsOpen.value = false
}

// ========================================
// Lifecycle
// ========================================

onMounted(() => {
  loadLevels()
  loadRechargeProgress()
})

// Listen for VIP congrats events from socket
let cleanupCongrats: (() => void) | null = null

onMounted(() => {
  cleanupCongrats = vipCongratsEvent.on((newLevel: number) => {
    congratsLevel.value = newLevel
    isCongratsOpen.value = true
    // Refresh data
    loadLevels()
    loadRechargeProgress()
  })
})

onUnmounted(() => {
  cleanupCongrats?.()
})
</script>

<template>
  <main class="h-screen relative overflow-hidden" :style="bgStyle">
    <!-- Navigation -->
    <NavAlt back-to="/profile">
      VIP
    </NavAlt>

    <!-- Loading State -->
    <div v-if="isLoadingLevels" class="flex h-full items-center justify-center">
      <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 animate-spin text-white/60" />
    </div>

    <template v-else-if="activeLevel">
      <!-- Background Animation -->
      <SvgaPlayer :key="`vip-card-${activeLevel.level}`" :name="`${assetBasePath}/card.svga`"
        class="absolute inset-0 z-0 -mt-20 pointer-events-none" />
      <!-- User VIP Status Banner -->
      <div v-if="isVip"
        class="absolute w-7/8 ml-7 mt-18 z-10 px-2 flex items-center gap-2 rounded-lg bg-white/40 py-2 backdrop-blur-sm">
        <UIcon name="i-heroicons-shield-check-solid" class="h-5 w-5 text-amber-400" />
        <span class="text-sm font-medium text-white">
          VIP {{ currentLevel }}
        </span>
        <span v-if="formattedExpiry" class="ml-auto text-xs font-bold text-white bg-tertiary px-2 rounded-full">
          Expires {{ formattedExpiry }}
        </span>
      </div>

      <!-- Main Content -->
      <div class="relative z-10 overflow-y-auto mt-24">
        <!-- VIP Header Section -->
        <div class="flex px-3">
          <!-- Badge Section (3/8 width) -->
          <div class="flex w-[40%] flex-col items-center justify-center">
            <NuxtImg :src="`${assetBasePath}/badge.webp`" :alt="`VIP ${activeLevel.level} Badge`" loading="lazy"
              format="webp" class="w-full h-auto" />
            <h2 class="text-lg font-bold mt-2">
              {{ activeLevel.privileges.length }} Privileges
            </h2>
          </div>

          <!-- Emblem Section (5/8 width) -->
          <div class="flex w-[60%] flex-col items-center justify-center">
            <SvgaPlayer :key="`vip-emblem-${activeLevel.level}`" :name="`${assetBasePath}/emblem.svga`"
              class="w-full h-auto" />
          </div>
        </div>

        <!-- Border Image -->
        <NuxtImg :src="`${assetBasePath}/border.webp`" :alt="`VIP ${activeLevel.level} Border Decoration`"
          class="w-full h-auto" loading="lazy" format="webp" />

        <div class="overflow-scroll h-[42vh] pb-32">
          <!-- Recharge Progress -->
          <div v-if="rechargeProgress?.has_active_event" class="px-3 pt-3">
            <VipRechargeProgress :progress="rechargeProgress" :level-color="activeLevel.color" />
          </div>
          <!-- VIP Props Section -->
          <div v-if="activeLevelProps.length > 0" class="px-3">
            <h3 class="text-sm font-bold text-white/70 mb-2 uppercase tracking-wide">
              VIP Props
            </h3>
            <div class="grid grid-cols-3 gap-2">
              <div v-for="prop in activeLevelProps" :key="`vip-prop-${activeLevel.level}-${prop.id}`"
                class="flex flex-col items-center justify-center gap-2 cursor-pointer" @click="handlePropPreview(prop)">
                <div
                  class="flex aspect-square w-full items-center justify-center rounded-md px-2 ring-2 transition-all duration-300 overflow-hidden"
                  :style="privilegeBoxStyle">
                  <img v-if="prop.thumbnail_url" :src="prop.thumbnail_url" :alt="prop.name"
                    class="w-full h-full object-contain">
                  <UIcon v-else name="i-heroicons-gift" class="h-8 w-8 text-white/90" />
                </div>
                <p class="text-sm font-bold text-center leading-tight">
                  {{ prop.name }}
                </p>
              </div>
            </div>
          </div>

          <!-- Privileges Grid (non-prop privileges) -->
          <div v-if="nonPropPrivileges.length > 0" class="px-3 pt-4">
            <h3 class="text-sm font-bold text-white/70 mb-2 uppercase tracking-wide">
              Privileges
            </h3>
            <div class="grid grid-cols-3 gap-2">
              <div v-for="privilege in nonPropPrivileges" :key="`privilege-${activeLevel.level}-${privilege}`"
                class="flex flex-col items-center justify-center gap-2">
                <div
                  class="flex aspect-square w-full items-center justify-center rounded-md px-2 ring-2 transition-all duration-300"
                  :style="privilegeBoxStyle">
                  <UIcon :name="VIP_PRIVILEGE_ICONS[privilege] ?? 'i-heroicons-star'" class="h-8 w-8 text-white/90" />
                </div>
                <p class="text-sm font-bold text-center leading-tight">
                  {{ VIP_PRIVILEGE_LABELS[privilege] ?? privilege }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Controls -->
      <footer aria-label="VIP Level Selection" class="fixed inset-x-2 bottom-4 z-50">
        <BgGlass class="border border-white/40" frost-blur-radius="blur(8px)" :noise-frequency="0.009"
          :noise-strength="200" rounded="rounded-lg">
          <!-- VIP Level Tabs -->
          <div class="flex w-full overflow-x-auto scrollbar-hide">
            <UButton v-for="(level, index) in levels" :key="`vip-tab-${level.level}`" variant="soft"
              class="min-w-fit shrink-0 rounded-none bg-linear-to-b transition-transform duration-200"
              :class="activeIndex === index ? 'scale-110 to-tertiary' : 'to-muted'"
              :aria-pressed="activeIndex === index" :aria-label="`Select VIP Level ${level.level}`"
              @click="setActiveLevel(index)">
              VIP {{ level.level }}
            </UButton>
          </div>

          <div class="text-md font-bold text-white text-center">
            PRICE {{ formattedPrice }}
          </div>

          <!-- Action Buttons -->
          <div class="flex gap-2 px-3 py-2">
            <UButton size="md" variant="soft" color="tertiary" class="w-full justify-center"
              aria-label="Gift VIP to a friend" @click="handleGiftOpen">
              Gift
            </UButton>
            <UButton size="md" variant="solid" color="tertiary" class="w-full justify-center" :loading="isPurchasing"
              :aria-label="purchaseLabel === 'Extend' ? 'Extend VIP membership' : 'Purchase VIP membership'"
              @click="handlePurchase">
              {{ purchaseLabel }}
            </UButton>
          </div>
        </BgGlass>
      </footer>
    </template>

    <!-- VIP Gift Modal -->
    <VipGiftModal v-if="activeLevel" v-model:open="isGiftModalOpen" :level-name="`VIP ${activeLevel.level}`"
      :price="activeLevel.price" @confirm="handleGiftConfirm" />

    <!-- VIP Prop Preview Modal -->
    <VipPropPreviewModal :prop="selectedProp" :open="isPropPreviewOpen" @close="handlePropPreviewClose" />

    <!-- VIP Congratulations Modal -->
    <VipCongratsModal :open="isCongratsOpen" :vip-level="congratsLevel" :vip-name="congratsLevelData.name"
      :vip-color="congratsLevelData.color" :vip-props="congratsLevelData.props" @close="handleCongratsClose" />
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

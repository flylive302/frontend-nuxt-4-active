<script setup lang="ts">
// ========================================
// VIP Prop/Badge Preview Modal
// ========================================
// View-only modal for previewing VIP props and badges with animation.

import type { VipPreviewItem } from '~/types/vip/vip-level'

// ========================================
// Props & Emits
// ========================================

defineOptions({ name: 'VipPropPreviewModal' })

const props = defineProps<{
  item: VipPreviewItem | null
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

// ========================================
// Stores
// ========================================

const authStore = useAuthStore()

// ========================================
// Computed
// ========================================

/**
 * Whether this is a frame type prop.
 */
const isFrame = computed(() => props.item?.kind === 'prop' && props.item.data.type === 'frame')

/**
 * Display name for the current preview item.
 */
const itemName = computed(() => props.item?.data.name ?? '')

/**
 * Catalog prop id for the frame overlay (only present for kind === 'prop').
 */
const frameId = computed(() => (props.item?.kind === 'prop' ? props.item.data.id : undefined))

/**
 * Animated asset URL — prop's `asset_url` or badge's `animated_url`.
 */
const animatedUrl = computed(() => {
  if (!props.item) return null
  return props.item.kind === 'prop' ? props.item.data.asset_url : props.item.data.animated_url
})

/**
 * Static thumbnail — prop's `thumbnail_url` or badge's `icon_url`.
 */
const thumbnailUrl = computed(() => {
  if (!props.item) return null
  return props.item.kind === 'prop' ? props.item.data.thumbnail_url : props.item.data.icon_url
})

/**
 * Footer label depending on item kind.
 */
const exclusiveLabel = computed(() =>
  props.item?.kind === 'badge' ? 'VIP Exclusive Badge' : 'VIP Exclusive Prop',
)

// ========================================
// Handlers
// ========================================

function handleClose(): void {
  emit('close')
}
</script>

<template>
  <UModal
    :open="open"
    :ui="{
      overlay: 'bg-black/70 backdrop-blur-xs',
    }"
    @update:open="(val) => !val && handleClose()"
  >
    <template #content>
      <UCard v-if="item" class="bg-surface">
        <!-- Header -->
        <template #header>
          <div class="flex items-center justify-between">
            <span class="text-lg font-bold">{{ itemName }}</span>
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="handleClose"
            />
          </div>
        </template>

        <!-- Preview -->
        <div class="flex items-center justify-center py-4">
          <div class="max-w-60">
            <!-- Frame: UserAvatar with frame overlay -->
            <template v-if="isFrame">
              <UserAvatar
                :animated="true"
                :frame-id="frameId"
                :user-name="authStore.user?.name"
                :frame-asset-url="animatedUrl ?? undefined"
                :img="authStore?.user?.avatar ?? undefined"
              />
            </template>

            <!-- Animated / static asset (svga · vap · video · image) -->
            <template v-else-if="animatedUrl">
              <div class="bg-accented rounded-xl overflow-hidden flex items-center justify-center max-h-100">
                <AssetPlayer
                  class="relative min-w-full z-10"
                  :src="animatedUrl"
                  :thumbnail-src="thumbnailUrl ?? undefined"
                  :muted="false"
                />
              </div>
            </template>

            <!-- Thumbnail-only fallback -->
            <template v-else-if="thumbnailUrl">
              <img
                :src="thumbnailUrl"
                :alt="itemName"
                class="w-full h-auto object-contain rounded-xl"
              >
            </template>

            <!-- Icon fallback -->
            <template v-else>
              <div class="aspect-square bg-muted/20 rounded-xl flex items-center justify-center">
                <UIcon name="i-heroicons-gift" class="size-16 text-white/40" />
              </div>
            </template>
          </div>
        </div>

        <!-- Footer: VIP exclusive badge -->
        <template #footer>
          <div class="flex items-center justify-center gap-2 text-amber-400 text-sm">
            <UIcon name="i-heroicons-shield-check-solid" class="size-4" />
            <span class="font-medium">{{ exclusiveLabel }}</span>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>

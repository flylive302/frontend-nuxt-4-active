<script setup lang="ts">
// ========================================
// VIP Prop Preview Modal
// ========================================
// View-only modal for previewing VIP props with SVGA animation.

import type { VipProp } from '~/types/vip/vip-level'

// ========================================
// Props & Emits
// ========================================

defineOptions({ name: 'VipPropPreviewModal' })

const props = defineProps<{
  prop: VipProp | null
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
const isFrame = computed(() => props.prop?.type === 'frame')

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
      <UCard v-if="prop" class="bg-surface">
        <!-- Header -->
        <template #header>
          <div class="flex items-center justify-between">
            <span class="text-lg font-bold">{{ prop.name }}</span>
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
                :frame-name="prop.name"
                :frame-asset-url="prop.asset_url ?? undefined"
                :img="authStore?.user?.avatar ?? undefined"
              />
            </template>

            <!-- Animated / static asset (svga · vap · video · image) -->
            <template v-else-if="prop.asset_url">
              <div class="bg-accented rounded-xl overflow-hidden flex items-center justify-center max-h-100">
                <AssetPlayer
                  class="relative min-w-full z-10"
                  :src="prop.asset_url"
                  :thumbnail-src="prop.thumbnail_url ?? undefined"
                  :muted="false"
                />
              </div>
            </template>

            <!-- Thumbnail-only fallback -->
            <template v-else-if="prop.thumbnail_url">
              <img
                :src="prop.thumbnail_url"
                :alt="prop.name"
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
            <span class="font-medium">VIP Exclusive Prop</span>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>

<script setup lang="ts">
// ========================================
// Prop Preview Modal (shared)
// ========================================
// Generic view-only preview for props and gifts: frames render on the
// viewer's avatar, animated assets via AssetPlayer, otherwise thumbnail.

import type { PropPreviewItem } from '~/types/user/user-profile'

// ========================================
// Props & Emits
// ========================================

defineOptions({ name: 'PropPreviewModal' })

const props = withDefaults(defineProps<{
  item: PropPreviewItem | null
  open: boolean
  /** Optional footer label (e.g. "VIP Exclusive Prop"); hidden when empty */
  footerText?: string
}>(), {
  footerText: '',
})

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
const isFrame = computed(() => props.item?.type === 'frame')

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
            <span class="text-lg font-bold">{{ item.name }}</span>
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
                :frame-id="item.prop_id ?? undefined"
                :frame-asset-url="item.asset_url ?? undefined"
                :img="authStore?.user?.avatar ?? undefined"
              />
            </template>

            <!-- Animated / static asset (svga · vap · video · image) -->
            <template v-else-if="item.asset_url">
              <div class="bg-accented rounded-xl overflow-hidden flex items-center justify-center max-h-100">
                <AssetPlayer
                  class="relative min-w-full z-10"
                  :src="item.asset_url"
                  :thumbnail-src="item.thumbnail_url ?? undefined"
                  :muted="false"
                />
              </div>
            </template>

            <!-- Thumbnail-only fallback -->
            <template v-else-if="item.thumbnail_url">
              <img
                :src="item.thumbnail_url"
                :alt="item.name"
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

        <!-- Footer: optional label -->
        <template v-if="footerText" #footer>
          <div class="flex items-center justify-center gap-2 text-amber-400 text-sm">
            <UIcon name="i-heroicons-shield-check-solid" class="size-4" />
            <span class="font-medium">{{ footerText }}</span>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>

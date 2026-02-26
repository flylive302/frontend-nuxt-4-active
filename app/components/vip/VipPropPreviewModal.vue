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
 * Whether the prop uses SVGA animation.
 */
const isSvgaAsset = computed(() =>
  props.prop?.asset_url?.endsWith('.svga') ?? false,
)

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

            <!-- SVGA animation: entry_animation, chat_bubble, etc -->
            <template v-else-if="isSvgaAsset">
              <div class="aspect-square bg-muted/20 rounded-xl overflow-hidden flex items-center justify-center">
                <SvgaPlayer
                  class="relative min-w-full z-10"
                  :name="prop.asset_url!"
                  height="auto"
                />
              </div>
            </template>

            <!-- Image fallback: thumbnail or asset -->
            <template v-else-if="prop.thumbnail_url || prop.asset_url">
              <img
                :src="prop.thumbnail_url ?? prop.asset_url ?? ''"
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

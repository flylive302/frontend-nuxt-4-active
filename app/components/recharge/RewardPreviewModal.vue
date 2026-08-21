<script setup lang="ts">
import type { RewardType } from '~/types/mission/recharge'
import type { ResolvedRewardAsset } from '~/utils/mission/resolveRewardAsset'
import type { PropType } from '~/types/mall/prop'

// ========================================
// Props & Emits
// ========================================

defineOptions({ name: 'RechargeRewardPreviewModal' })

const props = defineProps<{
  open: boolean
  rewardType: RewardType | null
  resolved: ResolvedRewardAsset | null
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

const isProp = computed(() => props.rewardType === 'prop')
const isVip = computed(() => props.rewardType === 'vip')

/**
 * Mice-wave renders as a ring, not the SVGA `asset_url` — so unlike other
 * prop types it doesn't need `resolved.assetUrl` to be truthy to preview.
 */
const isMiceWave = computed(() => isProp.value && props.resolved?.propType === 'mice_wave')
</script>

<template>
  <UModal
    :open="open"
    :ui="{ overlay: 'bg-black/70 backdrop-blur-xs' }"
    @update:open="(val) => !val && emit('close')"
  >
    <template #content>
      <UCard v-if="resolved" class="bg-surface">
        <!-- Header -->
        <template #header>
          <div class="flex items-center justify-between">
            <span class="text-base font-bold text-white">{{ resolved.name }}</span>
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="emit('close')"
            />
          </div>
        </template>

        <!-- Content -->
        <div class="flex items-center justify-center py-4">
          <div class="max-w-60 w-full">
            <!-- Prop: delegate to MallPropAssetView which handles all prop types -->
            <template v-if="isMiceWave || (isProp && resolved.propType && resolved.assetUrl)">
              <MallPropAssetView
                :type="(resolved.propType as PropType)"
                :name="resolved.name"
                :asset-url="resolved.assetUrl ?? ''"
                :thumbnail-url="resolved.thumbnailUrl ?? ''"
                :prop-id="resolved.propId"
                :metadata="resolved.metadata"
                :avatar-img="authStore.user?.avatar ?? undefined"
              />
            </template>

            <!-- VIP: play card animation -->
            <template v-else-if="isVip && resolved.assetUrl">
              <div class="bg-accented rounded-xl overflow-hidden flex items-center justify-center max-h-100">
                <AssetPlayer
                  class="relative min-w-full z-10"
                  :src="resolved.assetUrl"
                  :thumbnail-src="resolved.thumbnailUrl ?? undefined"
                  :muted="false"
                />
              </div>
            </template>

            <!-- Badge / static fallback -->
            <template v-else-if="resolved.thumbnailUrl">
              <img
                :src="resolved.thumbnailUrl"
                :alt="resolved.name"
                class="w-full h-auto object-contain rounded-xl"
              >
            </template>
          </div>
        </div>
      </UCard>
    </template>
  </UModal>
</template>

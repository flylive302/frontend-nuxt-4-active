<script setup lang="ts">
// ========================================
// VIP Congratulations Modal
// ========================================
// Full-screen modal celebrating VIP achievement.
// Shows VIP badge animation and unlocked props.

import type { VipProp } from '~/types/vip/vip-level'

// ========================================
// Props & Emits
// ========================================

defineOptions({ name: 'VipCongratsModal' })

const props = defineProps<{
  open: boolean
  vipLevel: number
  vipName: string
  vipColor: string
  vipProps: VipProp[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

// ========================================
// Computed
// ========================================

/**
 * Asset base path for VIP level animations.
 */
const assetBasePath = computed(() =>
  `https://assets.flyliveapp.com/vip/${props.vipLevel}`,
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
    fullscreen
    @update:open="(val) => !val && handleClose()"
  >
    <template #content>
      <div
        class="relative flex h-full flex-col items-center justify-center px-6 py-8"
        :style="{ backgroundColor: vipColor }"
      >
        <!-- Close -->
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="lg"
          class="absolute top-4 right-4 z-20 text-white"
          @click="handleClose"
        />

        <!-- VIP Badge Animation -->
        <div class="relative z-10 w-48 h-48 mb-4">
          <SvgaPlayer
            :key="`congrats-badge-${vipLevel}`"
            :name="`${assetBasePath}/emblem.svga`"
            class="w-full h-full"
          />
        </div>

        <!-- Congratulations Text -->
        <div class="relative z-10 text-center space-y-2 mb-6">
          <h1 class="text-3xl font-black text-white drop-shadow-lg">
            🎉 Congratulations! 🎉
          </h1>
          <p class="text-xl font-bold text-white/90">
            You've unlocked {{ vipName }}!
          </p>
        </div>

        <!-- Unlocked Props -->
        <div
          v-if="vipProps.length > 0"
          class="relative z-10 w-full max-w-sm"
        >
          <p class="text-center text-sm font-medium text-white/70 mb-3">
            Your VIP Props
          </p>
          <div class="grid grid-cols-3 gap-3">
            <div
              v-for="vipProp in vipProps"
              :key="vipProp.id"
              class="flex flex-col items-center gap-1.5"
            >
              <div class="w-full aspect-square rounded-lg bg-white/10 overflow-hidden flex items-center justify-center p-1">
                <img
                  v-if="vipProp.thumbnail_url"
                  :src="vipProp.thumbnail_url"
                  :alt="vipProp.name"
                  class="w-full h-full object-contain"
                >
                <UIcon
                  v-else
                  name="i-heroicons-gift"
                  class="size-8 text-white/40"
                />
              </div>
              <span class="text-xs text-white/80 text-center leading-tight font-medium">
                {{ vipProp.name }}
              </span>
            </div>
          </div>
        </div>

        <!-- CTA -->
        <UButton
          size="xl"
          color="warning"
          variant="solid"
          class="relative z-10 mt-8 px-8"
          @click="handleClose"
        >
          Awesome!
        </UButton>

        <!-- Background sparkle overlay -->
        <div class="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-30">
          <SvgaPlayer
            :key="`congrats-card-${vipLevel}`"
            :name="`${assetBasePath}/card.svga`"
            class="w-full h-full"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>

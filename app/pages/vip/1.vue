<script setup lang="ts">
// ========================================
// Types & Interfaces
// ========================================

type VipLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

interface VipConfig {
  level: VipLevel
  color: string
  privileges: Array<{
    icon: string
    name: string
  }>
}

// ========================================
// Page Configuration
// ========================================

definePageMeta({
  layout: 'alt',
  middleware: 'auth',
})

// ========================================
// VIP Configuration
// ========================================

const VIP_CONFIGS: Record<VipLevel, VipConfig> = {
  1: {
    level: 1,
    color: '#1b4c57',
    privileges: [
      { icon: 'badge.png', name: 'VIP Badge' },
      { icon: 'frame.png', name: 'Profile Frame' },
      { icon: 'chat-bubble.png', name: 'Chat Bubble' },
    ],
  },
  2: {
    level: 2,
    color: '#5a441a',
    privileges: [
      { icon: 'badge.png', name: 'Elite Badge' },
      { icon: 'frame.png', name: 'Gold Frame' },
      { icon: 'chat-bubble.png', name: 'Exclusive Bubble' },
    ],
  },
  3: {
    level: 3,
    color: '#1f5e33',
    privileges: [
      { icon: 'badge.png', name: 'Premium Badge' },
      { icon: 'frame.png', name: 'Emerald Frame' },
      { icon: 'chat-bubble.png', name: 'Special Bubble' },
    ],
  },
  4: {
    level: 4,
    color: '#2a667b',
    privileges: [
      { icon: 'badge.png', name: 'Royal Badge' },
      { icon: 'frame.png', name: 'Bronze Frame' },
      { icon: 'chat-bubble.png', name: 'Luxury Bubble' },
    ],
  },
  5: {
    level: 5,
    color: '#2d1757',
    privileges: [
      { icon: 'badge.png', name: 'Noble Badge' },
      { icon: 'frame.png', name: 'Purple Frame' },
      { icon: 'chat-bubble.png', name: 'Noble Bubble' },
    ],
  },
  6: {
    level: 6,
    color: '#57195e',
    privileges: [
      { icon: 'badge.png', name: 'Supreme Badge' },
      { icon: 'frame.png', name: 'Magenta Frame' },
      { icon: 'chat-bubble.png', name: 'Supreme Bubble' },
    ],
  },
  7: {
    level: 7,
    color: '#321609',
    privileges: [
      { icon: 'badge.png', name: 'Legend Badge' },
      { icon: 'frame.png', name: 'Sapphire Frame' },
      { icon: 'chat-bubble.png', name: 'Legend Bubble' },
    ],
  },
  8: {
    level: 8,
    color: '#562913',
    privileges: [
      { icon: 'badge.png', name: 'Mythic Badge' },
      { icon: 'frame.png', name: 'Ruby Frame' },
      { icon: 'chat-bubble.png', name: 'Mythic Bubble' },
    ],
  },
}

const VIP_LEVELS: VipLevel[] = [1, 2, 3, 4, 5, 6, 7, 8]

// ========================================
// State & Computed
// ========================================

const activeVip = ref<VipLevel>(1)

const currentVipConfig = computed(() => VIP_CONFIGS[activeVip.value])

const assetBasePath = computed(() => `https://assets.flyliveapp.com/parsedAnimations/vip/${activeVip.value}`)

// Computed styles for dynamic colors
const bgStyle = computed(() => ({
  backgroundColor: currentVipConfig.value.color,
}))

const privilegeBoxStyle = computed(() => ({
  background: `linear-gradient(to bottom right, rgba(255, 255, 255, 0.1), ${currentVipConfig.value.color})`,
  boxShadow: `0 10px 15px -3px ${currentVipConfig.value.color}40, 0 4px 6px -4px ${currentVipConfig.value.color}40`,
  borderColor: currentVipConfig.value.color,
}))

// ========================================
// Methods
// ========================================

const setActiveVip = (level: VipLevel) => {
  activeVip.value = level
}
</script>

<template>
  <main class="relative h-screen py-3 transition-colors duration-300" :style="bgStyle">
    <!-- Navigation -->
    <NavAlt back-to="/profile">
      VIP
    </NavAlt>

    <!-- Background Animation -->
    <div class="absolute inset-0 z-0 overflow-hidden pointer-events-none">
      <SvgaPlayer
          :key="`vip-card-${activeVip}`"
          :name="`https://assets.flyliveapp.com/parsedAnimations/vip/${activeVip}/card.json`"
          class="-mt-22"
      />
    </div>

    <!-- Main Content -->
    <div class="relative z-10 mt-22">
      <!-- VIP Header Section -->
      <div class="flex px-3">
        <!-- Badge Section (3/8 width) -->
        <div class="flex w-[37.5%] flex-col items-center justify-center">
          <NuxtImg
              :src="`${assetBasePath}/badge.png`"
              :alt="`VIP ${activeVip} Badge`"
              loading="lazy"
              format="webp"
              class="w-full h-auto"
          />
          <h2 class="text-lg font-bold mt-2">
            15 Privileges
          </h2>
        </div>

        <!-- Emblem Section (5/8 width) -->
        <div class="flex w-[62.5%] flex-col items-center justify-center">
          <SvgaPlayer
              :key="`vip-card-${activeVip}`"
              :name="`https://assets.flyliveapp.com/parsedAnimations/vip/${activeVip}/emblem.json`"
              class="w-full h-auto"
          />
        </div>
      </div>

      <!-- Border Image -->
      <NuxtImg
          :src="`${assetBasePath}/border.png`"
          :alt="`VIP ${activeVip} Border Decoration`"
          class="w-full h-auto"
          loading="lazy"
          format="webp"
      />

      <!-- Privileges Grid -->
      <div class="grid grid-cols-3 gap-2 px-3 pt-4">
        <div
            v-for="(privilege, index) in currentVipConfig.privileges"
            :key="`privilege-${activeVip}-${index}`"
            class="flex flex-col items-center justify-center gap-2"
        >
          <div
              class="flex aspect-square w-full items-center justify-center rounded-md px-2 ring-2 transition-all duration-300"
              :style="privilegeBoxStyle"
          >
            <NuxtImg
                :src="`${assetBasePath}/${privilege.icon}`"
                :alt="privilege.name"
                loading="lazy"
                format="webp"
                class="w-full h-auto"
            />
          </div>
          <p class="text-sm font-bold text-center leading-tight">
            {{ privilege.name }}
          </p>
        </div>
      </div>
    </div>

    <!-- Footer Controls -->
    <footer
        aria-label="VIP Level Selection"
        class="fixed inset-x-2 bottom-4 z-50"
    >
      <BgGlass
          class="border border-white/40"
          frost-blur-radius="blur(8px)"
          :noise-frequency="0.009"
          :noise-strength="200"
          rounded="rounded-lg"
      >
        <!-- VIP Level Tabs -->
        <div class="flex w-full overflow-x-auto scrollbar-hide">
          <UButton
              v-for="level in VIP_LEVELS"
              :key="`vip-tab-${level}`"
              variant="soft"
              class="min-w-fit shrink-0 rounded-none bg-linear-to-b transition-transform duration-200"
              :class="activeVip === level ? 'scale-110 to-tertiary' : 'to-muted'"
              :aria-pressed="activeVip === level"
              :aria-label="`Select VIP Level ${level}`"
              @click="setActiveVip(level)"
          >
            VIP {{ level }}
          </UButton>
        </div>

        <div class="text-lg font-bold text-white text-center">PRICE 90000 / 7 Days</div>

        <!-- Action Buttons -->
        <div class="flex gap-2 px-3 py-2">
          <UButton
              size="xl"
              variant="soft"
              color="tertiary"
              class="w-full justify-center"
              aria-label="Get surprise reward"
          >
            Surprise
          </UButton>
          <UButton
              size="xl"
              variant="solid"
              color="tertiary"
              class="w-full justify-center"
              aria-label="Purchase VIP membership"
          >
            OWN
          </UButton>
        </div>
      </BgGlass>
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
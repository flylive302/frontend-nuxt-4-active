<template>
  <!-- Bottom nav, respects iOS/Android safe areas -->
  <nav
      aria-label="Primary"
      class="fixed inset-x-2 z-50"
      :style="{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)' }"
  >
    <BgGlass
        class="overflow-hidden border border-white/50 shadow-lg"
        frostBlurRadius="blur(4px)"
        :noiseFrequency="0.009"
        :noiseStrength="200"
    >
      <div class="grid grid-cols-4 items-center gap-8 px-2 touch-manipulation select-none">
        <UButton
            aria-label="Home"
            icon="i-lucide-house"
            size="xl"
            color="primary"
            variant="solid"
            class="w-full justify-center"
        />
        <UButton
            aria-label="Contacts"
            icon="i-lucide-contact-round"
            size="xl"
            color="primary"
            variant="subtle"
            class="w-full justify-center"
        />
        <UButton
            aria-label="Notifications"
            icon="i-lucide-bell-plus"
            size="xl"
            color="primary"
            variant="subtle"
            class="w-full justify-center"
        />
        <!-- Profile -->
        <button
            aria-label="Profile"
            class="justify-self-end"
        >
          <LazyAvatar class="w-13" :animated="true" />
        </button>
      </div>
    </BgGlass>

    <!-- Safe-area spacer when needed -->
    <div class="h-[env(safe-area-inset-bottom,0px)]"></div>
  </nav>
</template>

<script setup lang="ts">
// no script needed
</script>

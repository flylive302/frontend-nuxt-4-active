<script setup>
const authStore = useAuthStore();
</script>

<template>
  <footer
      aria-label="Primary"
      class="fixed inset-x-2 z-50 bottom-4"
  >
    <BgGlass
        class="border border-white/40"
        frost-blur-radius="blur(4px)"
        :noise-frequency="0.009"
        :noise-strength="200"
        rounded="rounded-lg"
    >
      <div class="grid grid-cols-4 items-center gap-8 px-2 touch-manipulation select-none">
        <UButton
            to="/"
            aria-label="Home"
            icon="i-lucide-house"
            size="xl"
            color="primary"
            variant="solid"
            class="justify-center"
        />
        <UButton
            aria-label="Contacts"
            icon="i-lucide-contact-round"
            size="xl"
            color="primary"
            variant="subtle"
            class="justify-center"
        />
        <UButton
            aria-label="Notifications"
            icon="i-lucide-bell-plus"
            size="xl"
            color="primary"
            variant="subtle"
            class="justify-center"
        />
        <!-- Profile -->
        <NuxtLink
            to="/profile"
            aria-label="Profile"
            class="justify-self-end"
        >
          <UserAvatar class="w-13" :animated="true" :img="authStore.user?.avatar?.thumbnail" />
        </NuxtLink>
      </div>
    </BgGlass>
  </footer>
</template>
<script setup lang="ts">

</script>

<template>
    <main>
        <header class="pt-2 px-3 safe-area-top flex justify-between fixed top-0 z-50 w-full">
            <UButton
                icon="i-lucide-chevron-left"
                size="md"
                variant="subtle"
                to="/"
                color="primary"
                class="rounded-lg bg-primary/30 backdrop-blur-sm text-primary"
            />

            <UButton
                icon="i-lucide-menu"
                size="md"
                to="/profile/edit"
                variant="subtle"
                color="primary"
                class="rounded-lg bg-primary/30 backdrop-blur-sm text-primary"
            />
        </header>

        <div class="h-screen overflow-hidden">
          <slot />
        </div>
    </main>
</template>
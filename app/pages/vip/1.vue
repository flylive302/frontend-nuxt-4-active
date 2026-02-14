<script setup lang="ts">

</script>

<template>
  <main>

    <NavAlt>VIP</NavAlt>

    <div class="w-full flex mt-8 overflow-x-scroll gap-1">
      <UButton variant="soft" class="rounded-none bg-linear-to-b to-tertiary-700 min-w-fit">VIP 1</UButton>
      <UButton variant="soft" class="rounded-none bg-linear-to-b to-tertiary-700 min-w-fit">VIP 2</UButton>
      <UButton variant="soft" class="rounded-none bg-linear-to-b to-tertiary-700 min-w-fit">VIP 3</UButton>
      <UButton variant="soft" class="rounded-none bg-linear-to-b to-tertiary-700 min-w-fit">VIP 4</UButton>
      <UButton variant="soft" class="rounded-none bg-linear-to-b to-tertiary-700 min-w-fit">VIP 5</UButton>
      <UButton variant="soft" class="rounded-none bg-linear-to-b to-tertiary-700 min-w-fit">VIP 6</UButton>
      <UButton variant="soft" class="rounded-none bg-linear-to-b to-tertiary-700 min-w-fit">VIP 7</UButton>
      <UButton variant="soft" class="rounded-none bg-linear-to-b to-tertiary-700 min-w-fit">VIP 8</UButton>
    </div>

    <div class="flex px-3">

      <div class="w-full flex flex-col justify-center items-center">

        <NuxtImg src="/parsedAnimations/vip/1/badge.png" />
        <h2 class="text-lg font-bold">15 Privileges</h2>

      </div>

      <div class="w-full flex flex-col justify-center items-center">
        <NuxtImg src="/parsedAnimations/vip/1/2.png" />
      </div>

    </div>

    <NuxtImg src="/parsedAnimations/vip/1/border.png" class="w-full" />

    <div class="px-3 pt-4 grid grid-cols-3 gap-2">
      <div class="elements-center gap-2">
        <div class="elements-center px-2 w-full rounded-md inset-shadow-sm inset-shadow-tertiary-800 aspect-square">
          <NuxtImg src="/parsedAnimations/vip/1/badge.png"/>
        </div>
        <p class="text-md font-bold">Vip Badge</p>
      </div>
      <div class="elements-center gap-2">
        <div class="elements-center px-2 w-full rounded-md inset-shadow-sm inset-shadow-tertiary-800 aspect-square">
          <NuxtImg src="/parsedAnimations/vip/1/frame.png"/>
        </div>
        <p class="text-md font-bold">Frame</p>
      </div>
      <div class="elements-center gap-2">
        <div class="elements-center px-2 w-full rounded-md inset-shadow-sm inset-shadow-tertiary-800 aspect-square">
          <NuxtImg src="/parsedAnimations/vip/1/chat-bubble.png"/>
        </div>
        <p class="text-md font-bold">Item Name</p>
      </div>
    </div>


    <footer
        aria-label="Primary"
        class="fixed inset-x-2 z-50 bottom-4"
    >
      <BgGlass
          class="border border-white/40"
          frost-blur-radius="blur(8px)"
          :noise-frequency="0.009"
          :noise-strength="200"
          rounded="rounded-lg"
      >
        <div class="flex gap-2 px-3 py-2">
          <UButton
              to="/"
              size="xl"
              variant="soft"
              class="justify-center w-full"
          >
            Surprise
          </UButton>
          <UButton
              size="xl"
              variant="solid"
              class="justify-center w-full"
          >
            OWN
          </UButton>
        </div>
      </BgGlass>
    </footer>
  </main>
</template>

<style scoped>
.elements-center {
  @apply flex flex-col justify-center items-center;
}
</style>
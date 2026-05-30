<script setup lang="ts">
// ProfileHeader component — encapsulates the cover / avatar / badges / name / stats layout
</script>

<template>
  <div class="relative max-w-screen">
    <div class="max-w-full overflow-hidden">
      <slot name="cover" />
    </div>

    <div class="relative z-10 -mt-6 rounded-t-4xl bg-neutral-950">
      <slot name="card" />
      <div class="flex justify-center max-w-11/12 mx-auto gap-1 relative z-10">
        <slot name="signature-badges" />

        <slot name="avatar" />

        <slot name="badges" />
      </div>

      <h1 class="text-lg font-bold text-center relative z-10 mt-3">
        <slot name="name" />
      </h1>

      <slot name="stats" />
    </div>
  </div>
</template>

<!-- ~/components/agency/income/RunViewSkeleton.vue -->
<!-- Loading placeholder shaped like the full run view: header, hero, the
     three totals cards, and a few milestone rows. -->
<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <USkeleton class="size-8 rounded-full shrink-0" />
        <div class="space-y-1">
          <USkeleton class="h-4 w-32 rounded" />
          <USkeleton class="h-3 w-24 rounded" />
        </div>
      </div>
      <USkeleton class="h-5 w-16 rounded-full" />
    </div>

    <!-- Hero -->
    <div class="py-4 space-y-2 flex flex-col items-center">
      <USkeleton class="h-3 w-16 rounded" />
      <USkeleton class="h-10 w-40 rounded" />
      <USkeleton class="h-3 w-48 rounded" />
    </div>

    <!-- Totals Cards -->
    <div class="space-y-2">
      <USkeleton class="h-14 rounded-lg" />
      <USkeleton class="h-14 rounded-lg" />
      <USkeleton class="h-14 rounded-lg" />
    </div>

    <!-- Milestone Rows -->
    <div class="space-y-2">
      <USkeleton class="h-12 rounded-lg" />
      <USkeleton class="h-12 rounded-lg" />
      <USkeleton class="h-12 rounded-lg" />
    </div>
  </div>
</template>

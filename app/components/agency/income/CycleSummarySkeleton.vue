<!-- ~/components/agency/income/CycleSummarySkeleton.vue -->
<!-- Loading placeholder shaped like one hero + its totals cards. The page
     renders this once per hero (members, then owner) while a cycle summary
     loads. -->
<template>
  <div class="space-y-2">
    <!-- Hero -->
    <div class="py-4 space-y-2 flex flex-col items-center">
      <USkeleton class="h-3 w-24 rounded" />
      <USkeleton class="h-10 w-40 rounded" />
    </div>

    <!-- Totals Cards -->
    <USkeleton class="h-14 rounded-lg" />
    <USkeleton class="h-14 rounded-lg" />
    <USkeleton class="h-14 rounded-lg" />
  </div>
</template>

<!-- ~/components/agency/income/MemberIncomeCardSkeleton.vue -->
<!-- Loading placeholder shaped like `count` MemberIncomeCard rows. -->
<script setup lang="ts">
// ========================================
// Props
// ========================================

withDefaults(defineProps<{
  count?: number
}>(), {
  count: 5,
})
</script>

<template>
  <div class="space-y-2">
    <div v-for="n in count" :key="n" class="bg-elevated rounded-lg p-3 space-y-2">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0 grow">
          <USkeleton class="size-8 rounded-full shrink-0" />
          <div class="space-y-1.5 grow">
            <USkeleton class="h-3.5 w-28 rounded" />
            <USkeleton class="h-3 w-16 rounded" />
          </div>
        </div>
        <div class="space-y-1.5 shrink-0">
          <USkeleton class="h-3 w-12 rounded ml-auto" />
          <USkeleton class="h-4 w-16 rounded" />
        </div>
      </div>
      <USkeleton class="h-3 w-full rounded" />
      <USkeleton class="h-3 w-24 rounded" />
    </div>
  </div>
</template>

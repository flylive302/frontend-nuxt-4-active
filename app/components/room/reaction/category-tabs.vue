<script setup lang="ts">
/**
 * Reaction Category Tabs — INTENT only. Horizontal scrollable strip that
 * jumps the grid to a category's sticky section header. No filtering logic
 * lives here — parent owns the active category + scroll target.
 */
defineProps<{
  categories: string[];
  activeCategory: string | null;
}>();

const emit = defineEmits<{
  select: [category: string];
}>();
</script>

<template>
  <div class="flex gap-1 overflow-x-auto overflow-y-hidden scrollbar-thin pb-1">
    <button
      v-for="category in categories"
      :key="category"
      type="button"
      class="shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors"
      :class="activeCategory === category
        ? 'bg-primary text-white'
        : 'bg-white/10 text-white/70 hover:bg-white/20'"
      @click="emit('select', category)"
    >
      {{ category }}
    </button>
  </div>
</template>

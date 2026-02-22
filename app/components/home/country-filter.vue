<script setup lang="ts">
const props = defineProps<{
  /** Selected country code, or empty string for "All" */
  modelValue: string
  /** Country codes that have at least one room */
  activeCountries: string[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

// ========================================
// Helpers
// ========================================

/** Map country code → flag icon class */
const getFlagIcon = (code: string): string => {
  const flagCode = code === 'uk' ? 'gb' : code.toLowerCase()
  return `i-flag-${flagCode}-4x3`
}
</script>

<template>

  <div class="flex items-start px-3 overflow-x-auto mb-2">
    <!-- "All" Chip -->
    <button
      class="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all duration-200"
      :class="modelValue === ''
        ? 'bg-primary text-white shadow-sm shadow-primary/30'
        : 'bg-white/8 text-white/70 hover:bg-white/12 hover:text-white'"
      @click="emit('update:modelValue', '')"
    >
      <UIcon name="i-lucide-globe" class="size-4" />
      All
    </button>

    <div class="flex items-center gap-2 px-3 pb-1 overflow-x-auto scrollbar-horizontal">

      <!-- Country Chips -->
      <button v-for="country in activeCountries" :key="country"
        class="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all duration-200"
        :class="modelValue === country
          ? 'bg-primary text-white shadow-sm shadow-primary/30'
          : 'bg-white/8 text-white/70 hover:bg-white/12 hover:text-white'" @click="emit('update:modelValue', country)">
        <UIcon :name="getFlagIcon(country)" class="size-4" />
        {{ country.toUpperCase() }}
      </button>
    </div>
  </div>
  
</template>

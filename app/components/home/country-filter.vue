<script setup lang="ts">
defineProps<{
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

  <div class="flex items-start px-3 overflow-x-auto">
    <!-- "All" Chip -->
    <button
      class="shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold transition-colors duration-200"
      :class="modelValue === ''
        ? 'bg-primary text-white'
        : 'bg-white/15 text-white ring-1 ring-white/25'"
      @click="emit('update:modelValue', '')"
    >
      <UIcon name="i-lucide-globe" class="size-5" />
      All
    </button>

    <div class="flex items-center gap-2 px-2 pb-1 overflow-x-auto scrollbar-horizontal">

      <!-- Country Chips -->
      <button v-for="country in activeCountries" :key="country"
        class="shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold transition-all duration-200"
        :class="modelValue === country
          ? 'bg-primary text-white'
          : 'bg-white/10 text-white/70 hover:bg-white/12 hover:text-white'" @click="emit('update:modelValue', country)">
        <UIcon :name="getFlagIcon(country)" class="size-5" />
        {{ country.toUpperCase() }}
      </button>
    </div>
  </div>
  
</template>

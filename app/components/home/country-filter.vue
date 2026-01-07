<script setup lang="ts">
import { useCountries } from '~/composables/useCountries'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const { countries, ensureLoaded } = useCountries()

// Load countries on mount
onMounted(() => {
  ensureLoaded()
})

// Two-way binding for selected country string ID
const selectedCountry = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

// Helper to map country code to flag icon code
const getFlagIcon = (countryCode: string) => {
  const code = countryCode.toLowerCase()
  const flagCode = code === 'uk' ? 'gb' : code
  return `i-flag-${flagCode}-4x3`
}

// Prepared options for USelectMenu (searchable)
const countryOptions = computed(() => {
  if (countries.value.length > 0) {
    return countries.value.map(c => ({
      id: c.code.toLowerCase(),
      label: c.name,
      icon: getFlagIcon(c.code),
      code: c.code.toLowerCase()
    }))
  }
  // Fallback while loading
  const fallbackCodes = ['us', 'uk', 'ca', 'de', 'fr', 'in', 'cn', 'jp', 'br', 'sa', 'ae', 'kw', 'qa', 'bh', 'om', 'lb', 'pk']
  return fallbackCodes.map(code => ({
    id: code,
    label: code.toUpperCase(), // Fallback label
    icon: getFlagIcon(code),
    code: code
  }))
})

// Adapter to bridge string-based ID (selectedCountry) with object-based USelectMenu v4
const selectedCountryModel = computed({
  get: () => countryOptions.value.find(c => c.id === selectedCountry.value) || countryOptions.value[0],
  set: (val) => {
    if (val?.id) selectedCountry.value = val.id
  }
})

// Just the codes for the quick-access scroll list
const countryCodes = computed(() => countryOptions.value.map(c => c.code))
</script>

<template>
  <div class="flex items-center gap-1 mb-2 pl-3">

    <!-- Fixed Selected Country (Dropdown) -->
    <USelectMenu
        v-model="selectedCountryModel"
        :items="countryOptions"
        label-key="label"
        :search-input="{ placeholder: 'Search country...', icon: 'i-lucide-search' }"
        class="w-auto pb-1 pt-1.5"
        :ui-menu="{ width: 'w-60' }"
    >
      <template #default>
        <div class="flex gap-1">
          <UIcon :name="getFlagIcon(selectedCountry)" class="size-5" />
          <p class="text-primary-100 text-base font-bold">{{ selectedCountry.toUpperCase() }}</p>
        </div>
      </template>

      <template #item-leading="{ item }">
        <UIcon :name="item.icon" class="w-5 h-5 flex-shrink-0" />
      </template>

      <template #item-label="{ item }">
        <span class="truncate">{{ item.label }}</span>
      </template>
    </USelectMenu>

    <!-- Divider -->
    <USeparator orientation="vertical" class="h-8" />

    <!-- Scrollable List -->
    <div class="flex-1 overflow-x-auto scrollbar-hide flex gap-2 pl-1">

      <UBadge
          v-for="country in countryCodes"
          :key="country"
          class="text-primary-100 transition-all duration-200 cursor-pointer"
          :class="selectedCountry === country ? 'scale-100 ring-2 ring-primary ring-offset-1 ring-offset-black' : 'scale-105 opacity-80 hover:opacity-100'"
          :ui="{leadingIcon: 'size-5'}"
          :icon="getFlagIcon(country)"
          size="md"
          variant="soft"
          color="neutral"
          @click="selectedCountry = country"
      >
        {{ country.toUpperCase() }}
      </UBadge>
    </div>
  </div>
</template>

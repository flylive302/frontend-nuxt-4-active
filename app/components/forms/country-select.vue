<script setup lang="ts">
// Standalone country-of-residence selector. Emits an ISO 3166-1 alpha-2 code.
// Deliberately independent of any phone number — see forms/phone-number-input.vue.
import type { Country } from '~/composables/auth/usePhoneSchema'
import { useCountries } from '~/composables/shared/useCountries'

interface Props {
  disabled?: boolean
  error?: string
  label?: string
  /** Auto-detect the country via geolocation as a default (overridable). */
  autoDetect?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  error: undefined,
  label: 'Country',
  autoDetect: false,
})

// ISO-2 residence code
const model = defineModel<string>({ default: '' })

const { countries, loading, ensureLoaded, detectIfAllowed } = useCountries()

const INVALID_FLAG_CODES = new Set(['an'])
const DEFAULT_FLAG_ICON = 'i-lucide-earth'

const selected = ref<Country | undefined>(undefined)

function getFlagIconName(code: string): string {
  const normalized = (code || '').toLowerCase()
  if (INVALID_FLAG_CODES.has(normalized)) return DEFAULT_FLAG_ICON
  return `i-flag-${normalized}-4x3`
}

function syncFromModel(): void {
  if (!model.value || selected.value?.code === model.value) return
  selected.value = countries.value.find(c => c.code === model.value)
}

function onChange(country: Country | undefined): void {
  if (!country) return
  selected.value = country
  model.value = country.code
}

watch(() => model.value, syncFromModel)

onMounted(async () => {
  await ensureLoaded()
  syncFromModel()

  // Geolocation is a convenience default only — the user can pick any country.
  if (props.autoDetect && !model.value) {
    const detected = await detectIfAllowed()
    if (detected && !model.value) onChange(detected)
  }
})
</script>

<template>
  <UFormField :label="label" name="country" :error="error" required>
    <USelectMenu
      v-model="selected"
      :items="(countries as Country[])"
      :loading="loading"
      :disabled="disabled"
      virtualize
      label-key="name"
      :aria-label="selected ? `Country: ${selected.name}` : 'Select country'"
      placeholder="Select your country"
      :search-input="{ icon: 'i-lucide-search', placeholder: 'Search countries...', autocomplete: 'off' }"
      size="lg"
      class="w-full"
      @update:model-value="onChange"
    >
      <template #leading>
        <UIcon
          v-if="selected?.code"
          :name="getFlagIconName(selected.code)"
          class="size-5 rounded overflow-hidden h-4"
        />
        <UIcon v-else :name="DEFAULT_FLAG_ICON" />
      </template>

      <template #item-leading="{ item }">
        <UIcon
          v-if="(item as Country)?.code"
          :name="getFlagIconName((item as Country).code)"
          class="size-5 rounded overflow-hidden h-4"
        />
      </template>

      <template #item-label="{ item }">
        <template v-if="item">{{ (item as Country).name }}</template>
      </template>
    </USelectMenu>
  </UFormField>
</template>

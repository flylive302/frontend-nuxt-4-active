<script setup lang="ts">
// Independent phone number input. The dial code is chosen on its own and is
// NOT tied to the residence country (forms/country-select.vue). Emits a full
// E.164 string (e.g. "+14155551234") via v-model.
import type { Country } from '~/composables/auth/usePhoneSchema'
import { useCountries } from '~/composables/shared/useCountries'

interface Props {
  disabled?: boolean
  error?: string
  label?: string
  /** Default the dial code from geolocation (still freely overridable). */
  autoDetect?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  error: undefined,
  label: 'Phone Number',
  autoDetect: false,
})

// Full E.164 number
const model = defineModel<string>({ default: '' })

const { countries, loading, ensureLoaded, detectIfAllowed } = useCountries()

const dialCountry = ref<Country | undefined>(undefined)
const national = ref('')

function emitModel(): void {
  const dial = dialCountry.value?.dial_code ?? ''
  model.value = dial && national.value ? `${dial}${national.value}` : ''
}

const nationalValue = computed({
  get: () => national.value,
  set: (val: string) => {
    national.value = val.replace(/\D/g, '')
    emitModel()
  },
})

function onDialChange(country: Country | undefined): void {
  if (!country) return
  dialCountry.value = country
  emitModel()
}

// Paste of a full "+<dial><number>" splits into dial code + national digits.
function handlePaste(event: ClipboardEvent): void {
  const pasted = event.clipboardData?.getData('text') || ''
  if (!pasted.startsWith('+')) return
  event.preventDefault()

  const allDigits = pasted.replace(/[^\d+]/g, '')
  const match = [...countries.value]
    .sort((a, b) => b.dial_code.length - a.dial_code.length)
    .find(c => allDigits.startsWith(c.dial_code))

  if (match) {
    dialCountry.value = match
    national.value = allDigits.replace(match.dial_code, '').replace(/\D/g, '')
  } else {
    national.value = allDigits.replace(/\D/g, '')
  }
  emitModel()
}

// Split an existing E.164 value (edit flow) into dial country + national digits.
function initFromModel(): void {
  const value = model.value
  if (!value || !value.startsWith('+')) return

  const allDigits = value.replace(/[^\d+]/g, '')
  const match = [...countries.value]
    .sort((a, b) => b.dial_code.length - a.dial_code.length)
    .find(c => allDigits.startsWith(c.dial_code))

  if (match) {
    dialCountry.value = match
    national.value = allDigits.replace(match.dial_code, '').replace(/\D/g, '')
  }
}

// The E.164 value can arrive asynchronously (edit flow hydrates formState
// after mount). Re-split whenever it appears and we haven't parsed it yet.
watch(model, () => {
  if (!dialCountry.value && model.value) initFromModel()
})

onMounted(async () => {
  await ensureLoaded()
  initFromModel()

  if (props.autoDetect && !dialCountry.value) {
    const detected = await detectIfAllowed()
    if (detected && !dialCountry.value) onDialChange(detected)
  }
})
</script>

<template>
  <UFormField :label="label" name="phone" :error="error" required>
    <div class="flex items-center gap-1">
      <USelectMenu
        :model-value="dialCountry"
        :items="(countries as Country[])"
        :loading="loading"
        :disabled="disabled"
        virtualize
        label-key="dial_code"
        aria-label="Dial code"
        placeholder="Code"
        :search-input="{ icon: 'i-lucide-search', placeholder: 'Search...', autocomplete: 'off' }"
        size="lg"
        class="w-32 shrink-0"
        @update:model-value="onDialChange"
      >
        <template #leading>
          <CountryFlag
            v-if="dialCountry?.code"
            :code="dialCountry.code"
            class="size-5 rounded overflow-hidden h-4"
          />
          <UIcon v-else name="i-lucide-phone" />
        </template>

        <template #default>
          <span v-if="dialCountry">{{ dialCountry.dial_code }}</span>
          <span v-else class="text-dimmed">Code</span>
        </template>

        <template #item-leading="{ item }">
          <CountryFlag
            v-if="(item as Country)?.code"
            :code="(item as Country).code"
            class="size-5 rounded overflow-hidden h-4"
          />
        </template>

        <template #item-label="{ item }">
          <template v-if="item">
            {{ (item as Country).dial_code }}
            <span class="text-xs text-muted ms-1">{{ (item as Country).name }}</span>
          </template>
        </template>
      </USelectMenu>

      <UInput
        v-model="nationalValue"
        type="tel"
        inputmode="numeric"
        aria-label="Phone number"
        placeholder="Phone number"
        size="lg"
        class="w-full"
        autocomplete="tel-national"
        :disabled="disabled"
        @paste="handlePaste"
      />
    </div>
  </UFormField>
</template>

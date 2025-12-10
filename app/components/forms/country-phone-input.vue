<script setup lang="ts">
import type { Country } from '~/composables/usePhoneSchema'
import { useCountries } from '~/composables/useCountries'

interface Props {
  disabled?: boolean
  error?: string
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  error: undefined
})

// Named v-models for each field
const countryCode = defineModel<string>('countryCode', { default: '' })
const dialCode = defineModel<string>('dialCode', { default: '' })
const phone = defineModel<string>('phone', { default: '' })

const {
  countries,
  loading,
  externalDetectingLocation,
  ensureLoaded,
  detectIfAllowed,
  externalInitialCountry,
} = useCountries()

const selectedCountry = ref<Country | undefined>(undefined)
const showPhone = ref(false)
const phoneInputRef = ref<{ inputRef: HTMLInputElement } | null>(null)

const INVALID_FLAG_CODES = new Set(['an'])
const DEFAULT_FLAG_ICON = 'i-lucide-earth'

const phoneValue = computed({
  get: () => phone.value,
  set: (val: string) => {
    phone.value = val.replace(/\D/g, '')
  }
})

const phonePlaceholder = computed(() => {
  return selectedCountry.value?.name ? `Enter your ${selectedCountry.value.name} number` : 'Phone number'
})

/**
 * Gets the appropriate flag icon name for a country code
 */
function getFlagIconName(code: string): string {
  const normalized = (code || '').toLowerCase()
  if (INVALID_FLAG_CODES.has(normalized)) return DEFAULT_FLAG_ICON
  return `i-flag-${normalized}-4x3`
}

function focusPhoneInput(): void {
  if (!import.meta.client) return
  requestAnimationFrame(() => {
    phoneInputRef.value?.inputRef?.focus()
  })
}

/**
 * Handles country selection change
 */
function onCountryChange(country: Country | undefined): void {
  if (!country) return

  selectedCountry.value = country
  countryCode.value = country.code
  dialCode.value = country.dial_code

  // UX Improvement: Don't wipe the phone number, just ensure it's clean
  // We could strip the old dial code if it was pasted, but for now just keeping the digits is safer
  // than wiping it entirely if the user just clicked the wrong country.

  showPhone.value = true
  focusPhoneInput()
}

/**
 * Sync local selectedCountry when parent updates countryCode prop
 */
watch(countryCode, (newCode) => {
  if (!newCode || selectedCountry.value?.code === newCode) return

  const country = countries.value.find(c => c.code === newCode)
  if (country) {
    selectedCountry.value = country
    dialCode.value = country.dial_code
    showPhone.value = true
  }
})

/**
 * Handles paste events to extract phone number with dial code
 */
function handlePaste(event: ClipboardEvent): void {
  const pastedText = event.clipboardData?.getData('text') || ''
  if (!pastedText.startsWith('+')) return

  event.preventDefault()

  const allDigits = pastedText.replace(/[^\d+]/g, '')
  const match = [...countries.value]
    .sort((a, b) => b.dial_code.length - a.dial_code.length)
    .find(c => allDigits.startsWith(c.dial_code))
  if (match) {
    selectedCountry.value = match
    const phonePart = allDigits.replace(match.dial_code, '').replace(/\D/g, '')

    countryCode.value = match.code
    dialCode.value = match.dial_code
    phone.value = phonePart

    showPhone.value = true
    focusPhoneInput()
  } else {
    phone.value = allDigits.replace(/\D/g, '')
  }
}

onMounted(async () => {
  await ensureLoaded()

  if (externalInitialCountry.value) {
    onCountryChange(externalInitialCountry.value)
    return
  }

  // If countryCode is already set (e.g. from parent), sync it
  if (countryCode.value) {
    const country = countries.value.find(c => c.code === countryCode.value)
    if (country) {
      onCountryChange(country)
      return
    }
  }

  const detected = await detectIfAllowed()
  if (detected) {
    onCountryChange(detected)
  }
})
</script>

<template>
  <div class="space-y-2">
    <UFormField label="Country" name="countryCode" required>
      <USelectMenu v-model="selectedCountry" :items="(countries as any)" :loading="loading || externalDetectingLocation"
        :disabled="disabled" label-key="name" placeholder="Select your country"
        :search-input="{ icon: 'i-lucide-search', placeholder: 'Search countries...' }" size="lg" class="w-full"
        @update:model-value="(val: any) => onCountryChange(val)">
        <template #leading="{ modelValue }">
          <UIcon v-if="modelValue && (modelValue as any).code" :name="getFlagIconName((modelValue as any).code)"
            class="size-5 rounded overflow-hidden h-4" />
          <UIcon v-else :name="DEFAULT_FLAG_ICON" />
        </template>

        <template #item-leading="{ item }">
          <UIcon v-if="item" :name="getFlagIconName((item as any).code)" class="size-5 rounded overflow-hidden h-4" />
        </template>

        <template #item-label="{ item }">
          <template v-if="item">
            {{ (item as any).name }}
            <span class="text-xs text-muted ms-1">{{ (item as any).dial_code }}</span>
          </template>
        </template>
      </USelectMenu>
    </UFormField>

    <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0 translate-y-1"
      enter-to-class="opacity-100 translate-y-0">
      <UFormField v-if="showPhone && selectedCountry" label="Phone Number" name="phone"
        :help="`Enter your number for ${selectedCountry.name}`" :error="error" required>
        <div class="flex items-center gap-1">
          <div
            class="text-base flex items-center font-semibold border border-neutral-700 h-9 rounded-md px-2 bg-neutral-950 shrink-0">
            <UIcon name="i-lucide-phone" class="mr-1 size-4" />
            <span>{{ selectedCountry.dial_code }}</span>
          </div>

          <UInput ref="phoneInputRef" v-model="phoneValue" type="tel" inputmode="numeric"
            :placeholder="phonePlaceholder" size="lg" class="w-full" autocomplete="tel-national" :disabled="disabled"
            @paste="handlePaste" />
        </div>
      </UFormField>
    </Transition>
  </div>
</template>

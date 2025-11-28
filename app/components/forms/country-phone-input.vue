<script setup lang="ts">
// app/components/forms/country-phone-input.vue
// "wts my cmd code" standard: strict typing, clean architecture, no magic numbers.

import { nextTick, ref, onMounted, computed } from 'vue'
import type { Country, PhoneModel } from '~/composables/usePhoneSchema'
import { useCountries } from '~/composables/useCountries'

// 1. Props & Emits (Vue 3.4+ defineModel)
// We use defineModel to easily emit the 'update:model' event.
// The parent does NOT pass a value, so we rely on the default and only write to it.
const model = defineModel<PhoneModel>('model', { 
  required: false,
  default: () => ({ countryCode: '', dialCode: '', phone: '' })
})

// 2. Composable access
const {
  countries,
  loading,
  externalDetectingLocation,
  ensureLoaded,
  detectIfAllowed,
  externalInitialCountry,
} = useCountries()

// 3. Local State
const selectedCountry = ref<Country | undefined>(undefined)
const showPhone = ref(false)
const phoneInputRef = ref<{ inputRef: HTMLInputElement } | null>(null)

// 4. Constants
const INVALID_FLAG_CODES = new Set(['an']) // Netherlands Antilles
const DEFAULT_FLAG_ICON = 'i-lucide-earth'

// 5. Helpers
function getFlagIconName(code: string): string {
  const normalized = (code || '').toLowerCase()
  if (INVALID_FLAG_CODES.has(normalized)) return DEFAULT_FLAG_ICON
  return `i-flag-${normalized}-4x3`
}

function focusPhoneInput() {
  if (!import.meta.client) return
  // Use requestAnimationFrame for reliable focus after transition/render
  requestAnimationFrame(() => {
    phoneInputRef.value?.inputRef?.focus()
  })
}

// Computed property to handle phone input updates and trigger emit
const phoneValue = computed({
  get: () => model.value?.phone || '',
  set: (val: string) => {
    // Reassign model.value to trigger update:model emit
    model.value = {
      ...model.value,
      phone: val
    }
  }
})

// 6. Event Handlers
async function onCountryChange(country: Country | undefined) {
  if (!country) return

  selectedCountry.value = country
  
  // Emit new object to trigger update:model
  model.value = {
    countryCode: country.code,
    dialCode: country.dial_code,
    phone: '' // Clear phone on country switch
  }
  
  showPhone.value = true
  await nextTick()
  focusPhoneInput()
}

function handlePaste(event: ClipboardEvent) {
  const pastedText = event.clipboardData?.getData('text') || ''
  if (!pastedText.startsWith('+')) return

  event.preventDefault()
  
  // Extract digits
  const allDigits = pastedText.replace(/[^\d+]/g, '')
  
  // Find matching country by dial code
  const match = countries.value.find(c => allDigits.startsWith(c.dial_code))
  
  if (match) {
    // We need to update everything: country, dial code, and phone
    selectedCountry.value = match
    const phonePart = allDigits.replace(match.dial_code, '').replace(/\D/g, '')
    
    model.value = {
      countryCode: match.code,
      dialCode: match.dial_code,
      phone: phonePart
    }
    
    showPhone.value = true
    nextTick(() => focusPhoneInput())
  } else {
    // Fallback: just strip non-digits if no country match found
    // Keep existing country/dialCode, just update phone
    model.value = {
      ...model.value,
      phone: allDigits.replace(/\D/g, '')
    }
  }
}

// 7. Lifecycle & Initialization
onMounted(async () => {
  if (!import.meta.client) return

  await ensureLoaded()

  // Priority 1: External override (e.g. from user profile)
  if (externalInitialCountry.value) {
    onCountryChange(externalInitialCountry.value)
    return
  }

  // Priority 2: Auto-detect
  // We do NOT check model.value here as the parent does not pass initial data.
  const detected = await detectIfAllowed()
  if (detected) {
    onCountryChange(detected)
  }
})

// No watchers needed as we don't sync from parent
</script>

<template>
  <div class="space-y-2">
    <!-- Country Select -->
    <UFormField label="Country" name="countryCode" required>
      <USelectMenu
        v-model="selectedCountry"
        :items="countries"
        :loading="loading || externalDetectingLocation"
        label-key="name"
        placeholder="Select your country"
        :search-input="{ icon: 'i-lucide-search', placeholder: 'Search countries...' }"
        size="lg"
        class="w-full"
        @update:model-value="onCountryChange"
      >
        <template #leading="{ modelValue }">
          <UIcon
            v-if="modelValue"
            :name="getFlagIconName(modelValue.code)"
            class="size-5 rounded overflow-hidden h-4"
          />
          <UIcon v-else :name="DEFAULT_FLAG_ICON" />
        </template>

        <template #item-leading="{ item }">
          <UIcon 
            :name="getFlagIconName(item.code)" 
            class="size-5 rounded overflow-hidden h-4" 
          />
        </template>

        <template #item-label="{ item }">
          {{ item.name }} 
          <span class="text-xs text-muted ms-1">{{ item.dial_code }}</span>
        </template>
      </USelectMenu>
    </UFormField>

    <!-- Phone Input (Animated) -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
    >
      <UFormField
        v-if="showPhone && selectedCountry"
        label="Phone Number"
        name="phone"
        :help="`Enter your number for ${selectedCountry.name}`"
        required
      >
        <div class="flex items-center gap-1">
          <!-- Dial Code Badge -->
          <div
            class="text-base flex items-center font-semibold border border-neutral-700 h-9 rounded-md px-2 bg-neutral-950 shrink-0"
          >
            <UIcon name="i-lucide-phone" class="mr-1 size-4" /> 
            <span>{{ selectedCountry.dial_code }}</span>
          </div>

          <!-- Phone Input -->
          <UInput
            ref="phoneInputRef"
            v-model="phoneValue"
            type="tel"
            inputmode="numeric"
            placeholder="3001234567"
            size="lg"
            class="w-full"
            autocomplete="tel-national"
            @paste="handlePaste"
          />
        </div>
      </UFormField>
    </Transition>
  </div>
</template>
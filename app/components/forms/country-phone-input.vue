<script setup lang="ts">
import { nextTick, reactive, ref, watch, onMounted } from 'vue'
import type { Country, PhoneModel } from '~/composables/usePhoneSchema'
import { useGeolocation } from '~/composables/useGeolocation'

const emit = defineEmits<{
  (e: 'update:model', v: PhoneModel): void
}>()

const props = withDefaults(defineProps<{
  countries?: Country[]
  initialCountry?: Country
  detectingLocation?: boolean
}>(), {
  countries: undefined,
  initialCountry: undefined,
  detectingLocation: false,
})

const countries = ref<Country[]>(props.countries || [])
const loading = ref(!props.countries)
const selectedCountry = ref<Country | undefined>(props.initialCountry)
const showPhone = ref(!!props.initialCountry)
const phoneInputRef = ref<{ inputRef: HTMLInputElement | null } | null>(null)

// Known problematic country codes that don't have flag icons (e.g., deprecated codes)
const INVALID_FLAG_CODES = new Set(['an']) // Netherlands Antilles (dissolved)

// Get safe flag icon name with fallback
function getFlagIconName(code: string): string {
  const normalizedCode = code.toLowerCase()
  if (INVALID_FLAG_CODES.has(normalizedCode)) {
    return 'i-lucide-earth' // Fallback to earth icon
  }
  return `i-flag-${normalizedCode}-4x3`
}

const model = reactive<PhoneModel>({
  countryCode: props.initialCountry?.code ?? '',
  dialCode: props.initialCountry?.dial_code ?? '',
  phone: '',
})

// Load countries (only if not provided via props)
async function loadCountries() {
  if (props.countries) {
    countries.value = props.countries
    loading.value = false
    return
  }
  
  try {
    const response = await fetch('/countries.json')
    countries.value = await response.json()
  } catch (err) {
    console.error('Failed to load countries:', err)
    countries.value = []
  } finally {
    loading.value = false
  }
}

// Auto-detect country
const { detectCountry } = useGeolocation()

async function autoDetectCountry() {
  if (!countries.value.length) return

  try {
    const code = await detectCountry()
    if (code) {
      const match = countries.value.find(c => c.code.toUpperCase() === code.toUpperCase())
      if (match) {
        selectedCountry.value = match
        model.countryCode = match.code
        model.dialCode = match.dial_code
        showPhone.value = true
      }
    }
  } catch (err) {
    console.error('Failed to detect country:', err)
  }
}

onMounted(() => {
  if (!import.meta.client) return

  // If countries are provided via props, use them immediately
  if (props.countries) {
    countries.value = props.countries
    loading.value = false
    
    // If initial country is provided, set it up
    if (props.initialCountry) {
      selectedCountry.value = props.initialCountry
      model.countryCode = props.initialCountry.code
      model.dialCode = props.initialCountry.dial_code
      showPhone.value = true
    }
    
    // Only auto-detect if not provided via props and not detecting location externally
    if (!props.initialCountry && !props.detectingLocation) {
      autoDetectCountry().catch(() => {
        // Silently fail - geolocation is optional
      })
    }
    return
  }

  // Defer all loading to avoid blocking initial render (only when loading internally)
  const scheduleLoad = (callback: () => void | Promise<void>) => {
    // Feature detection: requestIdleCallback is not available in Safari
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(callback, { timeout: 2000 })
    } else {
      // Fallback: use setTimeout to defer execution to next tick
      setTimeout(callback, 0)
    }
  }

  // Load countries in background (non-blocking)
  scheduleLoad(() => {
    loadCountries().then(() => {
      // Run geolocation detection after countries are loaded, but don't block UI
      // Only if not detecting location externally
      if (!props.detectingLocation) {
        scheduleLoad(() => {
          autoDetectCountry().catch(() => {
            // Silently fail - geolocation is optional
          })
        })
      }
    })
  })
})

// Watch for prop changes to update internal state
watch(() => props.countries, (newCountries) => {
  if (newCountries && newCountries.length > 0) {
    countries.value = newCountries
    loading.value = false
  }
}, { immediate: true })

watch(() => props.initialCountry, (newCountry) => {
  if (newCountry) {
    selectedCountry.value = newCountry
    model.countryCode = newCountry.code
    model.dialCode = newCountry.dial_code
    showPhone.value = true
  }
}, { immediate: true })

watch(model, () => emit('update:model', { ...model }), { deep: true })

async function onCountryChange(country: Country | undefined) {
  if (!country) return

  selectedCountry.value = country
  model.countryCode = country.code
  model.dialCode = country.dial_code
  model.phone = ''
  showPhone.value = true

  await nextTick()
  if (import.meta.client) {
    requestAnimationFrame(() => phoneInputRef.value?.inputRef?.focus())
  }
}

function handlePaste(event: ClipboardEvent) {
  const pasted = event.clipboardData?.getData('text') || ''
  if (!pasted.startsWith('+')) return

  event.preventDefault()
  const digits = pasted.replace(/[^\d+]/g, '')
  const match = countries.value.find(c => digits.startsWith(c.dial_code))

  if (match) onCountryChange(match)

  const dial = match?.dial_code ?? selectedCountry.value?.dial_code ?? ''
  model.phone = digits.replace(dial, '').replace(/\D/g, '')
}
</script>

<template>
  <div class="space-y-2">
    <UFormField label="Country" name="countryCode" required>
      <USelectMenu
          :model-value="selectedCountry"
          :items="countries"
          :loading="loading || props.detectingLocation"
          label-key="name"
          placeholder="Select your country"
          :search-input="{ icon: 'i-lucide-search', placeholder: 'Search countries...' }"
          size="lg"
          class="w-full"
          @update:model-value="onCountryChange"
      >
        <template #leading="{ modelValue }">
          <icon
              v-if="modelValue"
              :name="getFlagIconName(modelValue.code)"
              class="size-5 rounded overflow-hidden h-4"
          />
          <icon v-else name="i-lucide-earth" />
        </template>
        <template #item-leading="{ item }">
          <icon
              :name="getFlagIconName(item.code)"
              class="size-5 rounded overflow-hidden h-4"
          />
        </template>
        <template #item-label="{ item }">
          {{ item.name }} <span class="text-xs text-muted ms-1">{{ item.dial_code }}</span>
        </template>
      </USelectMenu>
    </UFormField>

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
          <p class="text-base flex items-center font-semibold border border-neutral-700 h-9 rounded-md px-1 bg-neutral-950">
            <UIcon name="i-lucide-phone" class="mr-1" /> {{ selectedCountry.dial_code }}
          </p>
          <UInput
              ref="phoneInputRef"
              v-model="model.phone"
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
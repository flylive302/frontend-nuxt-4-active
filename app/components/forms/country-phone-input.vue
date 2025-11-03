<script setup lang="ts">
import { nextTick, reactive, ref, watch } from 'vue'
import type { Country, PhoneModel } from '~/composables/usePhoneSchema'

type Emits = {
  (e: 'update:model', v: PhoneModel): void
}

const props = defineProps<{
  countries: Country[]
  initialCountry?: Country
  detectingLocation?: boolean
}>()

const emit = defineEmits<Emits>()

const selectedCountry = ref<Country | undefined>(props.initialCountry)
const model = reactive<PhoneModel>({
  countryCode: props.initialCountry?.code ?? '',
  dialCode: props.initialCountry?.dial_code ?? '',
  phone: '',
})

watch(model, () => emit('update:model', { ...model }), { deep: true })

const phoneInputRef = ref<{ inputRef: HTMLInputElement | null } | null>(null)
const showPhone = ref(!!props.initialCountry)

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
  const match = props.countries.find(c => digits.startsWith(c.dial_code))
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
          :loading="!!detectingLocation"
          label-key="name"
          placeholder="Select your country"
          :search-input="{ icon: 'i-lucide-search', placeholder: 'Search countries...' }"
          size="lg"
          class="w-full"
          @update:model-value="onCountryChange"
      >
        <template #leading="{ modelValue }">
          <span v-if="modelValue">{{ modelValue.flag }}</span>
          <UIcon v-else name="i-lucide-earth" />
        </template>
        <template #item-leading="{ item }">
          <span>{{ item.flag }}</span>
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
            <UIcon name="i-lucide-phone" class="mr-1"/> {{ selectedCountry.dial_code }}
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

        <input type="hidden" name="countryCode" :value="model.countryCode" />
        <input type="hidden" name="dialCode" :value="model.dialCode" />
      </UFormField>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { useAudioPreferencesStore, type NoiseFilterMode } from '~/stores/audioPreferences'
import { classifyDeviceClass, readDeviceCapabilities } from '~/utils/device-class'
import { resolveNoiseFilter, isAudioWorkletSupported } from '~/utils/audio/resolve-noise-filter'

// ========================================
// Audio Sub-Drawer
// ========================================
//
// Everyone: mic noise-filter mode (Auto / On / Off). Purely client-side —
// see `stores/audioPreferences.ts`.
// ========================================

const open = defineModel<boolean>('open', { default: false })

// ========================================
// Composables
// ========================================

const audioPrefs = useAudioPreferencesStore()

const NOISE_FILTER_OPTIONS: Array<{ value: NoiseFilterMode; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
]

// ========================================
// Computed
// ========================================

/** Resolved Auto state text, computed on open so it reflects this device. */
const autoResolvedText = computed(() => {
  const deviceClass = classifyDeviceClass(readDeviceCapabilities())
  const active = resolveNoiseFilter('auto', deviceClass, isAudioWorkletSupported())
  return active ? 'Auto — on for this phone' : 'Auto — off for this phone'
})

// ========================================
// Handlers
// ========================================

function selectMode(mode: NoiseFilterMode): void {
  audioPrefs.setNoiseFilterMode(mode)
}
</script>

<template>
  <UDrawer
    v-model:open="open"
    title="Audio"
    description="Mic and playback preferences for this device."
    style="--ui-primary: var(--room-theme, var(--color-primary)); --ui-color-primary-500: var(--room-theme, var(--color-primary-500));"
  >
    <template #content>
      <div class="px-3 mt-3 flex flex-col gap-3 pb-4 max-h-[80vh] overflow-y-auto">
        <div class="bg-neutral-800 rounded-lg p-3 space-y-3">
          <UFormField label="Noise filter" help="Changing this restarts your mic for a second.">
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="option in NOISE_FILTER_OPTIONS"
                :key="option.value"
                type="button"
                class="rounded-lg py-2 text-sm font-medium transition-colors cursor-pointer"
                :class="audioPrefs.noiseFilterMode === option.value
                  ? 'bg-primary/20 ring-2 ring-primary text-primary'
                  : 'bg-neutral-900 text-neutral-300 hover:bg-neutral-700'"
                :aria-pressed="audioPrefs.noiseFilterMode === option.value"
                @click="selectMode(option.value)"
              >
                {{ option.label }}
              </button>
            </div>
          </UFormField>

          <p v-if="audioPrefs.noiseFilterMode === 'auto'" class="text-xs text-neutral-400">
            {{ autoResolvedText }}
          </p>
        </div>
      </div>
    </template>
  </UDrawer>
</template>

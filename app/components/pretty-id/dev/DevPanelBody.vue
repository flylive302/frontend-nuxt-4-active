<script setup lang="ts">
/**
 * Content of the dev panel: every lever of the mock backend, grouped. It stays
 * open across actions — each lever refreshes `state` (and the visible data).
 *
 * Lives inside the sheet, so it is created afresh on every open and reads the
 * mock's current state then (the gear in the top bar uses another composable
 * instance, so a long-lived copy would show stale coins / armed flag).
 */
import { formatCoins } from '~/utils/currency'

const emit = defineEmits<{
  close: []
}>()

// Constants
/** Demo levels: below every reward, the Lv 17 reward, the Lv 34 reward. */
const LEVEL_PRESETS: readonly number[] = [5, 17, 34]

interface CoinPreset {
  label: string
  /** `0` empties the balance. */
  amount: number
}
const COIN_PRESETS: readonly CoinPreset[] = [
  { label: '+1M', amount: 1_000_000 },
  { label: '+10M', amount: 10_000_000 },
  { label: 'Set 0', amount: 0 },
]

interface SkipPreset {
  label: string
  hours: number
}
const SKIP_PRESETS: readonly SkipPreset[] = [
  { label: 'Skip 1h', hours: 1 },
  { label: 'Skip 24h', hours: 24 },
]

// Composables
const {
  state,
  setLevel,
  addCoins,
  skipHours,
  rivalBidsNow,
  endAllAuctions,
  toggleRace,
  addChangeToken,
  reset,
} = usePrettyIdDevPanel()
</script>

<template>
  <div v-if="state">
    <p class="pid-body pid-small pid-muted mb-2.5">Test data only — nothing here is real.</p>

    <div class="flex items-center justify-between gap-2">
      <span class="pid-disp pid-gold text-[18px]">Demo Panel</span>
      <button type="button" class="pid-dev-close" aria-label="Close demo panel" @click="emit('close')">
        <UIcon name="i-lucide-x" class="size-5" />
      </button>
    </div>

    <PrettyIdDevPanelGroup :title="`User level (now Lv ${state.level})`">
      <PrettyIdChip
        v-for="level in LEVEL_PRESETS"
        :key="level"
        :active="state.level === level"
        @click="setLevel(level)"
      >
        Lv {{ level }}
      </PrettyIdChip>
    </PrettyIdDevPanelGroup>

    <PrettyIdDevPanelGroup :title="`Coins (${formatCoins(state.coins)})`">
      <PrettyIdChip v-for="preset in COIN_PRESETS" :key="preset.label" @click="addCoins(preset.amount)">
        {{ preset.label }}
      </PrettyIdChip>
    </PrettyIdDevPanelGroup>

    <PrettyIdDevPanelGroup :title="`Time (offset ${state.offset_hours}h)`">
      <PrettyIdChip v-for="preset in SKIP_PRESETS" :key="preset.label" @click="skipHours(preset.hours)">
        {{ preset.label }}
      </PrettyIdChip>
    </PrettyIdDevPanelGroup>

    <PrettyIdDevPanelGroup title="Auctions">
      <PrettyIdChip @click="rivalBidsNow()">Rival bids now</PrettyIdChip>
      <PrettyIdChip @click="endAllAuctions()">End all auctions now</PrettyIdChip>
    </PrettyIdDevPanelGroup>

    <PrettyIdDevPanelGroup title="Errors">
      <PrettyIdChip :active="state.race_armed" @click="toggleRace()">Next claim: ID taken mid-claim</PrettyIdChip>
      <PrettyIdChip @click="addChangeToken()">+1 change token</PrettyIdChip>
    </PrettyIdDevPanelGroup>

    <PrettyIdDevPanelGroup title="Data">
      <PrettyIdChip @click="reset()">Reset all demo data</PrettyIdChip>
    </PrettyIdDevPanelGroup>
  </div>
</template>

<style scoped>
/* `components` layer: below Tailwind utilities, so a utility on the element wins (see pretty-id.css). */
@layer components {
  /* Round gold-rimmed icon button — the same look as the top bar's. */
  .pid-dev-close {
    display: grid;
    flex: none;
    place-items: center;
    width: 38px;
    height: 38px;
    border: 1.5px solid var(--pid-gold-deep);
    border-radius: 50%;
    background: color-mix(in srgb, var(--pid-surface) 80%, transparent);
    color: var(--pid-gold);
    cursor: pointer;
  }

  .pid-dev-close:focus-visible {
    outline: 2px solid var(--pid-gold);
    outline-offset: 2px;
  }
}
</style>

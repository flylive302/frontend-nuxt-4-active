<script setup lang="ts">
/**
 * "My ID" tab: the user's profile, their level-reward slots (claim / change),
 * the rare auction IDs they currently hold, and how those IDs look as badges.
 *
 * Reads `me` from the store (loaded by <PrettyIdShell>). Claim and change are
 * intents handed to the claim actions, which gate them and navigate to Choose.
 */
import { PRETTY_ID_SLOT_KEYS } from '~/constants/pretty-id'
import type { PrettyIdAuctionHolding, PrettyIdSlotKey } from '~/types/pretty-id'
import { usePrettyIdStore } from '~/stores/prettyId'

// Constants
const AVATAR_RING_SIZE = 96
/** Badge order on the profile: the 4-digit ID first, then the 6-digit one. */
const BADGE_SLOT_ORDER: readonly PrettyIdSlotKey[] = ['lv34', 'lv17']

// Composables
const store = usePrettyIdStore()
const { now } = usePrettyIdClock()
const { startChange, startClaim } = usePrettyIdClaimActions()

// State
const me = computed(() => store.me)

/** Auction IDs still held — the clock ticks, so an expired one drops off by itself. */
const liveHoldings = computed<PrettyIdAuctionHolding[]>(() =>
  (me.value?.auction_ids ?? []).filter(holding => Date.parse(holding.expires_at) > now.value),
)

const badgeIds = computed<string[]>(() => {
  const current = me.value
  if (!current) return []
  const slotIds = BADGE_SLOT_ORDER
    .map(key => current.slots[key].id)
    .filter((id): id is string => id !== null)
  return [...slotIds, ...liveHoldings.value.map(holding => holding.id)]
})

// Handlers
function onClaim(key: PrettyIdSlotKey): void {
  void startClaim(key)
}

function onChange(key: PrettyIdSlotKey): void {
  void startChange(key)
}
</script>

<template>
  <div>
    <p v-if="!me" class="pid-empty" role="status">Loading your IDs…</p>

    <template v-else>
      <PrettyIdPanel title="My profile">
        <div class="flex flex-col items-center">
          <PrettyIdRing :src="me.user.avatar_url" :size="AVATAR_RING_SIZE" />
          <p class="pid-body my-1.5 text-base">{{ me.user.name }} · Lv {{ me.level }}</p>
        </div>
      </PrettyIdPanel>

      <PrettyIdPanel title="My Pretty IDs">
        <PrettyIdMySlot
          v-for="key in PRETTY_ID_SLOT_KEYS"
          :key="key"
          :entry="me.slots[key]"
          @claim="onClaim"
          @change="onChange"
        />

        <PrettyIdRow v-for="holding in liveHoldings" :key="holding.id">
          <PrettyIdPlate>
            <span class="pid-num pid-gold text-[18px]">{{ holding.id }}</span>
          </PrettyIdPlate>
          <span class="pid-body pid-small min-w-0 flex-1 leading-[1.35]">
            Rare auction ID<br>expires in <PrettyIdCountdown :to="holding.expires_at" />
          </span>
        </PrettyIdRow>
      </PrettyIdPanel>

      <PrettyIdPanel title="Badges">
        <PrettyIdMyBadges :name="me.user.name" :avatar-url="me.user.avatar_url" :ids="badgeIds" />
      </PrettyIdPanel>
    </template>
  </div>
</template>

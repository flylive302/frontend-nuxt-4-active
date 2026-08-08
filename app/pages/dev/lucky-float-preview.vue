<script setup lang="ts">
/**
 * DEV-ONLY lucky animation workbench (lucky-animation-ux epic). Drives the
 * REAL state model — center cashback, sender bands, notice pills — through
 * useLuckySessionStore so every visual can be styled without sending gifts.
 * Dev builds only — 404 in prod.
 *
 * Route: /dev/lucky-float-preview
 */
import type { FloatingMultiplier } from '~/types/lucky'
import { LUCKY_CASHBACK_SVGA_TIERS } from '~/constants/lucky'
import { resolveCashbackTier } from '~/utils/lucky-cashback'

// ---------- Config ----------
definePageMeta({ layout: false })

if (!import.meta.dev) {
  throw createError({ statusCode: 404, statusMessage: 'Not Found', fatal: true })
}

// ---------- State ----------
const store = useLuckySessionStore()

const multiplier = ref<number>(LUCKY_CASHBACK_SVGA_TIERS[1])
const coinsWon = ref(1770)
const noticeText = ref('pool capped for today')
const showNotice = ref(false)

let revision = 0

// ---------- Derived ----------
const floaters = computed<FloatingMultiplier[]>(() =>
  showNotice.value
    ? [{ id: 1, kind: 'notice', text: noticeText.value, colorClass: 'lucky-float--notice' }]
    : [],
)

/** ×0 renders nothing by design — surfaced here so the blank screen isn't a bug. */
const isBust = computed(() => !(multiplier.value > 0))

// ---------- Handlers ----------
function fireWin(): void {
  const tier = resolveCashbackTier(multiplier.value)
  if (tier === null) {
    store.setCenterCashback(null)
    return
  }
  store.setCenterCashback({
    tier,
    multiplier: multiplier.value,
    coinsWon: coinsWon.value,
    phase: 'visible',
    revision: ++revision,
  })
}

function fireFade(): void {
  store.setCenterCashbackPhase('fading')
}

function fireBandTap(senderId: number): void {
  const existing = store.senderBands.get(senderId)
  if (existing) {
    store.patchBand(senderId, { quantity: existing.quantity + 1, phase: 'visible', lastActivityAt: Date.now() })
  } else {
    store.upsertBand({
      senderId,
      senderName: `Player ${senderId}`,
      senderAvatar: null,
      giftName: 'Lucky Star',
      recipientName: 'Host',
      recipientCount: 1,
      quantity: 1,
      coinsWon: 0,
      slot: senderId - 1,
      phase: 'visible',
      lastActivityAt: Date.now(),
    })
  }
}

function fireBandWin(senderId: number): void {
  const existing = store.senderBands.get(senderId)
  if (existing) {
    store.patchBand(senderId, { coinsWon: existing.coinsWon + coinsWon.value })
  }
}

function resetAll(): void {
  store.$reset()
}

watch([multiplier, coinsWon], fireWin)

onBeforeUnmount(resetAll)
</script>

<template>
  <div class="dev-page">
    <p class="dev-hint">
      Lucky animation workbench (dev only) — edit
      <code>LuckyCashbackCenter.vue</code>, <code>LuckySenderBands.vue</code> or
      <code>LuckyMultiplierFloat.vue</code> and it hot-reloads here.
      <strong v-if="isBust"> ×0 = bust → nothing renders (by design).</strong>
    </p>

    <!-- Mirrors the room stage: containers are absolute inside it -->
    <div class="dev-stage">
      <LuckyMultiplierFloat :floaters="floaters" />
      <LuckyCashbackCenter />
      <LuckySenderBands />
    </div>

    <div class="dev-panel">
      <div class="dev-row">
        <button class="dev-btn" @click="multiplier = 0">×0 (bust)</button>
        <button
          v-for="tier in LUCKY_CASHBACK_SVGA_TIERS"
          :key="tier"
          class="dev-btn"
          :class="{ 'dev-btn--primary': multiplier === tier }"
          @click="multiplier = tier"
        >
          ×{{ tier }}
        </button>
        <button class="dev-btn dev-btn--primary" @click="fireWin">Fire win</button>
        <button class="dev-btn" @click="fireFade">Start fade</button>
      </div>

      <div class="dev-row">
        <button v-for="n in 4" :key="n" class="dev-btn" @click="fireBandTap(n)">Band {{ n }} tap</button>
        <button v-for="n in 4" :key="`w${n}`" class="dev-btn" @click="fireBandWin(n)">Band {{ n }} win</button>
        <button class="dev-btn" @click="resetAll">Reset</button>
      </div>

      <div class="dev-row">
        <label class="dev-field">
          <span>multiplier</span>
          <input v-model.number="multiplier" type="number" min="0" step="0.5">
        </label>
        <label class="dev-field">
          <span>coins won</span>
          <input v-model.number="coinsWon" type="number" min="0" step="10">
        </label>
        <label class="dev-field">
          <span>notice text</span>
          <input v-model="noticeText" type="text">
        </label>
        <label class="dev-check"><input v-model="showNotice" type="checkbox"> show notice pill</label>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dev-page {
  position: relative;
  min-height: 100vh;
  background: #14161c;
  color: #e6e8ee;
}

.dev-hint {
  padding: 12px 16px;
  font-size: 13px;
  opacity: 0.75;
}

.dev-stage {
  position: relative;
  height: 70vh;
  margin: 0 16px;
  border: 1px dashed #2c3140;
  background: repeating-linear-gradient(0deg, #1b1e26 0 39px, #232733 39px 40px);
  overflow: hidden;
}

.dev-panel {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: rgb(10 12 16 / 92%);
  border-top: 1px solid #2c3140;
  font-size: 12px;
}

.dev-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: end;
}

.dev-field {
  display: flex;
  flex: 1 1 160px;
  flex-direction: column;
  gap: 2px;
}

.dev-field span {
  opacity: 0.6;
}

.dev-field input {
  padding: 4px 6px;
  border: 1px solid #333a4a;
  border-radius: 4px;
  background: #1b1e26;
  color: inherit;
}

.dev-btn {
  padding: 4px 8px;
  border: 1px solid #333a4a;
  border-radius: 4px;
  background: #1b1e26;
  color: inherit;
  cursor: pointer;
}

.dev-btn--primary {
  background: #3b5bfd;
  border-color: #3b5bfd;
}

.dev-check {
  display: flex;
  gap: 4px;
  align-items: center;
}
</style>

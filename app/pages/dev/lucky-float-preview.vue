<script setup lang="ts">
/**
 * DEV-ONLY lucky cashback float workbench. Renders `LuckyMultiplierFloat` with
 * dummy floaters on a permanent auto-replay loop so the cashback SVGA can be
 * styled without sending real gifts. Dev builds only — 404 in prod.
 *
 * Route: /dev/lucky-float-preview
 */
import type { FloatingMultiplier } from '~/types/lucky'
import { LUCKY_CASHBACK_SVGA_TIERS } from '~/constants/lucky'

// ---------- Config ----------
definePageMeta({ layout: false })

if (!import.meta.dev) {
  throw createError({ statusCode: 404, statusMessage: 'Not Found', fatal: true })
}

// ---------- Constants ----------
const REPLAY_DELAY_MS = 600
const REPLAY_PERIOD_MS = 3200

// ---------- State ----------
const multiplier = ref<number>(LUCKY_CASHBACK_SVGA_TIERS[1])
const coinsWon = ref(1770)
const noticeText = ref('pool capped for today')
const showNotice = ref(false)
const autoReplay = ref(true)

const runId = ref(0)
const visible = ref(true)
let replayTimer: ReturnType<typeof setTimeout> | null = null
let loopTimer: ReturnType<typeof setInterval> | null = null

// ---------- Derived ----------
const floaters = computed<FloatingMultiplier[]>(() => {
  if (!visible.value) return []

  const list: FloatingMultiplier[] = [{
    id: runId.value,
    kind: 'multiplier',
    multiplier: multiplier.value,
    coinsWon: coinsWon.value,
    colorClass: 'lucky-float--cashback',
  }]

  if (showNotice.value) {
    list.push({
      id: runId.value + 1,
      kind: 'notice',
      text: noticeText.value,
      colorClass: 'lucky-float--notice',
    })
  }

  return list
})

/** ×0 renders nothing by design — surfaced here so the blank screen isn't a bug. */
const isBust = computed(() => !(multiplier.value > 0))

// ---------- Handlers ----------
function replay(): void {
  if (replayTimer) clearTimeout(replayTimer)
  visible.value = false
  replayTimer = setTimeout(() => {
    runId.value += 2
    visible.value = true
  }, REPLAY_DELAY_MS)
}

function startLoop(): void {
  stopLoop()
  if (!autoReplay.value) return
  loopTimer = setInterval(replay, REPLAY_PERIOD_MS)
}

function stopLoop(): void {
  if (loopTimer) clearInterval(loopTimer)
  loopTimer = null
}

watch([multiplier, coinsWon, noticeText, showNotice], replay)
watch(autoReplay, startLoop)

onMounted(startLoop)
onBeforeUnmount(() => {
  stopLoop()
  if (replayTimer) clearTimeout(replayTimer)
})
</script>

<template>
  <div class="dev-page">
    <p class="dev-hint">
      Lucky cashback float workbench (dev only) — edit
      <code>app/components/lucky/CashbackSvga.vue</code> or
      <code>LuckyMultiplierFloat.vue</code> and it hot-reloads here.
      <strong v-if="isBust"> ×0 = bust → nothing renders (by design).</strong>
    </p>

    <!-- Mirrors the room stage: the float container is absolute inside it -->
    <div class="dev-stage">
      <LuckyMultiplierFloat :floaters="floaters" />
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
        <button class="dev-btn dev-btn--primary" @click="replay">Replay</button>
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
      </div>

      <div class="dev-row">
        <label class="dev-check"><input v-model="autoReplay" type="checkbox"> auto-replay</label>
        <label class="dev-check"><input v-model="showNotice" type="checkbox"> also show notice pill</label>
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

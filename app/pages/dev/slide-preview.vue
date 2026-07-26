<script setup lang="ts">
/**
 * DEV-ONLY slide overlay workbench. Renders `SlideOverlayItem` with dummy data
 * on a permanent auto-replay loop so the overlay can be styled/tweaked without
 * waiting for a real `slide:play` socket event. Dev builds only — 404 in prod.
 *
 * Route: /dev/slide-preview
 */
import type { ActiveSlide } from '~/types/slide'

// ---------- Config ----------
definePageMeta({ layout: false })

if (!import.meta.dev) {
  throw createError({ statusCode: 404, statusMessage: 'Not Found', fatal: true })
}

// ---------- Constants ----------
const REPLAY_DELAY_MS = 400

const PRESETS: { label: string; svgaUrl: string; top: number; height: number }[] = [
  { label: 'Lucky Slide 100 X', svgaUrl: 'https://assets.flyliveapp.com/lucky/slides/100.svga', top: 150, height: 120 },
  { label: 'Entry — VIP 3', svgaUrl: 'https://assets.flyliveapp.com/vip/3/slide.svga', top: 150, height: 60 },
  { label: 'Entry — VIP 4', svgaUrl: 'https://assets.flyliveapp.com/vip/4/slide.svga', top: 150, height: 60 },
  { label: 'Entry — VIP 5', svgaUrl: 'https://assets.flyliveapp.com/vip/5/slide.svga', top: 150, height: 60 },
  { label: 'Entry — VIP 6', svgaUrl: 'https://assets.flyliveapp.com/vip/6/slide.svga', top: 150, height: 60 },
  { label: 'Entry — VIP 7', svgaUrl: 'https://assets.flyliveapp.com/vip/7/slide.svga', top: 150, height: 60 },
]

const DUMMY_AVATAR = 'https://lh3.googleusercontent.com/a/ACg8ocInsjfxhW72ehM2y6VU572uZ9T8bimDBUhgMumlbMCbO49p9ta0=s96-c'

// ---------- State ----------
const svgaUrl = ref(PRESETS[0]!.svgaUrl)
const top = ref(PRESETS[0]!.top)
const height = ref(PRESETS[0]!.height)
const textKey = ref('test')
const textValue = ref('DummyUser is the room')
const imageKey = ref('avatar')
const imageUrl = ref(DUMMY_AVATAR)
const clickable = ref(false)
const autoReplay = ref(true)
const showGuides = ref(true)

const runId = ref(0)
const visible = ref(true)
let replayTimer: ReturnType<typeof setTimeout> | null = null

// ---------- Derived ----------
const slide = computed<ActiveSlide>(() => ({
  instanceId: `dev-${runId.value}`,
  slideId: 1,
  svgaUrl: svgaUrl.value,
  top: top.value,
  height: height.value,
  scope: 'app',
  priority: 0,
  replaceElements: imageKey.value && imageUrl.value ? { [imageKey.value]: imageUrl.value } : {},
  texts: textKey.value && textValue.value ? { [textKey.value]: textValue.value } : {},
  link: { type: clickable.value ? 'track' : 'none', userId: clickable.value ? 1 : null },
  count: 1,
}))

// ---------- Handlers ----------
function replay(): void {
  if (replayTimer) clearTimeout(replayTimer)
  visible.value = false
  nextTick(() => {
    runId.value += 1
    visible.value = true
  })
}

function onComplete(): void {
  if (!autoReplay.value) return
  replayTimer = setTimeout(replay, REPLAY_DELAY_MS)
}

function applyPreset(p: (typeof PRESETS)[number]): void {
  svgaUrl.value = p.svgaUrl
  top.value = p.top
  height.value = p.height
  replay()
}

// Any config change restarts the animation so edits show immediately.
watch([svgaUrl, height, textKey, textValue, imageKey, imageUrl, clickable], replay)

onBeforeUnmount(() => {
  if (replayTimer) clearTimeout(replayTimer)
})
</script>

<template>
  <div class="dev-page">
    <!-- Fake app background so the overlay is judged against real-ish content -->
    <div class="dev-bg">
      <div v-if="showGuides" class="dev-guide" :style="{ top: `${top}px` }" />
      <p class="dev-hint">
        Slide overlay workbench (dev only) — edit
        <code>app/components/slide/OverlayItem.vue</code> and it hot-reloads here.
      </p>
    </div>

    <!-- Mirrors the real OverlayLayer positioning -->
    <div class="slide-overlay-layer">
      <div class="slide-overlay-slot" :style="{ top: `${top}px` }">
        <SlideOverlayItem
          v-if="visible"
          :key="slide.instanceId"
          :slide="slide"
          @complete="onComplete"
          @click="() => {}"
        />
      </div>
    </div>

    <div class="dev-panel">
      <div class="dev-row">
        <button v-for="p in PRESETS" :key="p.label" class="dev-btn" @click="applyPreset(p)">
          {{ p.label }}
        </button>
        <button class="dev-btn dev-btn--primary" @click="replay">Replay</button>
      </div>

      <label class="dev-field">
        <span>SVGA URL</span>
        <input v-model="svgaUrl" type="text">
      </label>

      <div class="dev-row">
        <label class="dev-field">
          <span>top (px) — {{ top }}</span>
          <input v-model.number="top" type="range" min="0" max="800">
        </label>
        <label class="dev-field">
          <span>height (px)</span>
          <input v-model.number="height" type="number" min="10" max="600">
        </label>
      </div>

      <div class="dev-row">
        <label class="dev-field">
          <span>text key</span>
          <input v-model="textKey" type="text">
        </label>
        <label class="dev-field">
          <span>text value</span>
          <input v-model="textValue" type="text">
        </label>
      </div>

      <div class="dev-row">
        <label class="dev-field">
          <span>image key</span>
          <input v-model="imageKey" type="text">
        </label>
        <label class="dev-field">
          <span>image URL</span>
          <input v-model="imageUrl" type="text">
        </label>
      </div>

      <div class="dev-row">
        <label class="dev-check"><input v-model="autoReplay" type="checkbox"> auto-replay</label>
        <label class="dev-check"><input v-model="clickable" type="checkbox"> clickable</label>
        <label class="dev-check"><input v-model="showGuides" type="checkbox"> guide line</label>
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

.dev-bg {
  position: absolute;
  inset: 0;
  background:
    repeating-linear-gradient(0deg, #1b1e26 0 39px, #232733 39px 40px);
}

.dev-hint {
  padding: 12px 16px;
  font-size: 13px;
  opacity: 0.7;
}

.dev-guide {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 1px dashed #ff5f8d;
}

/* copied from OverlayLayer.vue so positioning matches the real thing */
.slide-overlay-layer {
  position: absolute;
  inset: 0;
  z-index: 60;
  pointer-events: none;
}

.slide-overlay-slot {
  position: absolute;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
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

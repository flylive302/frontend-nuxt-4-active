<script setup lang="ts">
/**
 * Full-screen celebration after a claim succeeds: the unlock animation, the
 * new ID letter-spaced in a panel, and "Done" (closes it, no navigation). It REPLACES the screen
 * (a fixed layer over the page) rather than stacking a dialog on it. Shown while
 * `celebration` is set. Mounted once by <PrettyIdShell>, inside the theme root
 * (so the tokens and helper classes apply) — which is why it is not teleported.
 */
import { PRETTY_ID_ASSETS } from '~/constants/assets'
import { usePrettyIdStore } from '~/stores/prettyId'

// ========================================
// State
// ========================================

const store = usePrettyIdStore()
const { finishCelebration } = usePrettyIdClaimActions()

const titleId = useId()
const actionWrap = useTemplateRef<HTMLElement>('actionWrap')

const isOpen = computed(() => store.celebration !== null)
const isElite = computed(() => store.celebration?.slot === 'lv34')

const animationSrc = computed(() =>
  isElite.value ? PRETTY_ID_ASSETS.unlockLv34Svga : PRETTY_ID_ASSETS.unlockLv17Svga,
)
/** "Elite Lv 34" — the level comes from the slot, never a literal. */
const eliteLevel = computed(() => store.me?.slots.lv34.required_level ?? null)
const title = computed(() => {
  if (!isElite.value) return 'Congratulations!'
  return eliteLevel.value === null ? 'Elite' : `Elite Lv ${eliteLevel.value}`
})
const subline = computed(() => (isElite.value ? '4-digit Pretty ID · Diamond Crown' : '6-digit Pretty ID unlocked'))
const panelTitle = computed(() => (isElite.value ? 'Elite ID' : 'Your new ID'))
const celebratedId = computed(() => store.celebration?.id ?? '')
/** "5 2 0 5 2 0" — the digits stand apart, as in the design. */
const spacedId = computed(() => celebratedId.value.split('').join(' '))

// ========================================
// Composables
// ========================================

// The page behind must not scroll under the overlay. Not vueuse's `useScrollLock`: on
// iOS it cancels every `touchmove` that reaches <body>, which would also freeze this
// layer's own scrolling on a short phone. Held on <html>, not <body>: the claim dialog
// that is still closing under this layer resets `body.style.overflow` when it finishes.
let lockedFrom: string | null = null

function setPageScrollLocked(locked: boolean): void {
  const root = document.documentElement
  if (locked && lockedFrom === null) {
    lockedFrom = root.style.overflow
    root.style.overflow = 'hidden'
  } else if (!locked && lockedFrom !== null) {
    root.style.overflow = lockedFrom
    lockedFrom = null
  }
}

watch(isOpen, setPageScrollLocked, { immediate: true })
onScopeDispose(() => {
  setPageScrollLocked(false)
})

// The Android back button dismisses it like the button does.
useBackDismiss(isOpen, finishCelebration)

// ========================================
// Handlers
// ========================================

/** Once the layer has settled — the claim dialog is gone by then and no longer takes focus back. */
function focusAction(): void {
  actionWrap.value?.querySelector('button')?.focus()
}
</script>

<template>
  <Transition
    enter-active-class="pid-celebrate-enter-active"
    enter-from-class="pid-celebrate-enter-from"
    @after-enter="focusAction"
  >
    <div
      v-if="store.celebration"
      class="safe-area-top fixed inset-0 z-40 overflow-y-auto overscroll-contain bg-(--pid-bg-deep)"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      @keydown.tab.prevent="focusAction"
    >
      <div class="pid-celebrate mx-auto min-h-full max-w-[480px] px-3 pt-8 pb-10 text-center">
        <div class="pid-accent">
          <PrettyIdAnimation :src="animationSrc" />
        </div>

        <h2 :id="titleId" class="pid-disp pid-gold" :class="isElite ? 'text-[26px]' : 'text-[22px]'">{{ title }}</h2>
        <p class="pid-body pid-small my-1.5">{{ subline }}</p>

        <PrettyIdPanel :title="panelTitle">
          <div role="img" :aria-label="`Pretty ID ${celebratedId}`">
            <span
              class="pid-num pid-gold"
              :class="isElite ? 'text-[40px]' : 'text-[32px]'"
              aria-hidden="true"
            >{{ spacedId }}</span>
          </div>
        </PrettyIdPanel>

        <div ref="actionWrap">
          <PrettyIdButton @click="finishCelebration">Done</PrettyIdButton>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* `components` layer: below Tailwind utilities, so a utility on the element wins (see pretty-id.css). */
@layer components {
  .pid-celebrate {
    background: var(--pid-bg) var(--pid-img-marble) center / 420px repeat;
  }

  .pid-celebrate-enter-active {
    transition: opacity 250ms ease-out, transform 250ms ease-out;
  }

  .pid-celebrate-enter-from {
    opacity: 0;
    transform: scale(0.96);
  }

  @media (prefers-reduced-motion: reduce) {
    .pid-celebrate-enter-active {
      transition: opacity 250ms ease-out;
    }

    .pid-celebrate-enter-from {
      transform: none;
    }
  }
}
</style>

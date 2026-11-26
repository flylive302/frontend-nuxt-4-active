<script setup lang="ts">
/**
 * The full-screen layer shared by the claim celebration and the Rare ID win
 * celebration: a fixed marble page over the app with a centred phone-width
 * column, a fade/scale entrance (fade only under reduced motion), a page scroll
 * lock, focus kept on the action buttons, and the Android back button wired to
 * `close`. Content comes through slots: `default` is the body (animation,
 * title, panel), `actions` holds the buttons. Shown while `open`.
 *
 * Must sit inside a theme root (<PrettyIdTheme>) so the tokens and helper
 * classes apply — which is why it is not teleported.
 */
const props = defineProps<{
  open: boolean
  /** The id of the heading inside the default slot, for `aria-labelledby`. */
  labelledby: string
}>()

const emit = defineEmits<{
  close: []
}>()

// ========================================
// State
// ========================================

const actionWrap = useTemplateRef<HTMLElement>('actionWrap')
const isOpen = computed(() => props.open)

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

// The Android back button dismisses it like the "Done" button does.
useBackDismiss(isOpen, () => emit('close'))

// ========================================
// Handlers
// ========================================

/** Once the layer has settled — the claim dialog is gone by then and no longer takes focus back. */
function focusAction(): void {
  actionWrap.value?.querySelector('button')?.focus()
}

/** Focus stays on the buttons: Tab cycles between them instead of reaching the page behind. */
function cycleFocus(event: KeyboardEvent): void {
  const buttons = Array.from(actionWrap.value?.querySelectorAll('button') ?? [])
  if (buttons.length === 0) return
  const current = buttons.findIndex(button => button === document.activeElement)
  const step = event.shiftKey ? -1 : 1
  const next = current === -1 ? 0 : (current + step + buttons.length) % buttons.length
  buttons[next]?.focus()
}
</script>

<template>
  <!-- `appear`: the win celebration mounts already open and still plays the entrance. -->
  <Transition
    appear
    enter-active-class="pid-celebrate-enter-active"
    enter-from-class="pid-celebrate-enter-from"
    appear-active-class="pid-celebrate-enter-active"
    appear-from-class="pid-celebrate-enter-from"
    @after-enter="focusAction"
    @after-appear="focusAction"
  >
    <div
      v-if="open"
      class="safe-area-top fixed inset-0 z-40 overflow-y-auto overscroll-contain bg-(--pid-bg-deep)"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="labelledby"
      @keydown.tab.prevent="cycleFocus"
    >
      <div class="pid-celebrate mx-auto min-h-full max-w-[480px] px-3 pt-8 pb-10 text-center">
        <slot />

        <div ref="actionWrap" class="flex flex-wrap items-center justify-center gap-2.5">
          <slot name="actions" />
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

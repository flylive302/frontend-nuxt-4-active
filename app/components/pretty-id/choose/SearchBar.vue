<script setup lang="ts">
/**
 * The ID search box: a numeric field on the row frame and a gold SEARCH button.
 * Keeps its own text (digits only, at most `digits` long) and emits it on
 * submit — the parent decides what a search does. An empty submit clears it.
 */

// ========================================
// Config
// ========================================

const props = defineProps<{
  /** Digit count of the tier being searched. */
  digits: number
  /** Text to start with, e.g. the ID currently searched. */
  initial?: string
}>()

const emit = defineEmits<{
  submit: [value: string]
}>()

// ========================================
// Constants
// ========================================

const NON_DIGITS = /\D/g

// ========================================
// State
// ========================================

const text = ref(props.initial ?? '')

// A search set from outside (cleared by a tier switch) replaces whatever was typed.
watch(() => props.initial, (next) => {
  text.value = next ?? ''
})

// ========================================
// Handlers
// ========================================

function onInput(event: Event): void {
  const input = event.target as HTMLInputElement
  const digits = input.value.replace(NON_DIGITS, '').slice(0, props.digits)
  // Written back by hand: when a stripped letter leaves `text` unchanged, Vue sees
  // no change and would leave the letter on screen.
  input.value = digits
  text.value = digits
}

function onSubmit(): void {
  emit('submit', text.value)
}
</script>

<template>
  <form class="pid-search" role="search" @submit.prevent="onSubmit">
    <input
      :value="text"
      class="pid-search__input"
      type="text"
      inputmode="numeric"
      autocomplete="off"
      enterkeyhint="search"
      :aria-label="`Search a ${digits}-digit Pretty ID`"
      :placeholder="`Search a ${digits}-digit ID`"
      :maxlength="digits"
      @input="onInput"
    >
    <button type="submit" class="pid-search__submit">SEARCH</button>
  </form>
</template>

<style scoped>
/* `components` layer: below Tailwind utilities, so a utility on the element wins (see pretty-id.css). */
@layer components {
  .pid-search {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 52px;
    padding: 0 30px;
    background: var(--pid-img-row) center / 100% 100%;
  }

  /* The input has no outline of its own; the whole frame lights up instead. */
  .pid-search:has(:focus-visible) {
    outline: 2px solid var(--pid-gold);
    outline-offset: 2px;
  }

  .pid-search__input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: transparent;
    color: #fff;
    font: 600 16px var(--pid-font-body);
    outline: none;
  }

  .pid-search__input::placeholder {
    color: var(--pid-faint);
  }

  .pid-search__submit {
    align-self: stretch;
    border: 0;
    background: none;
    color: var(--pid-gold);
    font: 700 13px var(--pid-font-num);
    letter-spacing: 0.06em;
    cursor: pointer;
    outline: none;
  }
}
</style>

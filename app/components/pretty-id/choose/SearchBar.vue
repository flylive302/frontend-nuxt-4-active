<script setup lang="ts">
/**
 * The ID search box: a text field on the row frame and a gold SEARCH button.
 * Keeps its own text (letters A–Z and digits 0–9, shown UPPERCASE as typed, at
 * most `length` long) and emits it on submit — the parent decides what a search
 * does. An empty submit clears it.
 */

import { normalizeSignatureInput } from '~/utils/pretty-id-signature'

// ========================================
// Config
// ========================================

const props = defineProps<{
  /** Character count of the tier being searched. */
  length: number
  /** Text to start with, e.g. the ID currently searched. */
  initial?: string
}>()

const emit = defineEmits<{
  submit: [value: string]
}>()

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
  const next = normalizeSignatureInput(input.value, props.length)
  // Written back by hand: when a stripped symbol leaves `text` unchanged, Vue sees
  // no change and would leave the symbol on screen.
  input.value = next
  text.value = next
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
      inputmode="text"
      autocapitalize="characters"
      autocorrect="off"
      spellcheck="false"
      autocomplete="off"
      enterkeyhint="search"
      :aria-label="`Search a ${length}-character Pretty ID`"
      :placeholder="`Search a ${length}-character ID`"
      :maxlength="length"
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

<script setup lang="ts">
/**
 * The purple gel pill with a gold rim — the event's only call-to-action style.
 * Native `click` falls through to the <button>.
 */
withDefaults(defineProps<{
  size?: 'md' | 'sm'
  type?: 'button' | 'submit'
  disabled?: boolean
}>(), {
  size: 'md',
  type: 'button',
  disabled: false,
})
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    class="pid-btn"
    :class="{ 'pid-btn--sm': size === 'sm' }"
  >
    <slot />
  </button>
</template>

<style scoped>
/* `components` layer: below Tailwind utilities, so a utility on the element wins (see pretty-id.css). */
@layer components {
  .pid-btn {
    display: inline-grid;
    place-items: center;
    min-width: 150px;
    height: 52px;
    padding: 0 44px 2px;
    border: 0;
    background: var(--pid-img-button) center / 100% 100%;
    color: var(--pid-gold-ink);
    font-family: var(--pid-font-num);
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-shadow: 0 1px 2px #1a0628;
    white-space: nowrap;
    cursor: pointer;
    transition: transform 120ms ease-out, filter 120ms ease-out;
  }

  .pid-btn--sm {
    min-width: 110px;
    height: 40px;
    padding: 0 30px 2px;
    font-size: 12px;
  }

  .pid-btn:active:not(:disabled) {
    transform: scale(0.97);
    filter: brightness(1.1);
  }

  .pid-btn:focus-visible {
    outline: 2px solid var(--pid-gold);
    outline-offset: 2px;
  }

  .pid-btn:disabled {
    filter: grayscale(0.7) brightness(0.7);
    cursor: not-allowed;
  }

  @media (prefers-reduced-motion: reduce) {
    .pid-btn {
      transition: none;
    }
  }
}
</style>

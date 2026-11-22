<script setup lang="ts">
/**
 * Bottom sheet in the event's colours (winner details, the dev panel). Built on
 * USlideover, so Escape, outside-tap and the Android back button close it
 * through the app's standard dismiss path.
 *
 * USlideover teleports to <body>, outside the layout's theme root — hence the
 * inner <PrettyIdTheme>.
 */
defineProps<{
  open: boolean
  /** Accessible name of the sheet (not rendered). */
  title: string
}>()

const emit = defineEmits<{
  close: []
}>()

/** Replace USlideover's default surface with the event's violet sheet + gold lip. */
const SHEET_UI = {
  overlay: 'bg-[#0c0414cc] backdrop-blur-sm',
  content: 'inset-x-0 bottom-0 mx-auto max-w-[480px] max-h-[85dvh] overflow-y-auto rounded-t-[18px] border-t-2 border-[#d6a03e] bg-[#1d0a2c] ring-0 divide-y-0 shadow-[0_-10px_30px_#000a]',
} as const
</script>

<template>
  <USlideover
    :open="open"
    side="bottom"
    :title="title"
    :ui="SHEET_UI"
    @update:open="(value: boolean) => !value && emit('close')"
  >
    <template #content>
      <PrettyIdTheme>
        <!-- One calc, not `pb-6` + `.safe-area-bottom`: that helper is unlayered CSS and would
             replace the padding utility instead of adding the inset to it. -->
        <div class="px-4 pt-3.5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
          <slot />
        </div>
      </PrettyIdTheme>
    </template>
  </USlideover>
</template>

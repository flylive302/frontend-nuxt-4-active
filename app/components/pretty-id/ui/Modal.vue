<script setup lang="ts">
/**
 * Centred event dialog: a titled <PrettyIdPanel> over a blurred violet scrim.
 * Built on UModal, so Escape, outside-tap and the Android back button all
 * close it through the app's standard dismiss path.
 *
 * UModal teleports to <body>, outside the layout's theme root — hence the
 * inner <PrettyIdTheme>.
 */
defineProps<{
  open: boolean
  title: string
}>()

const emit = defineEmits<{
  close: []
}>()

/** Strip UModal's own card — the panel art is the surface. */
const MODAL_UI = {
  overlay: 'bg-[#0c0414cc] backdrop-blur-sm',
  content: 'bg-transparent ring-0 shadow-none divide-y-0 rounded-none overflow-y-auto max-w-[400px]',
} as const
</script>

<template>
  <UModal
    :open="open"
    :title="title"
    :ui="MODAL_UI"
    @update:open="(value: boolean) => !value && emit('close')"
  >
    <template #content>
      <PrettyIdTheme>
        <!-- Room for the panel's finial, corners and title plaque, which overhang its box. -->
        <div class="px-1 pt-9 pb-6">
          <PrettyIdPanel :title="title" class="my-0">
            <slot />
          </PrettyIdPanel>
        </div>
      </PrettyIdTheme>
    </template>
  </UModal>
</template>

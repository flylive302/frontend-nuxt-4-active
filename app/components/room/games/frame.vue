<script setup lang="ts">
/**
 * The game itself — iframe, launch spinner and error state.
 *
 * INTENT only. Rendered in exactly one place at a time: inside the sheet panel
 * (`half` / `tall`) or inside the full-screen overlay (`full`). It lives in its
 * own component so the iframe's attributes exist ONCE instead of being copied into
 * both containers and drifting.
 *
 * The parent (`drawer.vue`) owns the `frame` ref that `useRoomGames` posts
 * balance messages through, so the element is handed back up via `v-model:frame`.
 */
import type { ComponentPublicInstance } from 'vue';
import type { GamePanelStatus } from '~/types/room/games';

defineProps<{
  gameUrl: string | null;
  status: GamePanelStatus;
  errorMessage: string | null;
  title: string;
}>();

const emit = defineEmits<{
  loaded: [];
  retry: [];
}>();

const frame = defineModel<HTMLIFrameElement | null>('frame', { default: null });

function bindFrame(el: Element | ComponentPublicInstance | null): void {
  frame.value = el instanceof HTMLIFrameElement ? el : null;
}
</script>

<template>
  <div class="absolute inset-0">
    <!--
      `allow` is deliberately narrow. The game needs sound and fullscreen;
      it has no business with the microphone or the camera, both of which
      the live room is already using.
    -->
    <iframe
      v-if="gameUrl"
      :ref="bindFrame"
      :src="gameUrl"
      class="size-full border-0"
      :title="title"
      allow="autoplay; fullscreen"
      referrerpolicy="strict-origin"
      @load="emit('loaded')"
    />

    <!--
      ⛔ `launching` ONLY — never `loading`. Do not widen this condition.

      `launching` is our own API call for a session token, and it is fast.
      `loading` lasts until the iframe's `load` fires, which waits on a whole
      Cocos bundle and had not fired 20s after the player was already spinning
      on 2026-08-04. Covering that window would put a spinner over a playable
      game, which is the same defect the deleted load timeout caused.

      Once the iframe is attached, THEIR loader takes over — it shows a real
      progress number, which is better than a spinner of ours.
    -->
    <div
      v-if="status === 'launching'"
      class="absolute inset-0 flex items-center justify-center bg-neutral-900/60"
    >
      <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-primary" />
    </div>

    <div
      v-else-if="status === 'error'"
      class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-neutral-900/90 p-6 text-center"
    >
      <UIcon name="i-lucide-triangle-alert" class="size-8 text-warning" />
      <p class="text-sm text-neutral-200">
        {{ errorMessage ?? 'Games are unavailable right now.' }}
      </p>
      <UButton size="sm" color="primary" class="min-h-11 px-4" @click="emit('retry')">
        Try again
      </UButton>
    </div>
  </div>
</template>

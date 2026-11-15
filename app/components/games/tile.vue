<script setup lang="ts">
/**
 * One game in the picker — INTENT only: a button that reports which game was tapped.
 *
 * Text tile first, icon on top. The icon file (`public/images/games/<id>.webp`)
 * may not exist yet, so the name and category are always rendered and the `<img>`
 * is layered over them only once it has actually loaded. A 404 (or a decode error,
 * which is what the SPA fallback page produces when it answers a missing path with
 * HTML) hides the image and the text tile simply stays.
 */
import type { GameCatalogEntry } from '~/types/room/games';
import { gameIconUrl } from '~/utils/games';

const props = defineProps<{
  game: GameCatalogEntry;
}>();

const emit = defineEmits<{
  select: [game: GameCatalogEntry];
}>();

const iconLoaded = ref(false);
const iconFailed = ref(false);
const iconSrc = computed(() => gameIconUrl(props.game.game_id));
</script>

<template>
  <!--
    `min-h-11 min-w-11` is the 44px tap-target floor; the grid makes the tile far
    larger, the floor only matters if the grid is ever tightened.
    The accessible name is the game name — the icon is decoration (`alt=""`).
  -->
  <button
    type="button"
    :aria-label="game.name"
    class="relative flex aspect-square min-h-11 min-w-11 w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-lg bg-elevated p-2 text-center ring ring-default transition active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    @click="emit('select', game)"
  >
    <span class="line-clamp-2 text-sm font-medium text-highlighted">{{ game.name }}</span>
    <span class="text-xs text-muted">{{ game.category }}</span>

    <img
      v-if="!iconFailed"
      :src="iconSrc"
      alt=""
      decoding="async"
      class="absolute inset-0 size-full object-cover transition-opacity"
      :class="iconLoaded ? 'opacity-100' : 'opacity-0'"
      @load="iconLoaded = true"
      @error="iconFailed = true"
    >
  </button>
</template>

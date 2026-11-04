<script setup lang="ts">
/**
 * Games picker — the grid of tiles shown before any session exists.
 *
 * INTENT only. The catalogue and its states come in as props; a tap goes out as
 * `select`, a retry as `retry`. Nothing is fetched or launched here.
 *
 * Every state is designed: loading (skeleton tiles), empty, error (with a retry
 * button), ready. None relies on colour alone — each has its own text.
 */
import { GAME_PICKER_SKELETON_COUNT } from '~/constants/games';
import type { GameCatalogEntry, GameCatalogStatus } from '~/types/room/games';

defineProps<{
  games: readonly GameCatalogEntry[];
  status: GameCatalogStatus;
  errorMessage: string | null;
}>();

const emit = defineEmits<{
  select: [game: GameCatalogEntry];
  retry: [];
}>();
</script>

<template>
  <!--
    Same shape as the stock drawer container (`w-full flex flex-col gap-4 p-4
    overflow-y-auto`): the drawer's `max-h-[96%]` then makes a long catalogue
    scroll inside the sheet instead of running off the screen. The bottom
    safe-area inset is already on the drawer content (app.config.ts).
  -->
  <div class="flex min-h-0 w-full flex-col gap-4 overflow-y-auto p-4">
    <h2 class="text-base font-semibold text-highlighted">Choose a game</h2>

    <div v-if="status === 'idle' || status === 'loading'">
      <!-- One announcement for the whole grid; the skeletons are decoration. -->
      <p class="sr-only" role="status">Loading games</p>
      <ul class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5" aria-hidden="true">
        <li v-for="n in GAME_PICKER_SKELETON_COUNT" :key="n">
          <USkeleton class="aspect-square w-full rounded-lg" aria-hidden="true" />
        </li>
      </ul>
    </div>

    <div
      v-else-if="status === 'error'"
      class="flex flex-col items-center gap-3 py-6 text-center"
      role="alert"
    >
      <UIcon name="i-lucide-triangle-alert" class="size-8 text-warning" />
      <p class="text-sm text-default">
        {{ errorMessage ?? 'Games are unavailable right now.' }}
      </p>
      <UButton color="primary" class="min-h-11 px-4" @click="emit('retry')">
        Try again
      </UButton>
    </div>

    <div
      v-else-if="games.length === 0"
      class="flex flex-col items-center gap-2 py-6 text-center"
    >
      <UIcon name="i-lucide-gamepad-2" class="size-8 text-muted" />
      <p class="text-sm text-muted">No games available right now.</p>
    </div>

    <ul v-else class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
      <li v-for="game in games" :key="game.game_id">
        <RoomGamesTile :game="game" @select="emit('select', $event)" />
      </li>
    </ul>
  </div>
</template>

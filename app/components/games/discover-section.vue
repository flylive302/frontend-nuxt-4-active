<script setup lang="ts">
/**
 * Games section on the Discover page — the Fly games grid, and the full-screen
 * layer a tapped game opens in.
 *
 * INTENT only. Every decision lives in `useGamesPage` (catalogue, visibility, the
 * Fly bridge); this file binds it to the shared tile / frame / overlay components.
 *
 * Renders NOTHING while the catalogue is loading, failed or has no game for this
 * place — no skeleton, no error, no empty text — so a player outside the rollout
 * sees the Discover page exactly as before and the banners never shift. The
 * section's own spacing (`mb-6`, it sits above the events title) lives inside the
 * `v-if` for the same reason.
 *
 * The full-screen layer sits outside the section's `v-if`: it Teleports to
 * `<body>` and is driven by the open game, not by the grid's visibility.
 */
const {
  games,
  isSectionVisible,
  isOverlayOpen,
  gameTitle,
  status,
  gameUrl,
  errorMessage,
  frame,
  selectGame,
  closeGame,
  retry,
  onFrameLoaded,
} = useGamesPage();

function onRetry(): void {
  void retry();
}
</script>

<template>
  <section v-if="isSectionVisible" class="px-3 mb-6" aria-label="Games">
    <SectionTitle>Games</SectionTitle>

    <ul class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 mt-3">
      <li v-for="game in games" :key="game.game_id">
        <GamesTile :game="game" @select="selectGame" />
      </li>
    </ul>
  </section>

  <!-- ← and ✕ do the same thing here: there is no picker to go back to. -->
  <GamesFullScreenOverlay
    :open="isOverlayOpen"
    :title="gameTitle"
    @back="closeGame"
    @close="closeGame"
  >
    <GamesFrame
      v-model:frame="frame"
      :game-url="gameUrl"
      :status="status"
      :error-message="errorMessage"
      :title="gameTitle"
      @loaded="onFrameLoaded"
      @retry="onRetry"
    />
  </GamesFullScreenOverlay>
</template>

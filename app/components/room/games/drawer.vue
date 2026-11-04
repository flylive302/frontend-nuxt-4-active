<script setup lang="ts">
/**
 * Games Drawer — the JoyPlay surface over the live room.
 *
 * INTENT only. Every decision lives in `useRoomGames` (the session) and
 * `useGameCatalog` (the list); this file owns the button, the drawer, the
 * full-screen layer and the bindings between them.
 *
 * Two states: PICKER (a grid of games, no session minted yet) → GAME (the player
 * tapped a tile). Where the game renders follows its `layout`:
 *
 *   half / tall   the bottom drawer, in a 1:1 or 2:3 panel — the seats, the
 *                 participants and the audio controls stay visible behind it.
 *   full          a full-viewport layer. The room is hidden but NOT left: its
 *                 audio keeps playing underneath and our ✕ returns to the room.
 *
 * Full-screen games are allowed on purpose. Some games exist in no other size, and
 * a player who opens one chose to cover the room. Nothing ends the conversation —
 * only the picture is covered.
 */
import { GAME_PANEL_TITLE } from '~/constants/games';
import { useGameCatalog } from '~/composables/room/useGameCatalog';
import { useRoomGames } from '~/composables/room/useRoomGames';
import type { GameCatalogEntry } from '~/types/room/games';

const isOpen = defineModel<boolean>('open', { default: false });

const {
  games,
  status: catalogStatus,
  errorMessage: catalogError,
  load: loadCatalog,
  retry: retryCatalog,
} = useGameCatalog();

const {
  status,
  gameUrl,
  errorMessage,
  currentGame,
  container,
  isFullScreen,
  canPlay,
  frame,
  open,
  retry,
  close,
  onFrameLoaded,
} = useRoomGames({
  // The game's own exit button and its recharge prompt both end the session inside
  // the composable, but only the component owns `open` — without this the player
  // taps exit and is left with an empty square to dismiss by hand.
  onExitRequested: () => {
    isOpen.value = false;
  },
});

// Room-covered signal (room-battery-perf/03): pause seat and frame animation
// behind the panel while it is open. A game iframe on top of an active mediasoup
// session is the heaviest thing this app ever does on a low-end phone.
const { cover, uncover } = useRoomCovered();

/**
 * The drawer is closed while a full-screen game owns the screen, so the two never
 * stack. `isOpen` stays true throughout — it means "the games surface is open",
 * not "the drawer is".
 */
const isDrawerOpen = computed(() => isOpen.value && !isFullScreen.value);
const isOverlayOpen = computed(() => isOpen.value && isFullScreen.value);
const gameTitle = computed(() => currentGame.value?.name ?? GAME_PANEL_TITLE);

watch(isOpen, async (nowOpen) => {
  if (nowOpen) {
    // Picker only. No session is minted until a tile is tapped.
    cover();
    await loadCatalog();
    return;
  }

  uncover();
  await close();
});

function onDrawerOpenChange(next: boolean): void {
  // 🔴 Never read a `false` from the drawer as "the player closed the surface"
  // while a full-screen game is up.
  //
  // vaul echoes EVERY change of its own open state back out as `update:open` —
  // including the change WE cause by passing `:open="false"`. It watches its
  // internal flag and emits on each flip, immediate on mount too
  // (vaul-vue/dist/index.js:503-505 sets the flag from the prop, :544-546 emits on
  // it). So the moment a full game is picked, the drawer closes itself and reports
  // `false`; taking that at face value sets `isOpen` false, the watcher above runs
  // `close()`, and the session just minted is torn down. A real dismissal (handle,
  // overlay tap, Escape) can only happen while the drawer is visible, i.e. never
  // while `isFullScreen`.
  if (!next && isFullScreen.value) {
    return;
  }

  isOpen.value = next;
}

function onSelectGame(game: GameCatalogEntry): void {
  void open(game);
}

function onRetryCatalog(): void {
  void retryCatalog();
}

/** ← in the full-screen header: end the session, keep the surface, show the picker. */
function onBackToPicker(): void {
  void close();
}

/** ✕ in the full-screen header: the same exit the game's own close message takes. */
function onCloseSurface(): void {
  isOpen.value = false;
}

// The full-screen layer is a raw Teleport, not a Reka layer, so the Android back
// button's Escape dispatch cannot see it and would navigate away from the room
// with the game still up. Register it, and route back to the PICKER (one step up),
// not to closing the whole surface. The picker and the sheets are Reka layers and
// keep working through Escape.
useBackDismiss(isOverlayOpen, onBackToPicker);
</script>

<template>
  <!--
    🔴 STOCK NUXT UI DRAWER — no `:overlay` and no `:ui` overrides, by request
    (2026-08-04). Everything below is the library default: dimmed overlay, panel
    background, ring, rounded top, and the default handle.

    That means there are TWO ways out and both are ours: the handle, and tapping
    the overlay outside the panel. Neither depends on the vendor.

    ⛔ JoyPlay's own in-game ✕ is NOT a way out and must not be treated as one.
    Their build only posts `newTppClose` to the parent frame for partners
    hardcoded in an if/else chain; we fall through to a native WebView bridge that
    does not exist in a browser, so the tap is a silent no-op. We therefore stopped
    asking for that button (`showMiniExitBtn=0` in GameLaunchService::buildUrl) and
    their code hides it on its own. Root cause and the exact source lines are in
    docs/issues/game-integration/03-joyplay-integration-design.md.

    The `full` layout is the exception to "stock": it does not render in this
    drawer at all. See `RoomGamesFullScreenOverlay` below. While it is up this
    drawer is CLOSED (`isDrawerOpen`), and its `update:open` is filtered through
    `onDrawerOpenChange` — see the comment there.

    `title` and `description` stay because Reka UI wires them to `aria-labelledby`
    and `aria-describedby` — dropping them logs an accessibility warning and leaves
    screen readers announcing an unnamed dialog. They are never painted, because
    `#content` replaces the default header/body entirely.
  -->
  <UDrawer
    :open="isDrawerOpen"
    :title="GAME_PANEL_TITLE"
    :ui="{
      content: ''
    }"
    class="min-80vh"
    description="Play a game without leaving the room"
    @update:open="onDrawerOpenChange"
  >
    <UButton
      v-if="canPlay"
      size="xl"
      class="p-1"
      aria-label="Open games"
    >
      <UIcon class="size-8" name="i-lucide-gamepad-2" />
    </UButton>

    <template #content>
      <RoomGamesPicker
        v-if="!container"
        :games="games"
        :status="catalogStatus"
        :error-message="catalogError"
        @select="onSelectGame"
        @retry="onRetryCatalog"
      />

      <!--
        `panelClass` is the layout's aspect ratio plus a width cap that keeps the
        HEIGHT under ~85dvh on wide, short screens (constants/games.ts).
      -->
      <div
        v-else-if="container.mode === 'sheet'"
        class="relative overflow-hidden"
        :class="container.panelClass"
      >
        <RoomGamesFrame
          v-model:frame="frame"
          :game-url="gameUrl"
          :status="status"
          :error-message="errorMessage"
          :title="gameTitle"
          @loaded="onFrameLoaded"
          @retry="retry"
        />
      </div>
    </template>
  </UDrawer>

  <RoomGamesFullScreenOverlay
    :open="isOverlayOpen"
    :title="gameTitle"
    @back="onBackToPicker"
    @close="onCloseSurface"
  >
    <RoomGamesFrame
      v-model:frame="frame"
      :game-url="gameUrl"
      :status="status"
      :error-message="errorMessage"
      :title="gameTitle"
      @loaded="onFrameLoaded"
      @retry="retry"
    />
  </RoomGamesFullScreenOverlay>
</template>

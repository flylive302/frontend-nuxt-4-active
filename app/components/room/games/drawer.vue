<script setup lang="ts">
/**
 * Games Drawer — JoyPlay panel over the live room.
 *
 * INTENT only. Every decision lives in `useRoomGames`; this file owns the button,
 * the drawer and the iframe element, and nothing else.
 *
 * Half-screen by design (`mini=1` on the launch URL gives a 1:1 panel), so the
 * seats, the participants and the audio controls stay visible and audible behind
 * it. Players are mid-conversation — a full-screen game would end the conversation.
 */
import { GAME_PANEL_TITLE } from '~/constants/games';
import { useRoomGames } from '~/composables/room/useRoomGames';

const isOpen = defineModel<boolean>('open', { default: false });

const { status, gameUrl, errorMessage, canPlay, frame, open, close, onFrameLoaded } = useRoomGames({
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

watch(isOpen, async (nowOpen) => {
  if (nowOpen) {
    cover();
    await open();
    return;
  }

  uncover();
  await close();
});
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

    `title` and `description` stay because Reka UI wires them to `aria-labelledby`
    and `aria-describedby` — dropping them logs an accessibility warning and leaves
    screen readers announcing an unnamed dialog. They are never painted, because
    `#content` replaces the default header/body entirely.
  -->
  <UDrawer
    v-model:open="isOpen"
    :title="GAME_PANEL_TITLE"
    :ui="{
      content: ''
    }"
    class="min-80vh"
    description="Play a game without leaving the room"
  >
    <UButton
      v-if="canPlay"
      size="xl"
      variant="ghost"
      color="primary"
      class="p-0 text-primary"
      aria-label="Open games"
    >
      <UIcon class="size-8" name="i-lucide-gamepad-2" />
    </UButton>

    <template #content>
      <div class="relative aspect-square w-full overflow-hidden">
        <!--
          `allow` is deliberately narrow. The game needs sound and fullscreen;
          it has no business with the microphone or the camera, both of which
          the live room is already using.
        -->
        <iframe
          v-if="gameUrl"
          ref="frame"
          :src="gameUrl"
          class="size-full border-0"
          :title="GAME_PANEL_TITLE"
          allow="autoplay; fullscreen"
          referrerpolicy="strict-origin"
          @load="onFrameLoaded"
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
          <UButton size="sm" color="primary" @click="open">Try again</UButton>
        </div>
      </div>
    </template>
  </UDrawer>
</template>

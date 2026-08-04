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
    No overlay, no panel background: the game IS the panel.

    🔴 The handle STAYS, and it is not decoration — it is the only exit we control.
    An overlaid close button was tried on 2026-08-04 and reverted: anywhere inside
    the square covers the game's own controls, because their layout uses all four
    corners. The handle sits ABOVE the game and blocks nothing.

    Do not set `:handle="false"`. With no overlay to click outside of, and pointer
    events over the square going into the iframe rather than to Vaul (so
    swipe-to-dismiss does not work), removing it leaves a player with the game
    covering half the room and no way back. The game's own exit button posts
    `newTppClose` to us, but that is the same channel as `OpenGameSucc`, which this
    build logs internally and never actually posts up — so it cannot be the only
    way out.

    `title` and `description` stay because Reka UI wires them to `aria-labelledby`
    and `aria-describedby` — dropping them logs an accessibility warning and leaves
    screen readers announcing an unnamed dialog. They are never painted, because
    `#content` replaces the default header/body entirely.

    The `pb-[env(safe-area-inset-bottom)]` is the reason the game itself no longer
    asks for bottom clearance (see GameLaunchService::buildUrl): the home indicator
    is our layer's problem, and here the reserved strip is our own dark colour
    rather than a white band inside the game.
  -->
  <UDrawer
    v-model:open="isOpen"
    :title="GAME_PANEL_TITLE"
    :overlay="false"
    :ui="{
      content: 'bg-transparent ring-0 border-0 pb-[env(safe-area-inset-bottom)]',
      handle: 'bg-white/70!',
    }"
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

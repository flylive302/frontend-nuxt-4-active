<script setup lang="ts">
/**
 * Room Page — Full-screen room UI
 *
 * Pure presentation page. Room lifecycle (join/leave/reconnect) is managed
 * by useRoomLifecycle composable in app.vue. State comes from Pinia store.
 */

import type { StyleValue } from 'vue';
import { DEFAULT_SEAT_COUNT, SEAT_GRID_WIDE_THRESHOLD } from '~/constants/room';
import auth from '~/middleware/auth';

definePageMeta({
  layout: false,
  middleware: [auth, 'room-block'],
  // Transitions are global (nuxt.config `app.viewTransition: true`). The room-card
  // morph is activated per-nav by room-transition.global.ts, which also suppresses
  // the generic root slide for this nav — see main.css.
});

// ========================================
// State
// ========================================

const settingsOpen = ref(false);
// Held on the page, not inside the drawer, so leaving the room can close the
// games panel programmatically — an iframe left mounted keeps a vendor session
// alive behind a room the player has already left.
const gamesOpen = ref(false);
const volumePopoverOpen = ref(false);

// ========================================
// Composables
// ========================================

const route = useRoute();
const roomStore = useRoomStore();
const roomSessionStore = useRoomSessionStore();
const roomSession = useRoomSession();

const { roomExpandStyle } = useRoomExpandTransition();
const { src: roomBackgroundDisplaySrc } = useRoomBackground(() => roomStore.currentRoom?.background);
const { isLocalMuted, toggleLocalMute, isProducing, setVolume } = useRoomAudio();
const { floatingMultipliers } = useLuckyGift();
const { canPick: showLuckyNumberPickStrip } = useLuckyNumber();
const { volume, isMuted, volumeIcon, setLevel, toggleMute, applyStoredLevel } = useRoomVolume(setVolume);
const { rehydrateFromRoute, rehydrating } = useRoomRehydration();

// ========================================
// Derived room shape
// ========================================

/**
 * Authoritative seat count. Read once here so the grid class and the `v-for`
 * can never disagree — previously each re-derived the fallback on its own, and
 * the column branch compared a possibly-`undefined` `max_seats` against 15.
 */
const seatCount = computed(() => roomStore.currentRoom?.max_seats ?? DEFAULT_SEAT_COUNT);

/**
 * Tailwind only emits classes it can read literally in the source. The previous
 * `grid-cols-${…}` template literal produced no candidate, so `grid-cols-6` was
 * never generated and wide rooms fell back to a single stacked column.
 */
const seatGridClass = computed(() =>
  seatCount.value > SEAT_GRID_WIDE_THRESHOLD ? 'grid-cols-6' : 'grid-cols-5',
);

const roomColor = computed(() => roomStore.currentRoom?.primary_color ?? null);
useThemeColor(() => roomColor.value ?? '#000000');

/**
 * Local override for this subtree, driven straight off the room colour.
 *
 * The old version gated these on the *truthiness of the CSS variable read back
 * off the document root* via `useCssVar` — a `getComputedStyle` round-trip that
 * is empty during the first render, so the room primary colour only flipped in
 * after mount. Reading the store value directly makes the first paint correct.
 */
const roomThemeStyle = computed<StyleValue>(() => {
  const color = roomColor.value;
  if (!color) return {};
  return {
    '--ui-primary': color,
    '--ui-color-primary-500': color,
    '--ui-color-primary-600': color,
  };
});

const rootStyle = computed<StyleValue>(() => [roomExpandStyle, roomThemeStyle.value]);

/**
 * `--room-theme` must live on the document root, not on this subtree: every
 * room drawer and modal is teleported to `<body>` and reads it from there
 * (`var(--room-theme, …)`), so scoping it here would silently un-theme them.
 * Written directly rather than through `useCssVar`, which re-reads computed
 * styles off the root element on every change.
 */
function writeRoomThemeVar(color: string | null): void {
  if (!import.meta.client) return;
  const root = document.documentElement;
  if (color) root.style.setProperty('--room-theme', color);
  else root.style.removeProperty('--room-theme');
}

watch(roomColor, writeRoomThemeVar, { immediate: true });
onUnmounted(() => writeRoomThemeVar(null));

// ========================================
// Route Guard — rehydrate on cold mount, redirect only on a genuine leave
// ========================================

/**
 * A full reload nulls `currentRoom` (it is in-memory only), which is
 * indistinguishable from a genuine leave by store state alone. Attempt a
 * marker-authorised rehydrate before treating an empty store as "the user left"
 * — that conflation is what silently ejected reloading users.
 */
function leaveRoomPage(): void {
  const previous = roomSessionStore.previousRoute;
  const target = previous && !previous.startsWith('/room/') ? previous : '/';
  navigateTo(target, { replace: true });
}

watch(
  () => roomStore.currentRoom,
  async (room) => {
    if (room) return;
    // Already recovering — don't race the rehydrate with a redirect.
    if (rehydrating.value) return;

    const roomId = Number(route.params.id);
    if (Number.isFinite(roomId) && await rehydrateFromRoute(roomId)) return;

    leaveRoomPage();
  },
  { immediate: true },
);

// ========================================
// Lifecycle — body scroll lock + stored volume
// ========================================

onMounted(() => {
  // Being on the room page means the room is open, never minimized
  if (roomStore.isMinimized) roomSession.maximizeRoom();

  // Clears the inline `overflow`/`padding-right` a closing NuxtUI drawer
  // leaves on <body>. The `lock-body`/`unlock-body` classes this used to
  // toggle alongside it were defined nowhere in the app or the built CSS —
  // removing the attribute is the whole effect.
  document.body.removeAttribute('style');

  applyStoredLevel();
});

onUnmounted(() => {
  setTimeout(() => {
    document.body.removeAttribute('style');
  }, 100);
});
</script>

<template>
  <!-- `roomExpandStyle` names this element as the room card's counterpart: the
       card's box is interpolated into this one on entry, and back out on leave.
       The NuxtUI primary overrides are set here so they cascade to this
       subtree; `--room-theme` itself stays on the document root for the
       teleported drawers. -->
  <div
    class="absolute inset-0 z-50 p-1 safe-area-top safe-area-bottom overflow-hidden"
    :style="rootStyle"
  >
    <template v-if="roomStore.currentRoom">
      <!-- Background Image — first frame of the reveal, seeded from the card's cached bitmap -->
      <div class="absolute inset-0 z-0 tint-500">
        <img
          :src="roomBackgroundDisplaySrc"
          alt=""
          class="object-cover size-full"
          loading="eager"
          fetchpriority="high"
          decoding="async"
        >
      </div>

      <!-- Content — settles in over the background so lazily-mounted panels
           (drawers, chat, seats) never snap into place on top of it. -->
      <div class="room-content relative z-10 h-full flex flex-col pt-2">

        <!-- Lucky Gift Animations: no-draw notices, the single center cashback
             visual, and the room-visible sender activity bands (state-driven —
             see useLuckyGift / constants/lucky-animation.ts). -->
        <LuckyMultiplierFloat :floaters="floatingMultipliers" />
        <LuckyCashbackCenter />
        <LuckySenderBands />

        <RoomHeader />

        <RoomInfo />

        <!-- Audio Player: draggable floating panel, only rendered for the active music controller -->
        <RoomAudioPlayer />

        <!-- Seats Grid -->
        <div class="relative">
          <div class="scrollbar-hide max-h-[60vh] min-h-[40vh] overflow-y-auto scrollbox rounded-xl">
            <main class="grid gap-x-1" :class="seatGridClass">
              <RoomSeat v-for="i in seatCount" :key="i" :seat-id="i" />
            </main>
          </div>
          <!-- Lucky Number: countdown / drawn-number reveal over the grid (lucky-number/01) -->
          <RoomLuckyNumberCenter />
        </div>

        <LazyRoomSeatDrawer />
        <LazyRoomChatDrawer />

        <!-- Bottom Section: Chat + Controls -->
        <div class="flex grow gap-1 min-h-0 pl-2 pt-2">
          <!-- Chat Panel -->
          <div class="size-full flex flex-col">
            <RoomChatPanel />

            <!-- Lucky Number (lucky-number/02): seated users pick 1–9 here while a round is live -->
            <RoomLuckyNumberPickStrip v-if="showLuckyNumberPickStrip" />
            <div v-else class="flex justify-between py-1 mt-2 mb-3 bg-primary/10 shadow-md ring ring-primary/30 rounded-lg px-3">
              <!-- Room Settings Button -->
              <UButton
                  size="xl"
                  variant="ghost"
                  class="p-0 text-primary"
                  @click="() => { settingsOpen = true }"
              >
                <UIcon class="size-8" name="i-lucide-settings" />
              </UButton>

              <!-- Reaction Drawer trigger (ADR 0015) -->
              <LazyRoomReactionDrawer />

              <!-- Lucky Number start (owner/admin only; hidden when MSAB flag is off) -->
              <RoomLuckyNumberStartButton />

              <!-- Mic Mute/Unmute - only show when producing audio -->
              <UButton
                  v-if="isProducing"
                  size="xl"
                  variant="ghost"
                  :color="isLocalMuted ? 'error' : 'primary'"
                  :class="isLocalMuted ? 'text-white' : 'text-primary'"
                  class="p-0"
                  @click="() => { toggleLocalMute() }"
              >
                <UIcon class="size-8" :name="isLocalMuted ? 'i-lucide-mic-off' : 'i-lucide-mic'" />
              </UButton>
              <UButton v-else size="xl" class="text-primary p-0" variant="ghost" disabled >
                <UIcon class="size-8" name="i-lucide-mic" />
              </UButton>

              <!-- Chat composer trigger — opens the keyboard-pinned message bar -->
              <RoomChatComposer />

              <!-- Users Inbox Model View -->
              <LazyRoomInboxDrawer />

              <!-- Volume Control with Popover -->
              <UPopover v-model:open="volumePopoverOpen" :ui="{content: 'bg-transparent backdrop-blur-xl ring-0'}">
                <UButton
                    size="xl"
                    variant="ghost"
                    class="p-0 text-primary"
                    @click.right.prevent="toggleMute"
                >
                  <UIcon class="size-8" :name="volumeIcon" />
                </UButton>

                <template #content>
                  <div class="flex flex-col items-center gap-2 py-2 w-8">
                    <USlider
                        :model-value="volume"
                        :min="0"
                        :max="1"
                        :step="0.05"
                        orientation="vertical"
                        class="h-24 text-primary"
                        @update:model-value="setLevel"
                    />
                    <UButton
                        :icon="volumeIcon"
                        size="xs"
                        variant="ghost"
                        class="text-primary"
                        :aria-label="isMuted ? 'Unmute room audio' : 'Mute room audio'"
                        @click="toggleMute"
                    />
                  </div>
                </template>
              </UPopover>

            </div>
          </div>

          <!-- Side Controls & Gifting -->
          <div class="flex flex-col items-center gap-3 justify-end pb-3">
            <!-- Games Panel -->
            <LazyRoomGamesDrawer v-model:open="gamesOpen" />
            <!-- Games Panel End-->

            <!-- Gift Drawer -->
            <LazyRoomGiftDrawer />
            <!-- Gift Drawer End -->
          </div>

        </div>

      </div>

      <!-- Settings Drawer -->
      <LazyRoomSettingsDrawer v-model:open="settingsOpen" />

      <!-- Gift Playback Modal (full-screen, outside content area) -->
      <LazyRoomGiftPlaybackModal />

      <!-- Entry/gift/lucky slide banners now render through the global
           SlideOverlayLayer (app shell); the room-scoped RoomSlideBroadcast was
           retired in the unified-slide-overlay fold-in (ADR 0009). -->

      <!-- Lucky Gift Fly Animation (thumbnail: sender → center → receiver) -->
      <LuckyGiftFly />


    </template>

    <!-- Rehydrating after a reload — hold the page rather than redirecting, so a
         slow rejoin reads as work in progress instead of a freeze or an eject. -->
    <div v-else-if="rehydrating" class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3">
      <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-primary" />
      <p class="text-sm text-muted">Rejoining the room…</p>
    </div>
  </div>
</template>

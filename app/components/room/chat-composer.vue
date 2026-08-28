<script setup lang="ts">
import { useRoomAudio } from '~/composables/room/useRoomAudio';

const { sendChatMessage } = useRoomAudio();

// State
const isOpen = ref(false);
const messageInput = ref('');
const inputRef = ref<{ $el: HTMLElement } | null>(null);
const barRef = ref<HTMLElement | null>(null);
const triggerRef = ref<HTMLElement | null>(null);

// Composables
const { inset, isKeyboardOpen, hide: hideKeyboard } = useKeyboardInset(isOpen);

/**
 * Bottom offset of the composer bar.
 *
 * `inset` is how much of the viewport the keyboard covers, so sitting that far
 * up from the bottom edge parks the bar directly on top of it. With no keyboard
 * (desktop, or a device where nothing reports it) this is 0 and the bar simply
 * rests on the bottom edge.
 */
const barStyle = computed(() => ({
  bottom: `${inset.value}px`,
  // The system navigation bar is behind the keyboard while it is up, so its
  // safe-area padding only applies when the bar is resting on the screen edge.
  paddingBottom: isKeyboardOpen.value
    ? '0.5rem'
    : 'calc(0.5rem + env(safe-area-inset-bottom, 0px))',
}));

// Handlers
function getInputEl(): HTMLInputElement | null {
  return (inputRef.value?.$el?.querySelector('input') as HTMLInputElement | null) ?? null;
}

/** The trigger toggles: tapping it again while the bar is up puts it away. */
function handleTriggerClick(): void {
  if (isOpen.value) {
    handleClose();
    return;
  }
  handleOpen();
}

function handleOpen(): void {
  isOpen.value = true;
  // Focus SYNCHRONOUSLY inside the tap handler. Mobile browsers only raise the
  // keyboard while the user activation from that tap is still live, so this
  // must not move into `nextTick` — and the bar must never be `v-if`/`v-show`,
  // because a `display: none` input cannot take focus at all. It is hidden by
  // transform + opacity instead, which keeps it focusable.
  getInputEl()?.focus();
}

function handleClose(): void {
  if (!isOpen.value) return;
  // Put the keyboard away BEFORE dropping `isOpen`. Clearing that flag hands
  // keyboard ownership back to the browser, and the explicit dismissal is only
  // honoured while the composer still holds it.
  getInputEl()?.blur();
  hideKeyboard();
  isOpen.value = false;
  // The draft survives on purpose — dismissing the keyboard is how you go look
  // at the room, not how you abandon a half-typed message.
}

function handleSend(): void {
  const content = messageInput.value.trim();
  if (!content) return;

  sendChatMessage(content);
  messageInput.value = '';
  // Stay focused so the keyboard survives the send and the next message can be
  // typed straight away.
  getInputEl()?.focus();
}

/** The bar and its own trigger; everything else on screen counts as outside. */
function isInsideComposer(target: EventTarget | null): boolean {
  if (!(target instanceof Node)) return false;
  return barRef.value?.contains(target) === true
    || triggerRef.value?.contains(target) === true;
}

/**
 * Tapping anywhere else puts the keyboard away.
 *
 * Deliberately does NOT swallow the tap — whatever was tapped still does its
 * normal thing. Cancelling the gesture instead would mean intercepting
 * pointerdown, mousedown, touchend AND click across the whole room to stop the
 * click landing, which is a lot of interference to buy one dismissed keyboard.
 *
 * Capture phase, so a room handler that stops propagation cannot swallow this
 * first. `pointerdown` rather than `click` so the bar starts leaving on touch
 * rather than on release.
 */
function handleOutsidePointerDown(event: PointerEvent): void {
  if (isInsideComposer(event.target)) return;
  handleClose();
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    handleSend();
  }
}

// Dismissing the keyboard (Android back, the "done" key) takes the composer
// with it — that is the whole point of the pairing.
watch(isKeyboardOpen, (open, wasOpen) => {
  if (wasOpen && !open && isOpen.value) handleClose();
});

// Bound to the open state rather than left on permanently: a capture-phase
// document listener that runs on every tap in the room should not exist while
// the bar is down. Registered from a watcher, so the tap that opened the bar
// has already passed its own pointerdown and cannot close it again.
watch(isOpen, (open) => {
  if (open) {
    document.addEventListener('pointerdown', handleOutsidePointerDown, true);
    return;
  }
  document.removeEventListener('pointerdown', handleOutsidePointerDown, true);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleOutsidePointerDown, true);
});
</script>

<template>
  <div ref="triggerRef" class="flex">
    <UButton
        size="xl"
        variant="ghost"
        class="p-0 text-primary"
        aria-label="Write a message"
        @click="handleTriggerClick"
    >
      <UIcon class="size-8" name="i-lucide-message-square" />
    </UButton>
  </div>

  <!--
    Teleported out of the room tree: the room root is `z-50 overflow-hidden`, so
    a bar positioned inside it could neither escape the clip nor sit above the
    room's own overlays.
  -->
  <Teleport to="body">
    <div
        ref="barRef"
        class="fixed inset-x-0 z-[60] flex items-center gap-1 px-2 pt-2 bg-default/95 backdrop-blur-sm border-t border-primary/30 transition-[transform,opacity] duration-150 ease-out"
        :class="isOpen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'"
        :style="barStyle"
    >
      <UButton
          size="sm"
          variant="ghost"
          class="size-9 p-2 text-primary shrink-0"
          aria-label="Close message box"
          @click="handleClose"
      >
        <UIcon class="size-6" name="i-lucide-x" />
      </UButton>

      <UInput
          ref="inputRef"
          v-model="messageInput"
          :ui="{
            base: 'rounded-r-none rounded-l-full ring-0'
          }"
          class="w-full"
          size="lg"
          icon="i-lucide-user"
          placeholder="Type a message..."
          @keydown="handleKeydown"
          @keydown.esc="handleClose" />
      <!--
        `mousedown.prevent` sits on the wrapper, not on UButton. Focus change is
        the default action of mousedown, so cancelling the bubbled event keeps
        the input focused and the keyboard up across a send. Binding it to
        UButton would work only for as long as every layer of
        UButton -> ULink -> ULinkBase keeps passing attrs down to the native
        button — not a contract worth depending on for something this visible.
      -->
      <div class="shrink-0 flex" @mousedown.prevent>
        <UButton
            size="sm"
            variant="solid"
            color="neutral"
            class="size-9 p-2 rounded-l-none rounded-r-full bg-neutral-950!"
            :disabled="!messageInput.trim()"
            aria-label="Send message"
            @click="handleSend"
        >
          <UIcon class="size-8 text-primary" name="i-lucide-send" />
        </UButton>
      </div>
    </div>
  </Teleport>
</template>

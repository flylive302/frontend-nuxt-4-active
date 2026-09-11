/**
 * useChatClock — one shared ticking clock for chat relative timestamps.
 *
 * Module-level `ref` so every mounted chat-message shares a single interval
 * instead of one timer per message (500-message buffer cap). Ref-counted:
 * the interval starts with the first consumer and stops when the last scope
 * is disposed, so leaving the room tears it down.
 *
 * Stage: REACT (side-effect timer feeding a reactive value). No gating, no mutation.
 */
import { CHAT_CLOCK_TICK_MS } from '~/constants/room';

const now = ref(Date.now());
let consumers = 0;
let timer: ReturnType<typeof setInterval> | null = null;

function acquire(): void {
  consumers += 1;
  if (timer) return;
  now.value = Date.now();
  timer = setInterval(() => {
    now.value = Date.now();
  }, CHAT_CLOCK_TICK_MS);
}

function release(): void {
  consumers = Math.max(0, consumers - 1);
  if (consumers > 0 || !timer) return;
  clearInterval(timer);
  timer = null;
}

export function useChatClock(): { now: Readonly<Ref<number>> } {
  acquire();
  onScopeDispose(release);
  return { now: readonly(now) };
}

/**
 * useChatMessageActions — ONE shared context menu + ONE shared report modal
 * for the whole chat panel.
 *
 * A long-press / right-click can only ever target one message at a time, so
 * per-message `UDropdownMenu` + `ReportModal` instances (one pair per rendered
 * row, up to the scroller's window + buffer) were pure standing cost. State
 * lives at module level so `chat-message.vue` (INTENT: gesture) and
 * `chat-panel.vue` (owner of the single menu + modal) share it without props.
 *
 * Stages:
 *   - `openMenuFor`  GATE → EXECUTE: sets target + anchor, opens the menu.
 *   - `requestReport` EXECUTE: opens the shared modal for the current target.
 *   - `blockTarget`  EXECUTE: delegates to `useUserBlocking().blockUser`
 *                    (Apple 1.2 moderation path — must stay reachable on every
 *                    other-user message).
 */
import type { ChatMessageEvent } from '~/types/room/audio'

export interface MenuAnchor {
  x: number
  y: number
}

export interface ChatMenuItem {
  label: string
  icon: string
  color?: 'error'
  onSelect: () => void
}

const target = ref<ChatMessageEvent | null>(null)
const anchor = ref<MenuAnchor>({ x: 0, y: 0 })
const menuOpen = ref(false)
const reportOpen = ref(false)

const reportDescription = computed(() =>
  target.value ? `Room chat message: ${target.value.content}` : ''
)

export function useChatMessageActions() {
  function openMenuFor(message: ChatMessageEvent, at: MenuAnchor): void {
    target.value = message
    anchor.value = at
    menuOpen.value = true
  }

  function closeMenu(): void {
    menuOpen.value = false
  }

  function requestReport(): void {
    if (!target.value) return
    menuOpen.value = false
    reportOpen.value = true
  }

  // Resolved lazily so the composable stays importable in specs that do not
  // stub the API/toast globals `useUserBlocking` pulls in.
  async function blockTarget(): Promise<boolean> {
    if (!target.value) return false
    menuOpen.value = false
    const { blockUser } = useUserBlocking()
    return blockUser(target.value.userId)
  }

  // One nested array = one menu group, the shape UDropdownMenu expects.
  const menuItems = computed<ChatMenuItem[][]>(() => [[
    { label: 'Report message', icon: 'i-lucide-flag', onSelect: requestReport },
    { label: 'Block user', icon: 'i-lucide-user-x', color: 'error', onSelect: () => { void blockTarget() } },
  ]])

  return {
    target: readonly(target),
    anchor: readonly(anchor),
    menuOpen,
    reportOpen,
    reportDescription,
    menuItems,
    openMenuFor,
    closeMenu,
    requestReport,
    blockTarget,
  }
}

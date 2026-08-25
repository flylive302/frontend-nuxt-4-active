/**
 * Unit tests for the sender-local gift-sent chat bubble wiring (lucky-burst-draw
 * ticket 10 follow-up, HITL 2026-07-23): MSAB excludes the sender from
 * `gift:received`, so `send()`/`combo()` call `announceLocalGiftSend`
 * (exported from useRoomEventHandlers) directly instead of relying on the
 * broadcast. Uses REAL stores (not mocked) so the actual bubble content is
 * asserted, unlike useGiftSending.spec.ts which mocks this wiring out of scope.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed, watch, toRef } from 'vue'
import type { GiftSendAck } from '../../app/types/room/audio'
import { CHAT_MESSAGE_TYPE_GIFT } from '../../app/constants/room'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('watch', watch)
vi.stubGlobal('toRef', toRef)
vi.stubGlobal('createLogger', () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }))
vi.stubGlobal('useGiftPreload', vi.fn())
vi.stubGlobal('useLuckyFly', () => ({ triggerFly: vi.fn() }))
vi.stubGlobal('useToast', () => ({ add: vi.fn() }))
vi.stubGlobal('piniaPluginPersistedstate', {
  cookies: () => ({}),
  localStorage: () => ({}),
  sessionStorage: () => ({}),
})

const NORMAL_GIFT = { id: 9, name: 'Golden Rose', label: null, price: 500, category: 'normal', thumbnail_url: 'x.png' } as never
const LUCKY_GIFT = { id: 11, name: 'Lucky Coin', label: null, price: 100, category: 'lucky', thumbnail_url: 'y.png' } as never

async function setup(sendGiftMock: ReturnType<typeof vi.fn>) {
  const { useGiftComboStore } = await import('../../app/stores/giftCombo')
  const { useGiftStore } = await import('../../app/stores/gift')
  const { useAuthStore } = await import('../../app/stores/auth')
  const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
  const { useRoomAudioStore } = await import('../../app/stores/roomAudio')
  const { useRoomParticipantsStore } = await import('../../app/stores/roomParticipants')

  const comboStore = useGiftComboStore()
  const giftStore = useGiftStore()
  const authStore = useAuthStore()
  const seatsStore = useRoomSeatsStore()
  const audioStore = useRoomAudioStore()
  const participantsStore = useRoomParticipantsStore()

  authStore.user = { id: 1, name: 'Ali', coins: '100000' } as never

  vi.stubGlobal('useGiftComboStore', () => comboStore)
    vi.stubGlobal('useServerCapabilitiesStore', () => ({ ackBalance: false, giftBatch: false }))
  vi.stubGlobal('useGiftStore', () => giftStore)
  vi.stubGlobal('useAuthStore', () => authStore)
  vi.stubGlobal('useRoomSeatsStore', () => seatsStore)
  vi.stubGlobal('useRoomAudioStore', () => audioStore)
  vi.stubGlobal('useRoomParticipantsStore', () => participantsStore)
  vi.stubGlobal('useGiftEligibility', () => ({
    canAfford: computed(() => true),
    canSend: computed(() => true),
  }))
  vi.stubGlobal('useRoomAudio', () => ({ sendGift: sendGiftMock, isConnected: computed(() => true) }))

  seatsStore.updateSeat(0, 3, false)

  const { useGiftSending } = await import('../../app/composables/gift/useGiftSending')
  return { sending: useGiftSending(), giftStore, audioStore }
}

describe('useGiftSending — sender-local gift-sent chat bubble', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('send() synthesizes the sender-local bubble immediately (sender never receives their own gift:received)', async () => {
    const sendGiftMock = vi.fn().mockResolvedValue({ success: true, acceptedRecipientIds: [3] } satisfies GiftSendAck)
    const { sending, giftStore, audioStore } = await setup(sendGiftMock)

    giftStore.selectGift(NORMAL_GIFT)
    giftStore.setSelectedRecipientIds([3])
    giftStore.setQuantity(2)

    await sending.send()

    expect(audioStore.messages).toHaveLength(1)
    expect(audioStore.messages[0]?.type).toBe(CHAT_MESSAGE_TYPE_GIFT)
    expect(audioStore.messages[0]?.content).toBe('Ali sent Golden Rose ×2 to a recipient — 1,000 coins')
  })

  it('combo() patches the SAME bubble send() created, cumulative quantity + total', async () => {
    const sendGiftMock = vi.fn().mockResolvedValue({ success: true, acceptedRecipientIds: [3] } satisfies GiftSendAck)
    const { sending, giftStore, audioStore } = await setup(sendGiftMock)

    giftStore.selectGift(NORMAL_GIFT)
    giftStore.setSelectedRecipientIds([3])
    giftStore.setQuantity(1)
    await sending.send()
    await sending.combo()
    await sending.combo()

    expect(audioStore.messages).toHaveLength(1)
    expect(audioStore.messages[0]?.content).toBe('Ali sent Golden Rose ×3 to a recipient — 1,500 coins')
  })

  it('a lucky-category send() creates NO gift-sent bubble (lucky gifts announce only via the lucky-win slide bubble)', async () => {
    const sendGiftMock = vi.fn().mockResolvedValue({ success: true, acceptedRecipientIds: [3] } satisfies GiftSendAck)
    const { sending, giftStore, audioStore } = await setup(sendGiftMock)

    giftStore.selectGift(LUCKY_GIFT)
    giftStore.setSelectedRecipientIds([3])
    giftStore.setQuantity(1)

    await sending.send()

    expect(audioStore.messages).toHaveLength(0)
  })
})

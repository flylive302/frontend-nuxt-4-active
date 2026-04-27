import type { ThreadMessage } from '~/types/inbox'

const SELF_ID = 'me'

const minsAgo = (n: number) => new Date(Date.now() - n * 60_000).toISOString()
const hoursAgo = (n: number) => new Date(Date.now() - n * 3_600_000).toISOString()
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

const msg = (
  id: string,
  threadId: string,
  senderId: string | null,
  content: string,
  sentAt: string,
): ThreadMessage => ({ id, threadId, senderId, content, sentAt, isOwn: senderId === SELF_ID })

export const DUMMY_MESSAGES: Record<string, ThreadMessage[]> = {
  'user-1': [
    msg('m1-1', 'user-1', 'user-1', 'Hey! Are you free tonight to host a room?', daysAgo(1)),
    msg('m1-2', 'user-1', SELF_ID, 'Yes, planning to go live at 9pm.', daysAgo(1)),
    msg('m1-3', 'user-1', 'user-1', 'Awesome, I will be there!', daysAgo(1)),
    msg('m1-4', 'user-1', SELF_ID, 'See you then 🎙️', daysAgo(1)),
    msg('m1-5', 'user-1', 'user-1', 'Can you check the stream schedule for next week?', minsAgo(3)),
    msg('m1-6', 'user-1', 'user-1', 'I want to know when you are live.', minsAgo(2)),
  ],
  'user-2': [
    msg('m2-1', 'user-2', SELF_ID, 'That was a great collab session!', hoursAgo(24)),
    msg('m2-2', 'user-2', 'user-2', 'Totally! The audience loved it.', hoursAgo(23)),
    msg('m2-3', 'user-2', SELF_ID, 'We should do it again sometime.', minsAgo(48)),
    msg('m2-4', 'user-2', 'user-2', 'Great session yesterday! 🎤', minsAgo(47)),
  ],
  'user-3': [
    msg('m3-1', 'user-3', 'user-3', 'Are you joining tonight?', hoursAgo(4)),
    msg('m3-2', 'user-3', SELF_ID, 'See you in the room tonight!', hoursAgo(3)),
  ],
  'user-4': [
    msg('m4-1', 'user-4', SELF_ID, 'Hope you enjoy the gifts 🎁', hoursAgo(10)),
    msg('m4-2', 'user-4', 'user-4', 'Thanks for the gift 💎', hoursAgo(9)),
  ],
  'user-5': [
    msg('m5-1', 'user-5', 'user-5', 'Hey, my agency is paused for renovation.', daysAgo(2)),
    msg('m5-2', 'user-5', SELF_ID, 'When does your agency open again?', daysAgo(1)),
  ],
  'user-6': [
    msg('m6-1', 'user-6', 'user-6', 'Joined your fan club!', daysAgo(2)),
  ],
  'user-7': [
    msg('m7-1', 'user-7', 'user-7', 'Can we collab next week?', daysAgo(5)),
    msg('m7-2', 'user-7', SELF_ID, 'Looking forward to it.', daysAgo(4)),
  ],
  'user-8': [
    msg('m8-1', 'user-8', 'user-8', 'Your voice is so soothing 😊', daysAgo(6)),
  ],
  'user-9': [
    msg('m9-1', 'user-9', 'user-9', 'Love your live streams!', daysAgo(9)),
    msg('m9-2', 'user-9', SELF_ID, 'Thanks for dropping by!', daysAgo(8)),
  ],
  'user-10': [
    msg('m10-1', 'user-10', 'user-10', 'Incredible performance last night.', daysAgo(12)),
  ],
}

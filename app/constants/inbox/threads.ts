import type { Thread } from '~/types/inbox'

const now = new Date()
const minsAgo = (n: number) => new Date(now.getTime() - n * 60_000).toISOString()
const hoursAgo = (n: number) => new Date(now.getTime() - n * 3_600_000).toISOString()
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString()

export const DUMMY_THREADS: Thread[] = [
  {
    id: 'user-1',
    kind: 'dm',
    participant: {
      id: 'user-1',
      name: 'Aria Nakamura',
      avatar: 'https://i.pravatar.cc/150?img=47',
      frame: null,
    },
    lastMessage: 'Can you check the stream schedule for next week?',
    lastMessageAt: minsAgo(3),
    unreadCount: 2,
  },
  {
    id: 'user-2',
    kind: 'dm',
    participant: {
      id: 'user-2',
      name: 'Marco Rivera',
      avatar: 'https://i.pravatar.cc/150?img=12',
      frame: null,
    },
    lastMessage: 'Great session yesterday! 🎤',
    lastMessageAt: minsAgo(47),
    unreadCount: 0,
  },
  {
    id: 'user-3',
    kind: 'dm',
    participant: {
      id: 'user-3',
      name: 'Yuki Chen',
      avatar: 'https://i.pravatar.cc/150?img=31',
      frame: null,
    },
    lastMessage: 'You: See you in the room tonight!',
    lastMessageAt: hoursAgo(3),
    unreadCount: 0,
  },
  {
    id: 'user-4',
    kind: 'dm',
    participant: {
      id: 'user-4',
      name: 'Samira Al-Farsi',
      avatar: 'https://i.pravatar.cc/150?img=56',
      frame: null,
    },
    lastMessage: 'Thanks for the gift 💎',
    lastMessageAt: hoursAgo(9),
    unreadCount: 1,
  },
  {
    id: 'user-5',
    kind: 'dm',
    participant: {
      id: 'user-5',
      name: 'Dmitri Volkov',
      avatar: 'https://i.pravatar.cc/150?img=7',
      frame: null,
    },
    lastMessage: 'You: When does your agency open again?',
    lastMessageAt: daysAgo(1),
    unreadCount: 0,
  },
  {
    id: 'user-6',
    kind: 'dm',
    participant: {
      id: 'user-6',
      name: 'Priya Sharma',
      avatar: 'https://i.pravatar.cc/150?img=44',
      frame: null,
    },
    lastMessage: 'Joined your fan club!',
    lastMessageAt: daysAgo(2),
    unreadCount: 0,
  },
  {
    id: 'user-7',
    kind: 'dm',
    participant: {
      id: 'user-7',
      name: 'Leon Fischer',
      avatar: 'https://i.pravatar.cc/150?img=17',
      frame: null,
    },
    lastMessage: 'You: Looking forward to it.',
    lastMessageAt: daysAgo(4),
    unreadCount: 0,
  },
  {
    id: 'user-8',
    kind: 'dm',
    participant: {
      id: 'user-8',
      name: 'Chloe Martin',
      avatar: 'https://i.pravatar.cc/150?img=60',
      frame: null,
    },
    lastMessage: 'Your voice is so soothing 😊',
    lastMessageAt: daysAgo(6),
    unreadCount: 0,
  },
  {
    id: 'user-9',
    kind: 'dm',
    participant: {
      id: 'user-9',
      name: 'Hiro Tanaka',
      avatar: 'https://i.pravatar.cc/150?img=22',
      frame: null,
    },
    lastMessage: 'You: Thanks for dropping by!',
    lastMessageAt: daysAgo(8),
    unreadCount: 0,
  },
  {
    id: 'user-10',
    kind: 'dm',
    participant: {
      id: 'user-10',
      name: 'Sofia Esposito',
      avatar: 'https://i.pravatar.cc/150?img=39',
      frame: null,
    },
    lastMessage: 'Incredible performance last night.',
    lastMessageAt: daysAgo(12),
    unreadCount: 0,
  },
]

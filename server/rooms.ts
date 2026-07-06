import type { Room } from './types.js'

export const ROOMS: Room[] = [
  {
    id: 'room-2p-a',
    name: '2인석 A',
    capacity: 2,
    description: '모니터링 룸 · 2인석',
  },
  {
    id: 'room-2p-b',
    name: '2인석 B',
    capacity: 2,
    description: '모니터링 룸 · 2인석',
  },
  {
    id: 'room-1p',
    name: '1인석',
    capacity: 1,
    description: '모니터링 룸 · 1인석',
  },
]

export const ROOM_MAP = Object.fromEntries(ROOMS.map((r) => [r.id, r])) as Record<
  Room['id'],
  Room
>

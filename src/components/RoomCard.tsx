import { Users, User } from 'lucide-react'
import type { Room } from '@/lib/types'

const ICONS = {
  2: Users,
  1: User,
} as const

interface RoomCardProps {
  room: Room
  selected: boolean
  onSelect: () => void
}

export function RoomCard({ room, selected, onSelect }: RoomCardProps) {
  const Icon = ICONS[room.capacity as 1 | 2] ?? Users

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-xl border p-2.5 text-left transition active:scale-[0.99] ${
        selected
          ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600/20'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div className="flex items-center gap-2">
        <div
          className={`rounded-xl p-2 ${selected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}
        >
          <Icon size={18} />
        </div>
        <p className="text-xs font-semibold text-slate-900">{room.name}</p>
      </div>
    </button>
  )
}

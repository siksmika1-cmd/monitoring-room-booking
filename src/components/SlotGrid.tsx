import { Loader2 } from 'lucide-react'
import { formatTimeRange } from '@/lib/format'
import type { TimeSlot } from '@/lib/types'

interface SlotGridProps {
  slots: TimeSlot[]
  loading: boolean
  selectedStart?: string
  onSelect: (slot: TimeSlot) => void
}

export function SlotGrid({ slots, loading, selectedStart, onSelect }: SlotGridProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
        <Loader2 className="animate-spin" size={18} />
        시간표 불러오는 중...
      </div>
    )
  }

  if (slots.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">예약 가능한 시간이 없습니다.</p>
  }

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {slots.map((slot) => {
        const selected = selectedStart === slot.startAt
        const disabled = !slot.available

        return (
          <button
            key={slot.startAt}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(slot)}
            className={`rounded-lg border px-2 py-2 text-center text-xs font-medium transition ${
              disabled
                ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400 line-through'
                : selected
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-green-200 bg-green-50 text-green-700 hover:border-blue-400 hover:bg-blue-50'
            }`}
          >
            {formatTimeRange(slot.startAt, slot.endAt)}
            <span className={`mt-0.5 block text-xs font-normal ${selected ? 'text-blue-100' : ''}`}>
              {disabled ? '예약됨' : '클릭하여 예약'}
            </span>
          </button>
        )
      })}
    </div>
  )
}

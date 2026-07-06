import { blockKey, generateCandidateBlocks } from '@/lib/timeBlocks'
import type { TimeBlock } from '@/lib/types'

interface TimeBlockPickerProps {
  slotMinutes: number
  timeBlocks: TimeBlock[]
  onChange: (timeBlocks: TimeBlock[]) => void
  onSlotMinutesChange: (minutes: number) => void
}

export function TimeBlockPicker({
  slotMinutes,
  timeBlocks,
  onChange,
  onSlotMinutesChange,
}: TimeBlockPickerProps) {
  const candidates = generateCandidateBlocks(slotMinutes)
  const enabledKeys = new Set(timeBlocks.map(blockKey))

  const toggle = (block: TimeBlock) => {
    const key = blockKey(block)
    if (enabledKeys.has(key)) {
      onChange(timeBlocks.filter((b) => blockKey(b) !== key))
    } else {
      onChange([...timeBlocks, block].sort((a, b) => a.start.localeCompare(b.start)))
    }
  }

  const selectAll = () => onChange([...candidates])
  const clearAll = () => onChange([])

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs text-slate-500">
          블록 단위
          <select
            value={slotMinutes}
            onChange={(e) => onSlotMinutesChange(Number(e.target.value))}
            className="input w-auto py-1.5 text-xs"
          >
            <option value={30}>30분</option>
            <option value={60}>60분</option>
          </select>
        </label>
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            onClick={selectAll}
            className="rounded-lg border border-slate-200 px-2.5 py-1 hover:bg-slate-50"
          >
            전체 선택
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="rounded-lg border border-slate-200 px-2.5 py-1 hover:bg-slate-50"
          >
            전체 해제
          </button>
        </div>
      </div>

      <p className="mb-2 text-xs text-slate-500">
        예약을 받을 시간 블록을 클릭해 선택하세요. ({timeBlocks.length}개 선택됨)
      </p>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {candidates.map((block) => {
          const selected = enabledKeys.has(blockKey(block))
          return (
            <button
              key={blockKey(block)}
              type="button"
              onClick={() => toggle(block)}
              className={`rounded-xl border px-2 py-2.5 text-center text-xs font-medium transition ${
                selected
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50'
              }`}
            >
              {block.start}–{block.end}
            </button>
          )
        })}
      </div>
    </div>
  )
}

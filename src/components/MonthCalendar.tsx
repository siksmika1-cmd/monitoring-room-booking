import { useEffect, useMemo, useState } from 'react'
import {
  addMonths,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfDay,
  startOfMonth,
  subMonths,
} from 'date-fns'
import { ko } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { fetchMonthSummary } from '@/lib/api'
import { closedDayLabel, isClosedDay, isUnscheduledMonitoringDay } from '@/lib/closedDays'
import type { DaySeatSummary } from '@/lib/types'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

interface MonthCalendarProps {
  selected: string
  onSelect: (dateIso: string) => void
  /** 설정 변경 시 달력 잔여 좌석을 다시 불러옵니다 */
  scheduleRevision?: string
}

export function MonthCalendar({ selected, onSelect, scheduleRevision }: MonthCalendarProps) {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(parseISO(selected)))
  const [days, setDays] = useState<Record<string, DaySeatSummary>>({})
  const [loading, setLoading] = useState(true)

  const year = viewMonth.getFullYear()
  const month = viewMonth.getMonth() + 1
  const today = startOfDay(new Date())
  const minMonth = startOfMonth(today)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchMonthSummary(year, month)
      .then((data) => {
        if (!cancelled) setDays(data)
      })
      .catch(() => {
        if (!cancelled) setDays({})
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [year, month, scheduleRevision])

  const cells = useMemo(() => {
    const first = startOfMonth(viewMonth)
    const startPad = first.getDay()
    const grid: (Date | null)[] = Array.from({ length: startPad }, () => null)

    const cursor = new Date(first)
    while (isSameMonth(cursor, viewMonth)) {
      grid.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }

    while (grid.length % 7 !== 0) grid.push(null)
    return grid
  }, [viewMonth])

  const isMinMonth = viewMonth.getTime() <= minMonth.getTime()

  return (
    <section className="w-full rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold text-slate-700">예약 일자</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setViewMonth((m) => subMonths(m, 1))}
            disabled={isMinMonth}
            className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-30"
            aria-label="이전 달"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="min-w-[5.5rem] text-center text-xs font-semibold text-slate-800">
            {format(viewMonth, 'yyyy년 M월', { locale: ko })}
          </span>
          <button
            type="button"
            onClick={() => setViewMonth((m) => addMonths(m, 1))}
            className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50"
            aria-label="다음 달"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d, i) => (
          <div
            key={d}
            className={`py-1 text-center text-[11px] font-medium ${
              i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-400'
            }`}
          >
            {d}
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-xs text-slate-500">
          <Loader2 className="animate-spin" size={16} />
          달력 불러오는 중...
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} className="min-h-[2.75rem]" />

            const dateIso = format(day, 'yyyy-MM-dd')
            const isPast = isBefore(day, today)
            const isSelected = dateIso === selected
            const isToday = isSameDay(day, today)
            const summary = days[dateIso]
            const closed = isClosedDay(dateIso, summary)
            const unscheduled = isUnscheduledMonitoringDay(summary)
            const label = closedDayLabel(dateIso, summary)
            const available = summary?.available ?? 0
            const occupied = summary?.occupied ?? 0
            const full =
              !closed && !unscheduled && summary
                ? summary.available === 0 && summary.total > 0
                : false
            const showAvailability = !isPast && !closed && !unscheduled && summary && summary.total > 0

            return (
              <button
                key={dateIso}
                type="button"
                disabled={isPast || full || closed}
                onClick={() => onSelect(dateIso)}
                className={`flex min-h-[2.75rem] flex-col rounded-lg border p-1 text-left transition ${
                  isPast || closed
                    ? 'cursor-not-allowed border-transparent bg-slate-50 text-slate-300'
                    : full
                      ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400'
                      : isSelected
                        ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600/20'
                        : 'border-slate-100 bg-white hover:border-blue-200 hover:bg-blue-50/50'
                }`}
              >
                <span
                  className={`text-xs font-semibold leading-none ${
                    isToday && !closed
                      ? 'flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white'
                      : ''
                  } ${closed ? 'text-slate-300' : ''}`}
                >
                  {format(day, 'd')}
                </span>
                {!isPast && closed && (
                  <span className="mt-auto truncate text-[9px] font-medium leading-tight text-slate-400">
                    {label || '휴무'}
                  </span>
                )}
                {showAvailability && (
                  <div className="mt-auto leading-none">
                    <div className="flex items-center justify-center gap-1">
                      {available > 0 && (
                        <span className="text-[9px] font-semibold text-green-600">{available}</span>
                      )}
                      {occupied > 0 && (
                        <span className="text-[9px] font-semibold text-slate-400">{occupied}</span>
                      )}
                    </div>
                    <div className="mt-0.5 flex h-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="bg-green-500"
                        style={{ width: `${(available / summary.total) * 100}%` }}
                      />
                      <div
                        className="bg-slate-300"
                        style={{ width: `${(occupied / summary.total) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="text-[9px] font-semibold text-green-600">0</span>
          <span>예약 가능</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="text-[9px] font-semibold text-slate-400">0</span>
          <span>마감</span>
        </span>
        <span className="text-slate-400">주말·공휴일 휴무</span>
      </div>
    </section>
  )
}

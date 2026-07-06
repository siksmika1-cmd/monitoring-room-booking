import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookingForm } from '@/components/BookingForm'
import { MonthCalendar } from '@/components/MonthCalendar'
import { RoomCard } from '@/components/RoomCard'
import { SlotGrid } from '@/components/SlotGrid'
import { createBooking, fetchAvailability, fetchSettings } from '@/lib/api'
import { BOOKING_PAGE_TITLE } from '@/lib/constants'
import { useEmbed } from '@/lib/embed'
import { formatHoursRange, formatKoreanDate, todayIso } from '@/lib/format'
import { getDaySchedule, roomsForDate } from '@/lib/schedule'
import type { AppSettings, Booking, Room, RoomId, TimeSlot } from '@/lib/types'

interface BookingPageProps {
  onBooked: (booking: Booking) => void
}

function scheduleRevision(settings: AppSettings): string {
  return settings.updatedAt ?? JSON.stringify(settings.weekdaySchedules)
}

export function BookingPage({ onBooked }: BookingPageProps) {
  const embed = useEmbed()
  const [date, setDate] = useState(todayIso())
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [allRooms, setAllRooms] = useState<Room[]>([])
  const [roomId, setRoomId] = useState<RoomId | null>(null)
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [error, setError] = useState('')
  const [settingsLoading, setSettingsLoading] = useState(true)

  const revision = settings ? scheduleRevision(settings) : undefined

  const loadSettings = useCallback(() => {
    setSettingsLoading(true)
    fetchSettings()
      .then(({ settings: s, rooms: r }) => {
        setSettings(s)
        setAllRooms(r)
        setError('')
      })
      .catch((e) => setError(e instanceof Error ? e.message : '설정 불러오기 실패'))
      .finally(() => setSettingsLoading(false))
  }, [])

  const enabledRooms = useMemo(
    () => (settings ? roomsForDate(settings, allRooms, date) : []).filter((r) => r.enabled),
    [settings, allRooms, date],
  )
  const room = enabledRooms.find((r) => r.id === roomId) ?? enabledRooms[0]
  const daySchedule = settings ? getDaySchedule(settings, date) : null

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadSettings()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [loadSettings])

  useEffect(() => {
    if (enabledRooms.length === 0) {
      setRoomId(null)
      return
    }
    if (!roomId || !enabledRooms.some((r) => r.id === roomId)) {
      setRoomId(enabledRooms[0].id)
    }
  }, [enabledRooms, roomId])

  useEffect(() => {
    if (!roomId || !revision) return
    let cancelled = false
    setLoading(true)
    setError('')
    fetchAvailability(date, roomId)
      .then((data) => {
        if (!cancelled) setSlots(data)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '불러오기 실패')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [date, roomId, revision])

  if (settingsLoading || !settings || !daySchedule) {
    return (
      <div className="flex min-h-[40dvh] flex-col items-center justify-center gap-2 px-4 text-center text-sm">
        {error ? (
          <>
            <p className="text-red-600">{error}</p>
            <button
              type="button"
              onClick={loadSettings}
              className="rounded-lg bg-slate-800 px-4 py-2 text-white"
            >
              다시 시도
            </button>
          </>
        ) : (
          <p className="text-slate-500">설정 불러오는 중...</p>
        )}
      </div>
    )
  }

  return (
    <div className={embed ? 'app-container px-2 py-3' : 'app-container py-4'}>
      <header className={embed ? 'mb-3' : 'mb-4'}>
        {!embed && (
          <h1 className="text-base font-bold leading-snug text-ku-crimson">{BOOKING_PAGE_TITLE}</h1>
        )}
        <p className={`text-slate-500 ${embed ? 'text-[11px]' : 'mt-0.5 text-xs'}`}>
          외부 방문객 전용 · {formatKoreanDate(date)} 예약 가능 {formatHoursRange(settings, date)}
        </p>
      </header>

      <div className="mb-4">
        <MonthCalendar
          selected={date}
          scheduleRevision={revision}
          onSelect={(d) => {
            setDate(d)
            setSelectedSlot(null)
          }}
        />
      </div>

      <section className="mb-4">
        <h2 className="mb-2 text-xs font-semibold text-slate-700">좌석 선택</h2>
        {enabledRooms.length === 0 ? (
          <p className="text-xs text-slate-500">이 날짜에 예약 가능한 좌석이 없습니다.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {enabledRooms.map((r) => (
              <RoomCard
                key={r.id}
                room={r}
                selected={roomId === r.id}
                onSelect={() => {
                  setRoomId(r.id)
                  setSelectedSlot(null)
                }}
              />
            ))}
          </div>
        )}
      </section>

      {room && (
        <section className="rounded-xl border border-slate-200 bg-white p-3">
          <h2 className="mb-2 text-xs font-semibold text-slate-700">
            {room.name} · 예약 현황
          </h2>
          {error ? (
            <p className="py-6 text-center text-sm text-red-500">{error}</p>
          ) : (
            <SlotGrid
              slots={slots}
              loading={loading}
              selectedStart={selectedSlot?.startAt}
              onSelect={setSelectedSlot}
            />
          )}
        </section>
      )}

      {selectedSlot && room && (
        <BookingForm
          key={selectedSlot.startAt}
          room={room}
          date={date}
          slots={slots}
          settings={settings}
          initialSlot={selectedSlot}
          onClose={() => setSelectedSlot(null)}
          onSubmit={async (input) => {
            const booking = await createBooking(input)
            setSelectedSlot(null)
            onBooked(booking)
          }}
        />
      )}
    </div>
  )
}

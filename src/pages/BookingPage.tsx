import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { BookingForm } from '@/components/BookingForm'
import { MonthCalendar } from '@/components/MonthCalendar'
import { RoomCard } from '@/components/RoomCard'
import { SlotGrid } from '@/components/SlotGrid'
import { createBooking, fetchAvailability, fetchSettings } from '@/lib/api'
import { BOOKING_PAGE_TITLE } from '@/lib/constants'
import { useEmbed } from '@/lib/embed'
import { formatHoursRange, formatKoreanDate, todayIso } from '@/lib/format'
import { isDayScheduled, roomsForDate } from '@/lib/schedule'
import type { AppSettings, Booking, Room, RoomId, TimeSlot } from '@/lib/types'

interface BookingPageProps {
  onBooked: (booking: Booking) => void
}

function scheduleRevision(settings: AppSettings): string {
  return (
    settings.updatedAt ??
    JSON.stringify({ schedules: settings.weekdaySchedules, blocked: settings.blockedDates })
  )
}

function mergeSlots(availabilityByRoom: Partial<Record<RoomId, TimeSlot[]>>): TimeSlot[] {
  const byStart = new Map<string, TimeSlot>()

  for (const slots of Object.values(availabilityByRoom)) {
    for (const slot of slots ?? []) {
      const existing = byStart.get(slot.startAt)
      if (!existing) {
        byStart.set(slot.startAt, { ...slot })
      } else if (slot.available) {
        byStart.set(slot.startAt, { ...existing, available: true, bookingId: undefined })
      }
    }
  }

  return [...byStart.values()].sort((a, b) => a.startAt.localeCompare(b.startAt))
}

export function BookingPage({ onBooked }: BookingPageProps) {
  const embed = useEmbed()
  const [date, setDate] = useState(todayIso())
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [allRooms, setAllRooms] = useState<Room[]>([])
  const [roomId, setRoomId] = useState<RoomId | null>(null)
  const [availabilityByRoom, setAvailabilityByRoom] = useState<Partial<Record<RoomId, TimeSlot[]>>>({})
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [error, setError] = useState('')
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const revision = settings ? scheduleRevision(settings) : undefined

  const loadSettings = useCallback(() => {
    setSettingsLoading(true)
    return fetchSettings()
      .then(({ settings: s, rooms: r }) => {
        setSettings(s)
        setAllRooms(r)
        setError('')
      })
      .catch((e) => setError(e instanceof Error ? e.message : '설정 불러오기 실패'))
      .finally(() => setSettingsLoading(false))
  }, [])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    setSelectedSlot(null)
    setRoomId(null)
    setRefreshKey((k) => k + 1)
    await loadSettings()
    setRefreshing(false)
  }, [loadSettings])

  const enabledRooms = useMemo(
    () => (settings ? roomsForDate(settings, allRooms, date) : []).filter((r) => r.enabled),
    [settings, allRooms, date],
  )
  const roomsForSelectedSlot = useMemo(() => {
    if (!selectedSlot) return []
    return enabledRooms.filter((room) => {
      const roomSlots = availabilityByRoom[room.id] ?? []
      const slot = roomSlots.find((s) => s.startAt === selectedSlot.startAt)
      return slot?.available
    })
  }, [selectedSlot, enabledRooms, availabilityByRoom])
  const room = roomId ? roomsForSelectedSlot.find((r) => r.id === roomId) : undefined
  const roomSlots = room ? (availabilityByRoom[room.id] ?? []) : []
  const dayScheduled = settings ? isDayScheduled(settings, date) : false

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
      setAvailabilityByRoom({})
      setSlots([])
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')

    Promise.all(
      enabledRooms.map((roomOption) =>
        fetchAvailability(date, roomOption.id).then((roomAvailability) => [
          roomOption.id,
          roomAvailability,
        ] as const),
      ),
    )
      .then((entries) => {
        if (cancelled) return
        const byRoom = Object.fromEntries(entries) as Partial<Record<RoomId, TimeSlot[]>>
        setAvailabilityByRoom(byRoom)
        setSlots(mergeSlots(byRoom))
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
  }, [date, enabledRooms, revision, refreshKey])

  useEffect(() => {
    if (!selectedSlot) {
      setRoomId(null)
      return
    }
    if (roomId && !roomsForSelectedSlot.some((r) => r.id === roomId)) {
      setRoomId(null)
    }
  }, [selectedSlot, roomsForSelectedSlot, roomId])

  if (settingsLoading || !settings) {
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
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {!embed && (
              <h1 className="text-base font-bold leading-snug text-ku-crimson">{BOOKING_PAGE_TITLE}</h1>
            )}
            <p className={`text-slate-500 ${embed ? 'text-[11px]' : 'mt-0.5 text-xs'}`}>
              외부 방문객 전용 · {formatKoreanDate(date)} 예약 가능 {formatHoursRange(settings, date)}
            </p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="shrink-0 rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
            aria-label="새로고침"
            title="새로고침"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      <div className="mb-4">
        <MonthCalendar
          selected={date}
          scheduleRevision={revision}
          refreshKey={refreshKey}
          onSelect={(d) => {
            setDate(d)
            setSelectedSlot(null)
            setRoomId(null)
          }}
        />
      </div>

      {dayScheduled && (
        <section className="mb-4 rounded-xl border border-slate-200 bg-white p-3">
          <h2 className="mb-2 text-xs font-semibold text-slate-700">시간 선택</h2>
          {error ? (
            <p className="py-6 text-center text-sm text-red-500">{error}</p>
          ) : (
            <SlotGrid
              slots={slots}
              loading={loading}
              selectedStart={selectedSlot?.startAt}
              onSelect={(slot) => {
                setSelectedSlot(slot)
                setRoomId(null)
              }}
            />
          )}
        </section>
      )}

      {selectedSlot && (
        <section className="mb-4">
          <h2 className="mb-2 text-xs font-semibold text-slate-700">좌석 선택</h2>
          {roomsForSelectedSlot.length === 0 ? (
            <p className="text-xs text-slate-500">선택한 시간에 예약 가능한 좌석이 없습니다.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {roomsForSelectedSlot.map((r) => (
                <RoomCard
                  key={r.id}
                  room={r}
                  selected={roomId === r.id}
                  onSelect={() => setRoomId(r.id)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {selectedSlot && room && (
        <BookingForm
          key={`${room.id}-${selectedSlot.startAt}`}
          room={room}
          date={date}
          slots={roomSlots}
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

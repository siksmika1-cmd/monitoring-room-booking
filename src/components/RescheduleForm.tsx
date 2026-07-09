import { useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Loader2, X } from 'lucide-react'
import { RoomCard } from '@/components/RoomCard'
import { SlotGrid } from '@/components/SlotGrid'
import { fetchAvailability, fetchSettings } from '@/lib/api'
import {
  buildEndTimeOptions,
  buildTimeOptions,
  formatKoreanDate,
  formatTimeRange,
  isRangeAvailable,
  kstDateTimeFromParts,
  todayIso,
} from '@/lib/format'
import { roomsForDate } from '@/lib/schedule'
import type { AppSettings, Booking, CreateBookingInput, Room, RoomId, TimeSlot } from '@/lib/types'

type VisitorDefaults = Pick<
  CreateBookingInput,
  'visitorName' | 'visitorEmail' | 'visitorPhone' | 'protocolNo' | 'irbNo' | 'company' | 'purpose'
>

type ScheduleInput = Pick<CreateBookingInput, 'startAt' | 'endAt' | 'roomId'>

type RescheduleFormProps =
  | {
      mode: 'edit'
      booking: Booking
      onClose: () => void
      onSave: (input: ScheduleInput) => Promise<void>
    }
  | {
      mode: 'add'
      visitorDefaults?: Partial<VisitorDefaults>
      onClose: () => void
      onSave: (input: CreateBookingInput) => Promise<void>
    }

function slotsForReschedule(slots: TimeSlot[], bookingId?: string): TimeSlot[] {
  if (!bookingId) return slots
  return slots.map((slot) =>
    !slot.available && slot.bookingId === bookingId
      ? { ...slot, available: true, bookingId: undefined }
      : slot,
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

export function RescheduleForm(props: RescheduleFormProps) {
  const isAdd = props.mode === 'add'
  const booking = props.mode === 'edit' ? props.booking : undefined
  const excludeBookingId = booking?.id

  const initialDate = isAdd ? todayIso() : booking!.startAt.slice(0, 10)
  const [date, setDate] = useState(initialDate)
  const [roomId, setRoomId] = useState<RoomId | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [allRooms, setAllRooms] = useState<Room[]>([])
  const [availabilityByRoom, setAvailabilityByRoom] = useState<Partial<Record<RoomId, TimeSlot[]>>>({})
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(true)
  const [startTime, setStartTime] = useState(
    isAdd ? '' : format(parseISO(booking!.startAt), 'HH:mm'),
  )
  const [endTime, setEndTime] = useState(isAdd ? '' : format(parseISO(booking!.endAt), 'HH:mm'))
  const [name, setName] = useState(props.mode === 'add' ? (props.visitorDefaults?.visitorName ?? '') : '')
  const [protocolNo, setProtocolNo] = useState(
    props.mode === 'add' ? (props.visitorDefaults?.protocolNo ?? '') : '',
  )
  const [irbNo, setIrbNo] = useState(props.mode === 'add' ? (props.visitorDefaults?.irbNo ?? '') : '')
  const [email, setEmail] = useState(props.mode === 'add' ? (props.visitorDefaults?.visitorEmail ?? '') : '')
  const [phone, setPhone] = useState(
    props.mode === 'add' ? (props.visitorDefaults?.visitorPhone ?? '') : '',
  )
  const [company, setCompany] = useState(props.mode === 'add' ? (props.visitorDefaults?.company ?? '') : '')
  const [purpose, setPurpose] = useState(props.mode === 'add' ? (props.visitorDefaults?.purpose ?? '') : '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [initialized, setInitialized] = useState(isAdd)

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

  const selectedRoom = roomId ? roomsForSelectedSlot.find((r) => r.id === roomId) : undefined
  const adjustedSlots = useMemo(
    () => slotsForReschedule(roomId ? (availabilityByRoom[roomId] ?? []) : [], excludeBookingId),
    [availabilityByRoom, roomId, excludeBookingId],
  )

  const startOptions = useMemo(() => {
    if (!settings || !roomId) return []
    const all = buildTimeOptions(settings, date)
    return all.filter((start) =>
      buildEndTimeOptions(start, settings, date).some((end) =>
        isRangeAvailable(date, start, end, adjustedSlots, settings),
      ),
    )
  }, [settings, date, adjustedSlots, roomId])

  const endOptions = useMemo(
    () => (settings && roomId ? buildEndTimeOptions(startTime, settings, date) : []),
    [startTime, settings, date, roomId],
  )

  useEffect(() => {
    fetchSettings()
      .then(({ settings: s, rooms: r }) => {
        setSettings(s)
        setAllRooms(r)
      })
      .catch((e) => setError(e instanceof Error ? e.message : '설정 불러오기 실패'))
  }, [])

  useEffect(() => {
    if (enabledRooms.length === 0) {
      setAvailabilityByRoom({})
      setSlots([])
      setLoadingSlots(false)
      return
    }

    let cancelled = false
    setLoadingSlots(true)
    setError('')

    Promise.all(
      enabledRooms.map((roomOption) =>
        fetchAvailability(date, roomOption.id).then((roomAvailability) => [
          roomOption.id,
          slotsForReschedule(roomAvailability, excludeBookingId),
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
        if (!cancelled) setError(e instanceof Error ? e.message : '시간표 불러오기 실패')
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false)
      })

    return () => {
      cancelled = true
    }
  }, [date, enabledRooms, excludeBookingId])

  useEffect(() => {
    if (isAdd || initialized || loadingSlots || slots.length === 0 || date !== initialDate || !booking) {
      return
    }

    const match =
      slots.find((slot) => slot.startAt === booking.startAt && slot.available) ??
      slots.find((slot) => slot.available)

    if (match) {
      setSelectedSlot(match)
      setStartTime(format(parseISO(match.startAt), 'HH:mm'))
      setEndTime(format(parseISO(match.endAt), 'HH:mm'))
    }
    setInitialized(true)
  }, [isAdd, initialized, loadingSlots, slots, date, initialDate, booking])

  useEffect(() => {
    if (!selectedSlot) {
      setRoomId(null)
      return
    }
    if (roomId && !roomsForSelectedSlot.some((r) => r.id === roomId)) {
      setRoomId(null)
    }
  }, [selectedSlot, roomsForSelectedSlot, roomId])

  useEffect(() => {
    if (isAdd || !initialized || !selectedSlot || roomId || date !== initialDate || !booking) return
    if (roomsForSelectedSlot.some((r) => r.id === booking.roomId)) {
      setRoomId(booking.roomId)
    }
  }, [isAdd, initialized, selectedSlot, roomId, date, initialDate, booking, roomsForSelectedSlot])

  useEffect(() => {
    if (startOptions.length === 0) {
      setStartTime('')
      return
    }
    if (!startOptions.includes(startTime)) {
      setStartTime(startOptions[0])
    }
  }, [startOptions, startTime])

  useEffect(() => {
    if (!endOptions.includes(endTime)) {
      setEndTime(endOptions[0] ?? '')
    }
  }, [endOptions, endTime])

  const timeValid =
    settings &&
    roomId &&
    startTime &&
    endTime &&
    isRangeAvailable(date, startTime, endTime, adjustedSlots, settings)

  const visitorValid =
    !isAdd ||
    (name.trim() &&
      email.trim() &&
      phone.trim() &&
      protocolNo.trim() &&
      irbNo.trim())

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!timeValid || !roomId || saving || !visitorValid) return
    setError('')
    setSaving(true)
    try {
      const schedule = {
        startAt: kstDateTimeFromParts(date, startTime),
        endAt: kstDateTimeFromParts(date, endTime),
        roomId,
      }
      if (isAdd) {
        await props.onSave({
          ...schedule,
          visitorName: name.trim(),
          visitorEmail: email.trim(),
          visitorPhone: phone.trim(),
          protocolNo: protocolNo.trim(),
          irbNo: irbNo.trim(),
          company: company.trim() || undefined,
          purpose: purpose.trim() || undefined,
        })
      } else {
        await props.onSave(schedule)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : isAdd ? '저장 실패' : '수정 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0" aria-label="닫기" onClick={props.onClose} />
      <div className="relative max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{isAdd ? '일정 추가' : '일정 수정'}</h2>
            {!isAdd && <p className="text-sm text-slate-500">예약 번호 {booking!.id}</p>}
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">날짜 선택</span>
            <input
              type="date"
              value={date}
              min={todayIso()}
              onChange={(e) => {
                setDate(e.target.value)
                setSelectedSlot(null)
                setRoomId(null)
                setInitialized(true)
              }}
              className="input"
              required
            />
          </label>

          {enabledRooms.length > 0 && (
            <div>
              <span className="mb-2 block text-sm font-medium text-slate-700">시간 선택</span>
              {error && !loadingSlots ? (
                <p className="py-6 text-center text-sm text-red-500">{error}</p>
              ) : (
                <SlotGrid
                  slots={slots}
                  loading={loadingSlots}
                  selectedStart={selectedSlot?.startAt}
                  onSelect={(slot) => {
                    setSelectedSlot(slot)
                    setRoomId(null)
                    setStartTime(format(parseISO(slot.startAt), 'HH:mm'))
                    setEndTime(format(parseISO(slot.endAt), 'HH:mm'))
                  }}
                />
              )}
            </div>
          )}

          {selectedSlot && (
            <div>
              <span className="mb-2 block text-sm font-medium text-slate-700">좌석 선택</span>
              {roomsForSelectedSlot.length === 0 ? (
                <p className="text-sm text-slate-500">선택한 시간에 예약 가능한 좌석이 없습니다.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {roomsForSelectedSlot.map((room) => (
                    <RoomCard
                      key={room.id}
                      room={room}
                      selected={roomId === room.id}
                      onSelect={() => setRoomId(room.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedSlot && roomId && settings && startOptions.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">시작</span>
                  <select
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="input"
                    required
                  >
                    {startOptions.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">종료</span>
                  <select
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="input"
                    required
                    disabled={endOptions.length === 0}
                  >
                    {endOptions.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {startTime && endTime && selectedRoom && (
                <p className={`text-xs ${timeValid ? 'text-slate-500' : 'text-red-500'}`}>
                  {timeValid
                    ? `${formatKoreanDate(date)} · ${selectedRoom.name} · ${formatTimeRange(
                        kstDateTimeFromParts(date, startTime),
                        kstDateTimeFromParts(date, endTime),
                      )}`
                    : '선택한 시간대에 이미 예약이 있습니다.'}
                </p>
              )}
            </>
          )}

          {isAdd && selectedSlot && roomId && (
            <div className="space-y-3 border-t border-slate-100 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Protocol No." required>
                  <input
                    value={protocolNo}
                    onChange={(e) => setProtocolNo(e.target.value)}
                    className="input"
                    required
                  />
                </Field>
                <Field label="IRB No." required>
                  <input
                    value={irbNo}
                    onChange={(e) => setIrbNo(e.target.value)}
                    className="input"
                    required
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="이름" required>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input"
                    required
                  />
                </Field>
                <Field label="소속 (선택)">
                  <input
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="input"
                  />
                </Field>
              </div>
              <Field label="이메일" required>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  required
                />
              </Field>
              <Field label="연락처" required>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input"
                  required
                />
              </Field>
              <Field label="방문 목적 (선택)">
                <input
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="input"
                />
              </Field>
            </div>
          )}

          {selectedSlot && roomId && settings && startOptions.length === 0 && (
            <p className="text-sm text-slate-500">이 날짜에 예약 가능한 시간이 없습니다.</p>
          )}

          {error && loadingSlots && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={
              saving ||
              !timeValid ||
              !visitorValid ||
              loadingSlots ||
              !selectedSlot ||
              !roomId ||
              enabledRooms.length === 0
            }
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving && <Loader2 className="animate-spin" size={16} />}
            일정 저장
          </button>
        </form>
      </div>
    </div>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  )
}

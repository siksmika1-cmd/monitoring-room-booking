import { useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Loader2, X } from 'lucide-react'
import {
  buildEndTimeOptions,
  buildTimeOptions,
  formatKoreanDate,
  formatTimeRange,
  isRangeAvailable,
  kstDateTimeFromParts,
} from '@/lib/format'
import type { AppSettings, CreateBookingInput, Room, TimeSlot } from '@/lib/types'

interface BookingFormProps {
  room: Room
  date: string
  slots: TimeSlot[]
  settings: AppSettings
  initialSlot?: TimeSlot
  onClose: () => void
  onSubmit: (input: CreateBookingInput) => Promise<void>
}

function slotTimes(slot: TimeSlot) {
  return {
    start: format(parseISO(slot.startAt), 'HH:mm'),
    end: format(parseISO(slot.endAt), 'HH:mm'),
  }
}

export function BookingForm({
  room,
  date,
  slots,
  settings,
  initialSlot,
  onClose,
  onSubmit,
}: BookingFormProps) {
  const preset = initialSlot ? slotTimes(initialSlot) : null
  const startOptions = useMemo(() => {
    const all = buildTimeOptions(settings, date)
    return all.filter((start) =>
      buildEndTimeOptions(start, settings, date).some((end) =>
        isRangeAvailable(date, start, end, slots, settings),
      ),
    )
  }, [settings, date, slots])
  const [startTime, setStartTime] = useState(preset?.start ?? '')
  const endOptions = useMemo(
    () => buildEndTimeOptions(startTime, settings, date),
    [startTime, settings, date],
  )
  const [endTime, setEndTime] = useState(preset?.end ?? '')

  const [name, setName] = useState('')
  const [protocolNo, setProtocolNo] = useState('')
  const [irbNo, setIrbNo] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [purpose, setPurpose] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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

  if (startOptions.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="rounded-2xl bg-white p-6 text-center shadow-xl">
          <p className="text-sm text-slate-600">이 날짜에 예약 가능한 시간이 없습니다.</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            닫기
          </button>
        </div>
      </div>
    )
  }

  const timeValid =
    startTime &&
    endTime &&
    isRangeAvailable(date, startTime, endTime, slots, settings)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    if (!timeValid) {
      setError('선택한 시간에 예약할 수 없습니다. 다른 시간을 선택해 주세요.')
      return
    }

    setError('')
    setLoading(true)
    try {
      await onSubmit({
        roomId: room.id,
        startAt: kstDateTimeFromParts(date, startTime),
        endAt: kstDateTimeFromParts(date, endTime),
        visitorName: name,
        visitorEmail: email,
        visitorPhone: phone,
        protocolNo,
        irbNo,
        company: company || undefined,
        purpose: purpose || undefined,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '예약에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0" aria-label="닫기" onClick={onClose} />
      <div className="relative max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h2 className="text-lg font-bold text-slate-900">예약 정보 입력</h2>
            <span className="text-sm text-slate-500">
              {formatKoreanDate(date)} · {room.name}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="시작 시간" required>
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
            </Field>
            <Field label="종료 시간" required>
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
            </Field>
          </div>

          {startTime && endTime && (
            <p
              className={`text-xs ${timeValid ? 'text-slate-500' : 'text-red-500'}`}
            >
              {timeValid
                ? `선택: ${formatTimeRange(kstDateTimeFromParts(date, startTime), kstDateTimeFromParts(date, endTime))}`
                : '선택한 시간대에 이미 예약이 있습니다.'}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Protocol No." required>
              <input
                value={protocolNo}
                onChange={(e) => setProtocolNo(e.target.value)}
                className="input"
                placeholder="Protocol No."
                required
              />
            </Field>
            <Field label="IRB No." required>
              <input
                value={irbNo}
                onChange={(e) => setIrbNo(e.target.value)}
                className="input"
                placeholder="IRB No."
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
                placeholder="홍길동"
                required
              />
            </Field>
            <Field label="소속 (선택)">
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="input"
                placeholder="회사명"
              />
            </Field>
          </div>
          <Field label="이메일" required>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="visitor@email.com"
              required
            />
          </Field>
          <Field label="연락처" required>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input"
              placeholder="010-0000-0000"
              required
            />
          </Field>
          <Field label="방문 목적 (선택)">
            <input
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="input"
              placeholder="모니터링 / 미팅 등"
            />
          </Field>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading || !timeValid}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading && <Loader2 className="animate-spin" size={16} />}
            예약 확정
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

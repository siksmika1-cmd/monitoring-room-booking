import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarClock, Loader2, Plus, RotateCcw, Search, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { RescheduleForm } from '@/components/RescheduleForm'
import { cancelBooking, createBooking, lookupBooking, restoreBooking, updateBookingSchedule } from '@/lib/api'
import { BookingHomeLink } from '@/lib/bookingNav'
import { useEmbed } from '@/lib/embed'
import { formatKoreanDate, formatTimeRange } from '@/lib/format'
import type { Booking } from '@/lib/types'

function sortBookingsByDate(bookings: Booking[]): Booking[] {
  return [...bookings].sort((a, b) => a.startAt.localeCompare(b.startAt))
}

function countFilledFields(bookingId: string, visitorName: string, email: string): number {
  let count = 0
  if (bookingId.trim()) count++
  if (visitorName.trim()) count++
  if (email.trim()) count++
  return count
}

type ConfirmAction = 'cancel' | 'restore'

export function MyBookingPage() {
  const embed = useEmbed()
  const [params] = useSearchParams()
  const [bookingId, setBookingId] = useState(() => params.get('id')?.toUpperCase() ?? '')
  const [visitorName, setVisitorName] = useState('')
  const [email, setEmail] = useState('')
  const [booking, setBooking] = useState<Booking | null>(null)
  const [lookupResults, setLookupResults] = useState<Booking[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [rescheduling, setRescheduling] = useState(false)
  const [adding, setAdding] = useState(false)

  const lookupCriteria = () => ({
    bookingId: bookingId.trim() || undefined,
    visitorName: visitorName.trim() || undefined,
    email: email.trim() || undefined,
  })

  const performLookup = async (selectId?: string) => {
    const results = sortBookingsByDate(await lookupBooking(lookupCriteria()))
    setLookupResults(results)
    const selected = selectId
      ? results.find((item) => item.id === selectId) ?? null
      : results.length === 1
        ? results[0]
        : null
    setBooking(selected)
    return results
  }

  const visitorDefaults = () => {
    const template = booking ?? lookupResults[0]
    return {
      visitorName: visitorName.trim() || template?.visitorName || '',
      visitorEmail: email.trim() || template?.visitorEmail || '',
      visitorPhone: template?.visitorPhone || '',
      protocolNo: template?.protocolNo || '',
      irbNo: template?.irbNo || '',
      company: template?.company || '',
      purpose: template?.purpose || '',
    }
  }

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (countFilledFields(bookingId, visitorName, email) < 2) {
      setError('예약 번호, 예약자 이름, 이메일 중 2가지 이상 입력해 주세요')
      return
    }

    setLoading(true)
    setBooking(null)
    setLookupResults([])
    try {
      await performLookup()
    } catch (err) {
      setError(err instanceof Error ? err.message : '조회 실패')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmAction = async () => {
    if (!booking || !confirmAction) return
    setActionLoading(true)
    setError('')
    try {
      if (confirmAction === 'cancel') {
        const result = await cancelBooking(booking.id, booking.cancelToken)
        setBooking(result)
        setLookupResults((items) => sortBookingsByDate(
          items.map((item) => (item.id === result.id ? result : item)),
        ))
      } else {
        const result = await restoreBooking(booking.id, booking.cancelToken)
        setBooking(result)
        setLookupResults((items) => sortBookingsByDate(
          items.map((item) => (item.id === result.id ? result : item)),
        ))
      }
      setConfirmAction(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '처리 실패')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className={embed ? 'app-container px-2 py-4' : 'app-container py-6'}>
      <h1 className="mb-1 text-2xl font-bold text-slate-900">내 예약 확인</h1>
      <p className="mb-6 text-sm text-slate-500">
        예약 번호, 예약자 이름, 이메일 중 <strong>2가지 이상</strong> 입력하면 조회할 수 있습니다.
      </p>

      <form onSubmit={handleLookup} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">예약 번호</span>
          <input
            value={bookingId}
            onChange={(e) => setBookingId(e.target.value)}
            className="input uppercase"
            placeholder="AB12CD34"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">예약자 이름</span>
          <input
            value={visitorName}
            onChange={(e) => setVisitorName(e.target.value)}
            className="input"
            placeholder="홍길동"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">이메일</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            placeholder="visitor@email.com"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
            조회
          </button>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-blue-200 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            <Plus size={16} />
            예약추가
          </button>
          <BookingHomeLink to="/" className="flex flex-1 items-center justify-center rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            나가기
          </BookingHomeLink>
        </div>
      </form>

      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

      {lookupResults.length > 1 && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            조회된 예약 {lookupResults.length}건
          </h2>
          <p className="mb-3 text-xs text-slate-500">확인할 예약을 선택해 주세요.</p>
          <ul className="space-y-2">
            {lookupResults.map((item) => {
              const selected = booking?.id === item.id
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setBooking(item)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition ${
                      selected
                        ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {formatKoreanDate(item.startAt)}
                      <span className="mx-2 text-slate-300">·</span>
                      <span className="text-slate-600">{item.protocolNo}</span>
                    </p>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {booking && (
        <BookingDetailCard
          booking={booking}
          actionLoading={actionLoading}
          onEdit={() => setRescheduling(true)}
          onCancel={() => setConfirmAction('cancel')}
          onRestore={() => setConfirmAction('restore')}
        />
      )}

      <ConfirmDialog
        open={confirmAction === 'cancel'}
        title="예약 취소"
        message="예약을 취소할까요? 취소 후에도 예약 번호로 복구할 수 있습니다."
        confirmLabel="취소하기"
        danger
        loading={actionLoading}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmAction(null)}
      />

      <ConfirmDialog
        open={confirmAction === 'restore'}
        title="예약 복구"
        message="취소된 예약을 원래 일정으로 복구할까요? 해당 시간이 이미 예약되어 있으면 복구할 수 없습니다."
        confirmLabel="복구하기"
        loading={actionLoading}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmAction(null)}
      />

      {rescheduling && booking && (
        <RescheduleForm
          mode="edit"
          booking={booking}
          onClose={() => setRescheduling(false)}
          onSave={async (input) => {
            const result = await updateBookingSchedule(booking.id, booking.cancelToken, input)
            setBooking(result)
            setLookupResults((items) => sortBookingsByDate(
              items.map((item) => (item.id === result.id ? result : item)),
            ))
            setRescheduling(false)
          }}
        />
      )}

      {adding && (
        <RescheduleForm
          mode="add"
          visitorDefaults={visitorDefaults()}
          onClose={() => setAdding(false)}
          onSave={async (input) => {
            const created = await createBooking(input)
            setAdding(false)
            setError('')
            if (countFilledFields(bookingId, visitorName, email) >= 2) {
              try {
                await performLookup(created.id)
              } catch (err) {
                setError(err instanceof Error ? err.message : '조회 실패')
                setBooking(created)
                setLookupResults([created])
              }
            } else {
              setBooking(created)
              setLookupResults([created])
            }
          }}
        />
      )}
    </div>
  )
}

function BookingDetailCard({
  booking,
  actionLoading,
  onEdit,
  onCancel,
  onRestore,
}: {
  booking: Booking
  actionLoading: boolean
  onEdit: () => void
  onCancel: () => void
  onRestore: () => void
}) {
  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">
        {formatKoreanDate(booking.startAt)}
        <span className="mx-2 text-slate-300">·</span>
        <span className="font-mono text-xs tracking-wide text-slate-600">{booking.id}</span>
      </p>
      <p className="mt-1 text-sm text-slate-600">
        {formatTimeRange(booking.startAt, booking.endAt)}
        <span className="mx-2 text-slate-300">·</span>
        {booking.roomName}
      </p>
      <dl className="mt-4 space-y-2 text-sm">
        <Row label="방문자" value={booking.visitorName} />
        <Row label="Protocol No." value={booking.protocolNo} />
        <Row label="IRB No." value={booking.irbNo} />
        <Row label="이메일" value={booking.visitorEmail} />
        <Row label="연락처" value={booking.visitorPhone} />
        {booking.company && <Row label="소속" value={booking.company} />}
        {booking.purpose && <Row label="목적" value={booking.purpose} />}
      </dl>

      {booking.status === 'confirmed' && (
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
          >
            <CalendarClock size={14} />
            수정
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={actionLoading}
            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            <Trash2 size={14} />
            취소
          </button>
        </div>
      )}

      {booking.status === 'cancelled' && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onRestore}
            disabled={actionLoading}
            className="inline-flex items-center gap-1 rounded-lg border border-green-200 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-50 disabled:opacity-60"
          >
            <RotateCcw size={14} />
            예약 복구
          </button>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-800">{value}</dd>
    </div>
  )
}

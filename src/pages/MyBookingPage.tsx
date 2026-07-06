import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2, Search, Trash2 } from 'lucide-react'
import { cancelBooking, lookupBooking } from '@/lib/api'
import { useEmbed } from '@/lib/embed'
import { formatKoreanDate, formatTimeRange } from '@/lib/format'
import type { Booking } from '@/lib/types'

function countFilledFields(bookingId: string, visitorName: string, email: string): number {
  let count = 0
  if (bookingId.trim()) count++
  if (visitorName.trim()) count++
  if (email.trim()) count++
  return count
}

export function MyBookingPage() {
  const embed = useEmbed()
  const [params] = useSearchParams()
  const [bookingId, setBookingId] = useState(() => params.get('id')?.toUpperCase() ?? '')
  const [visitorName, setVisitorName] = useState('')
  const [email, setEmail] = useState('')
  const [booking, setBooking] = useState<Booking | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (countFilledFields(bookingId, visitorName, email) < 2) {
      setError('예약 번호, 예약자 이름, 이메일 중 2가지 이상 입력해 주세요')
      return
    }

    setLoading(true)
    setBooking(null)
    try {
      const result = await lookupBooking({
        bookingId: bookingId.trim() || undefined,
        visitorName: visitorName.trim() || undefined,
        email: email.trim() || undefined,
      })
      setBooking(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '조회 실패')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!booking) return
    if (!confirm('예약을 취소할까요?')) return
    setCancelling(true)
    setError('')
    try {
      const result = await cancelBooking(booking.id, booking.cancelToken)
      setBooking(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '취소 실패')
    } finally {
      setCancelling(false)
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
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white"
        >
          {loading ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
          조회하기
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

      {booking && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              예약 번호 {booking.id}
            </span>
            <StatusBadge status={booking.status} />
          </div>
          <p className="text-lg font-bold text-slate-900">{booking.roomName}</p>
          <p className="mt-1 text-sm text-slate-600">
            {formatKoreanDate(booking.startAt)} · {formatTimeRange(booking.startAt, booking.endAt)}
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
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelling}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 py-3 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              {cancelling ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
              예약 취소
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: Booking['status'] }) {
  const label = status === 'confirmed' ? '확정' : '취소됨'
  const cls =
    status === 'confirmed'
      ? 'bg-green-100 text-green-700'
      : 'bg-slate-100 text-slate-500'
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{label}</span>
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-800">{value}</dd>
    </div>
  )
}

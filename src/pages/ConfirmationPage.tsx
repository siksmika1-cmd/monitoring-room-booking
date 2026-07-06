import { CheckCircle2, Copy } from 'lucide-react'
import { useState } from 'react'
import { AppLink, useEmbed } from '@/lib/embed'
import { formatKoreanDate, formatTimeRange } from '@/lib/format'
import type { Booking } from '@/lib/types'

interface ConfirmationPageProps {
  booking: Booking
  onReset: () => void
}

export function ConfirmationPage({ booking, onReset }: ConfirmationPageProps) {
  const embed = useEmbed()
  const [copied, setCopied] = useState(false)

  const copyId = async () => {
    await navigator.clipboard.writeText(booking.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`app-container text-center ${embed ? 'px-2 py-4' : 'py-6'}`}>
      <CheckCircle2 className="mx-auto text-green-500" size={48} />
      <h1 className="mt-4 text-2xl font-bold text-slate-900">예약이 완료되었습니다</h1>
      <p className="mt-2 text-sm text-slate-500">
        Notion·Google 캘린더에 자동 반영됩니다.
      </p>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-left">
        <p className="text-sm text-slate-500">예약 번호</p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="text-2xl font-bold tracking-widest text-slate-900">{booking.id}</p>
          <button
            type="button"
            onClick={copyId}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
          >
            <Copy size={14} />
            {copied ? '복사됨' : '복사'}
          </button>
        </div>

        <dl className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">룸</dt>
            <dd className="font-semibold">{booking.roomName}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">일시</dt>
            <dd className="font-semibold">
              {formatKoreanDate(booking.startAt)} {formatTimeRange(booking.startAt, booking.endAt)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">방문자</dt>
            <dd className="font-semibold">{booking.visitorName}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Protocol No.</dt>
            <dd className="font-semibold">{booking.protocolNo}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">IRB No.</dt>
            <dd className="font-semibold">{booking.irbNo}</dd>
          </div>
        </dl>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        예약 확인·취소 시 예약 번호와 이메일이 필요합니다. 번호를 꼭 저장해 주세요.
      </p>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <AppLink
          to={`/my?id=${encodeURIComponent(booking.id)}`}
          className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
        >
          내 예약 확인
        </AppLink>
        <button
          type="button"
          onClick={onReset}
          className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700"
        >
          새 예약하기
        </button>
      </div>
    </div>
  )
}

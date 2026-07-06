import { HeaderBrand } from '@/components/HeaderBrand'
import { AppLink } from '@/lib/embed'

export function StandaloneHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-[390px] items-center gap-3 px-3 py-2">
        <HeaderBrand />
        <AppLink to="/my" className="text-xs text-slate-600 hover:text-slate-900">
          내 예약
        </AppLink>
        <AppLink to="/admin" className="ml-auto shrink-0 text-xs text-slate-400 hover:text-slate-600">
          관리
        </AppLink>
      </div>
    </header>
  )
}

export function EmbedHeader() {
  return (
    <header className="border-b border-slate-100 bg-white/80 px-3 py-2 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <HeaderBrand compact />
        <AppLink
          to="/my"
          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
        >
          내 예약
        </AppLink>
      </div>
    </header>
  )
}

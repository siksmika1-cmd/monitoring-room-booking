import { APP_TITLE } from '@/lib/constants'
import { BookingHomeLink } from '@/lib/bookingNav'
import { KumcEmblem } from '@/components/KumcEmblem'

export function HeaderBrand({ compact = false }: { compact?: boolean }) {
  return (
    <BookingHomeLink
      to="/"
      className={`flex min-w-0 items-center gap-2 ${compact ? '' : 'max-w-[55%]'}`}
    >
      <KumcEmblem
        className={`shrink-0 ${compact ? 'h-8 w-auto' : 'h-9 w-auto'}`}
      />
      <span
        className={`truncate font-bold leading-tight text-ku-crimson ${compact ? 'text-[10px]' : 'text-xs'}`}
      >
        {APP_TITLE}
      </span>
    </BookingHomeLink>
  )
}

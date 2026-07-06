import { createContext, useCallback, useContext } from 'react'
import { Link, useNavigate, type LinkProps } from 'react-router-dom'
import { embedPath, useEmbed } from './embed'

type BookingNavContextValue = {
  resetBookingFlow: () => void
}

const BookingNavContext = createContext<BookingNavContextValue | null>(null)

export function BookingNavProvider({
  resetBookingFlow,
  children,
}: {
  resetBookingFlow: () => void
  children: React.ReactNode
}) {
  return (
    <BookingNavContext.Provider value={{ resetBookingFlow }}>
      {children}
    </BookingNavContext.Provider>
  )
}

function useBookingNav() {
  const ctx = useContext(BookingNavContext)
  return ctx
}

/** 예약 홈(/)으로 이동 — 확인 화면 등에서도 예약 폼으로 돌아감 */
export function BookingHomeLink({ to: _to, onClick, ...props }: LinkProps) {
  const embed = useEmbed()
  const navigate = useNavigate()
  const nav = useBookingNav()

  const goHome = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      onClick?.(e)
      if (e.defaultPrevented) return
      e.preventDefault()
      nav?.resetBookingFlow()
      navigate(embedPath('/', embed))
    },
    [embed, navigate, nav, onClick],
  )

  return <Link to={embedPath('/', embed)} onClick={goHome} {...props} />
}

import { useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import { EmbedHeader, StandaloneHeader } from '@/components/AppShell'
import { AdminPage } from '@/pages/AdminPage'
import { BookingPage } from '@/pages/BookingPage'
import { ConfirmationPage } from '@/pages/ConfirmationPage'
import { MyBookingPage } from '@/pages/MyBookingPage'
import { useEmbed } from '@/lib/embed'
import { BookingNavProvider } from '@/lib/bookingNav'
import type { Booking } from '@/lib/types'

export default function App() {
  const embed = useEmbed()
  const [booking, setBooking] = useState<Booking | null>(null)

  return (
    <BookingNavProvider resetBookingFlow={() => setBooking(null)}>
      <div className={embed ? 'embed-root' : 'min-h-dvh'}>
      {embed ? <EmbedHeader /> : <StandaloneHeader />}
      <Routes>
        <Route
          path="/"
          element={
            booking ? (
              <ConfirmationPage booking={booking} onReset={() => setBooking(null)} />
            ) : (
              <BookingPage onBooked={setBooking} />
            )
          }
        />
        <Route path="/my" element={<MyBookingPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
      </div>
    </BookingNavProvider>
  )
}

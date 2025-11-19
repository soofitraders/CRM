'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import BookingForm from '@/components/bookings/BookingForm'
import SectionCard from '@/components/ui/SectionCard'
import { CreateBookingInput } from '@/lib/validation/booking'

export default function NewBookingPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (data: CreateBookingInput) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        router.push('/bookings')
        router.refresh()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to create booking')
      }
    } catch (error) {
      console.error('Error creating booking:', error)
      alert('Failed to create booking')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-headingText">New Booking</h1>
        <p className="text-bodyText mt-2">Create a new rental booking</p>
      </div>

      <SectionCard title="Booking Details">
        <BookingForm onSubmit={handleSubmit} isLoading={isLoading} />
      </SectionCard>
    </div>
  )
}


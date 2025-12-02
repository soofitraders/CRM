import { Suspense } from 'react'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { redirect } from 'next/navigation'
import SectionCard from '@/components/ui/SectionCard'
import Table, { TableRow, TableCell } from '@/components/ui/Table'
import StatusChip from '@/components/ui/StatusChip'
import { Plus, Search, Filter } from 'lucide-react'
import Link from 'next/link'
import BookingsList from '@/components/bookings/BookingsList'

export default async function BookingsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-headingText">Bookings</h1>
          <p className="text-bodyText mt-2">Manage all rental bookings</p>
        </div>
        <Link
          href="/bookings/new"
          className="px-4 py-2 bg-sidebarActiveBg text-white rounded-lg font-medium hover:bg-sidebarActiveBg/90 transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          New Booking
        </Link>
      </div>

      {/* Bookings List */}
      <Suspense fallback={<div className="text-bodyText">Loading...</div>}>
        <BookingsList />
      </Suspense>
    </div>
  )
}


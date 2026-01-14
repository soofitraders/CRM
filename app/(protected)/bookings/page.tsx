import { Suspense } from 'react'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { redirect } from 'next/navigation'
import SectionCard from '@/components/ui/SectionCard'
import PageHeader from '@/components/ui/PageHeader'
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
    <div className="space-y-4 sm:space-y-6 min-w-0">
      {/* Page Header */}
      <PageHeader
        title="Bookings"
        subtitle="Manage all rental bookings"
        actions={
          <Link
            href="/bookings/new"
            className="w-full sm:w-auto px-4 py-2 bg-sidebarActiveBg text-white rounded-lg font-medium hover:bg-sidebarActiveBg/90 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm sm:text-base">New Booking</span>
          </Link>
        }
      />

      {/* Bookings List */}
      <Suspense fallback={<div className="text-bodyText">Loading...</div>}>
        <BookingsList />
      </Suspense>
    </div>
  )
}


import { Suspense } from 'react'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { redirect } from 'next/navigation'
import SectionCard from '@/components/ui/SectionCard'
import PageHeader from '@/components/ui/PageHeader'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import UnitsList from '@/components/units/UnitsList'

export default async function UnitsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      {/* Page Header */}
      <PageHeader
        title="Units (Fleet)"
        subtitle="Manage your vehicle fleet"
        actions={
          <Link
            href="/units/new"
            className="w-full sm:w-auto px-4 py-2 bg-sidebarActiveBg text-white rounded-lg font-medium hover:bg-sidebarActiveBg/90 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm sm:text-base">New Vehicle</span>
          </Link>
        }
      />

      {/* Units List */}
      <Suspense fallback={<div className="text-bodyText">Loading...</div>}>
        <UnitsList />
      </Suspense>
    </div>
  )
}


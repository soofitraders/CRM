import { Suspense } from 'react'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import ClientsList from '@/components/customers/ClientsList'

export default async function ClientsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-headingText">Clients</h1>
          <p className="text-bodyText mt-2">Manage customer profiles</p>
        </div>
        <Link
          href="/clients/new"
          className="px-4 py-2 bg-sidebarActiveBg text-white rounded-lg font-medium hover:bg-sidebarActiveBg/90 transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          New Client
        </Link>
      </div>

      {/* Clients List */}
      <Suspense fallback={<div className="text-bodyText">Loading...</div>}>
        <ClientsList />
      </Suspense>
    </div>
  )
}


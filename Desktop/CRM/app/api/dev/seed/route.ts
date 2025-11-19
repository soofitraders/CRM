import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { getCurrentUser, hasRole } from '@/lib/auth'
import { seedDemoData } from '@/scripts/seedDemoData'

// POST - Seed demo data (dev only, SUPER_ADMIN only)
export async function POST(request: NextRequest) {
  try {
    // Check if in production
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'This endpoint is not available in production' },
        { status: 403 }
      )
    }

    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions - Only SUPER_ADMIN can seed data
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!hasRole(user, ['SUPER_ADMIN'])) {
      return NextResponse.json(
        { error: 'Forbidden. Only SUPER_ADMIN can seed demo data' },
        { status: 403 }
      )
    }

    // Run seed function
    // Note: This will run synchronously and may take some time
    // In a real scenario, you might want to queue this as a background job
    const result = await seedDemoData()

    return NextResponse.json({
      message: 'Demo data seeded successfully',
      summary: result.summary,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Error seeding demo data:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to seed demo data' },
      { status: 500 }
    )
  }
}


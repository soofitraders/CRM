import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { getCurrentUser, hasRole } from '@/lib/auth'
import ReportPreset from '@/lib/models/ReportPreset'
import { logger } from '@/lib/utils/performance'

// DELETE - Delete a report preset
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'FINANCE'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const preset = await ReportPreset.findOneAndDelete({
      _id: params.id,
      user: user._id,
    })

    if (!preset) {
      return NextResponse.json({ error: 'Preset not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Preset deleted successfully' })
  } catch (error: any) {
    logger.error('Error deleting report preset:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete preset' },
      { status: 500 }
    )
  }
}


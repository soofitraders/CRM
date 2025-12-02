import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import SupportTicket from '@/lib/models/SupportTicket'
import { createSupportTicketSchema } from '@/lib/validation/supportTicket'
import { getCurrentUser } from '@/lib/auth'
import { logger } from '@/lib/utils/performance'

// GET - List support tickets for current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || undefined

    const filter: any = { user: user._id }
    if (status) {
      filter.status = status
    }

    const tickets = await SupportTicket.find(filter)
      .sort({ createdAt: -1 })
      .lean()

    return NextResponse.json({ tickets })
  } catch (error: any) {
    logger.error('Error fetching support tickets:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch support tickets' },
      { status: 500 }
    )
  }
}

// POST - Create a new support ticket
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const data = createSupportTicketSchema.parse(body)

    // Create support ticket
    const ticket = new SupportTicket({
      user: user._id,
      subject: data.subject,
      description: data.description,
      priority: data.priority,
      status: 'OPEN',
    })

    await ticket.save()

    const populatedTicket = await SupportTicket.findById(ticket._id)
      .populate('user', 'name email')
      .lean()

    return NextResponse.json({ ticket: populatedTicket }, { status: 201 })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    logger.error('Error creating support ticket:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create support ticket' },
      { status: 500 }
    )
  }
}


import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import Invoice from '@/lib/models/Invoice'
import { updateInvoiceStatusSchema } from '@/lib/validation/invoice'
import { getCurrentUser, hasRole } from '@/lib/auth'

// GET - Get single invoice
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('[API] Invoice GET request for ID:', params.id)
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      console.log('[API] Invoice: Unauthorized - no session')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[API] Invoice: Connecting to database...')
    await connectDB()
    console.log('[API] Invoice: Database connected')

    let invoice
    try {
      console.log('[API] Invoice: Querying database...')
      invoice = await Invoice.findById(params.id)
        .populate({
          path: 'booking',
          populate: [
            {
              path: 'vehicle',
              select: 'plateNumber brand model year',
            },
            {
              path: 'customer',
              select: 'user',
              populate: {
                path: 'user',
                select: 'name email phone',
              },
            },
          ],
        })
        .lean()
        .exec()
      
      console.log('[API] Invoice: Query completed, invoice found:', !!invoice)
    } catch (queryError: any) {
      console.error('[API] Invoice: Database query error:', queryError)
      console.error('[API] Invoice: Error name:', queryError.name)
      console.error('[API] Invoice: Error message:', queryError.message)
      console.error('[API] Invoice: Error stack:', queryError.stack)
      
      // Try to get invoice without populate as fallback
      try {
        console.log('[API] Invoice: Attempting fallback query without populate')
        invoice = await Invoice.findById(params.id).lean().exec()
        console.log('[API] Invoice: Fallback query successful')
      } catch (fallbackError: any) {
        console.error('[API] Invoice: Fallback query also failed:', fallbackError)
        return NextResponse.json(
          { 
            error: 'Failed to fetch invoice', 
            details: process.env.NODE_ENV === 'development' ? queryError.message : undefined 
          },
          { status: 500 }
        )
      }
    }

    if (!invoice) {
      console.log('[API] Invoice: Invoice not found for ID:', params.id)
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    console.log('[API] Invoice: Successfully fetched invoice:', invoice._id)
    return NextResponse.json({ invoice })
  } catch (error: any) {
    console.error('[API] Invoice: Top-level error:', error)
    console.error('[API] Invoice: Error name:', error.name)
    console.error('[API] Invoice: Error message:', error.message)
    console.error('[API] Invoice: Error stack:', error.stack)
    return NextResponse.json(
      { 
        error: error.message || 'Failed to fetch invoice',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

// PATCH - Update invoice status (FINANCE or SUPER_ADMIN only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Check permissions - FINANCE, ADMIN, and SUPER_ADMIN can update invoices
    if (!hasRole(user, ['FINANCE', 'ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const invoice = await Invoice.findById(params.id)
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const body = await request.json()
    const data = updateInvoiceStatusSchema.parse(body)

    // Prevent updating if already PAID or VOID
    if (invoice.status === 'PAID' || invoice.status === 'VOID') {
      return NextResponse.json(
        { error: `Invoice is already ${invoice.status} and cannot be updated` },
        { status: 400 }
      )
    }

    // Update status if provided
    if (data.status !== undefined) {
      // Only allow updating to PAID or VOID
      if (data.status !== 'PAID' && data.status !== 'VOID') {
        return NextResponse.json(
          { error: 'Invalid status. Only PAID or VOID are allowed' },
          { status: 400 }
        )
      }
      invoice.status = data.status
    }

    // Update items if provided
    if (data.items !== undefined) {
      // Recalculate totals
      const subtotal = data.items.reduce((sum, item) => sum + item.amount, 0)
      const taxAmount = invoice.taxAmount // Keep existing tax amount
      const total = subtotal + taxAmount
      
      // Update invoice using direct MongoDB update to bypass Mongoose validation
      // that might block negative amounts for fines/discounts
      await Invoice.collection.updateOne(
        { _id: invoice._id },
        {
          $set: {
            items: data.items,
            subtotal,
            total,
            updatedAt: new Date(),
          },
        }
      )
    } else {
      await invoice.save()
    }

    // Fetch the updated invoice with populated relations
    const updatedInvoice = await Invoice.findById(invoice._id)
      .populate({
        path: 'booking',
        populate: [
          {
            path: 'vehicle',
            select: 'plateNumber brand model year',
          },
          {
            path: 'customer',
            select: 'user',
            populate: {
              path: 'user',
              select: 'name email phone',
            },
          },
        ],
      })
      .lean()

    return NextResponse.json({ invoice: updatedInvoice })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error updating invoice:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update invoice' },
      { status: 500 }
    )
  }
}


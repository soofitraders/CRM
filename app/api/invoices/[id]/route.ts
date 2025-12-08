import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import Invoice from '@/lib/models/Invoice'
import { updateInvoiceStatusSchema } from '@/lib/validation/invoice'
import { getCurrentUser, hasRole } from '@/lib/auth'
import { logger } from '@/lib/utils/performance'

// GET - Get single invoice
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    logger.log('[API] Invoice GET request for ID:', params.id)
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      logger.log('[API] Invoice: Unauthorized - no session')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.log('[API] Invoice: Connecting to database...')
    await connectDB()
    logger.log('[API] Invoice: Database connected')

    let invoice
    try {
      logger.log('[API] Invoice: Querying database...')
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
      
      logger.log('[API] Invoice: Query completed, invoice found:', !!invoice)
    } catch (queryError: any) {
      logger.error('[API] Invoice: Database query error:', queryError)
      logger.error('[API] Invoice: Error name:', queryError.name)
      logger.error('[API] Invoice: Error message:', queryError.message)
      logger.error('[API] Invoice: Error stack:', queryError.stack)
      
      // Try to get invoice without populate as fallback
      try {
        logger.log('[API] Invoice: Attempting fallback query without populate')
        invoice = await Invoice.findById(params.id).lean().exec()
        logger.log('[API] Invoice: Fallback query successful')
      } catch (fallbackError: any) {
        logger.error('[API] Invoice: Fallback query also failed:', fallbackError)
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
      logger.log('[API] Invoice: Invoice not found for ID:', params.id)
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    logger.log('[API] Invoice: Successfully fetched invoice:', invoice._id)
    return NextResponse.json({ invoice })
  } catch (error: any) {
    logger.error('[API] Invoice: Top-level error:', error)
    logger.error('[API] Invoice: Error name:', error.name)
    logger.error('[API] Invoice: Error message:', error.message)
    logger.error('[API] Invoice: Error stack:', error.stack)
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
    const oldStatus = invoice.status
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
      // Calculate subtotal from all items (including deposits as negative amounts)
      const subtotal = data.items.reduce((sum, item) => sum + item.amount, 0)
      
      // Calculate taxable amount for VAT
      // VAT applies to: rental + fines + other charges - discounts
      // VAT does NOT apply to: deposits (which are payments/credits)
      // Separate items into taxable (positive or discount) and non-taxable (deposits)
      const taxableItems = data.items.filter(item => {
        const label = item.label.toLowerCase()
        // Deposits are non-taxable (they're payments, not charges)
        return !label.includes('deposit')
      })
      const taxableSubtotal = taxableItems.reduce((sum, item) => sum + item.amount, 0)
      
      // Get VAT rate from settings
      const Settings = (await import('@/lib/models/Settings')).default
      const settings = await Settings.findOne().lean()
      const vatRate = settings?.defaultTaxPercent || 5
      
      // Calculate VAT on taxable amount (ensure non-negative)
      const taxAmount = Math.max(0, (taxableSubtotal * vatRate) / 100)
      
      // Total = subtotal (all items including deposits) + VAT
      const total = subtotal + taxAmount
      
      // Identify fines in the new items (items with positive amounts that are fines)
      const fineItems = data.items.filter(item => {
        const label = item.label.toLowerCase()
        return item.amount > 0 && (
          label.includes('fine') || 
          label.includes('penalty') || 
          label.includes('government') ||
          label.includes('traffic')
        )
      })
      
      // Get existing invoice items to compare
      const existingItems = invoice.items || []
      const existingFineLabels = new Set(
        existingItems
          .filter((item: any) => {
            const label = item.label.toLowerCase()
            return item.amount > 0 && (
              label.includes('fine') || 
              label.includes('penalty') || 
              label.includes('government') ||
              label.includes('traffic')
            )
          })
          .map((item: any) => item.label)
      )
      
      // Create expense records for new fines
      if (fineItems.length > 0) {
        try {
          const Expense = (await import('@/lib/models/Expense')).default
          const ExpenseCategory = (await import('@/lib/models/ExpenseCategory')).default
          
          // Ensure default categories exist
          await ExpenseCategory.ensureDefaultCategories()
          
          // Find or create FINES category
          let finesCategory = await ExpenseCategory.findOne({ code: 'FINES' }).lean()
          if (!finesCategory) {
            finesCategory = await ExpenseCategory.create({
              code: 'FINES',
              name: 'Fines & Government Fees',
              type: 'COGS',
              isActive: true,
            })
          }
          
          // Get booking details for branch
          const booking = await (await import('@/lib/models/Booking')).default
            .findById(invoice.booking)
            .select('pickupBranch')
            .lean()
          
          // Create expense for each new fine
          for (const fineItem of fineItems) {
            // Only create expense if this fine wasn't in the existing items
            if (!existingFineLabels.has(fineItem.label)) {
              await Expense.create({
                category: finesCategory._id,
                description: `Fine - ${fineItem.label} - Invoice ${invoice.invoiceNumber}`,
                amount: fineItem.amount,
                currency: 'AED',
                dateIncurred: invoice.issueDate || new Date(),
                branchId: booking?.pickupBranch,
                createdBy: user._id,
              })
            }
          }
        } catch (expenseError: any) {
          // Log error but don't fail invoice update
          logger.error('Error creating expense for fines:', expenseError)
        }
      }
      
      // Update invoice using direct MongoDB update to bypass Mongoose validation
      // that might block negative amounts for fines/discounts
      await Invoice.collection.updateOne(
        { _id: invoice._id as any },
        {
          $set: {
            items: data.items,
            subtotal: Math.max(0, subtotal), // Ensure non-negative
            taxAmount,
            total: Math.max(0, total), // Ensure non-negative
            updatedAt: new Date(),
          },
        }
      )
    } else {
      await invoice.save()
    }

    // Fetch the updated invoice with populated relations
    const updatedInvoice = await Invoice.findById(invoice._id as any)
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

    // Log activity and audit for status changes
    try {
      const { logActivity } = await import('@/lib/services/activityLogService')
      const { logAudit } = await import('@/lib/services/auditLogService')

      if (oldStatus !== invoice.status) {
        await logActivity({
          activityType: invoice.status === 'PAID' ? 'INVOICE_PAID' : 'INVOICE_UPDATED',
          module: 'INVOICES',
          action: 'UPDATE',
          description: `Invoice ${invoice.invoiceNumber} status changed from ${oldStatus} to ${invoice.status}`,
          entityType: 'Invoice',
          entityId: (invoice._id as any)?.toString(),
          changes: [
            { field: 'status', oldValue: oldStatus, newValue: invoice.status },
          ],
          userId: user._id.toString(),
        })

        // Log audit for financial transactions
        if (invoice.status === 'PAID') {
          await logAudit({
            auditType: 'INVOICE_PAID',
            severity: 'HIGH',
            title: 'Invoice Paid',
            description: `Invoice ${invoice.invoiceNumber} was marked as paid`,
            entityType: 'Invoice',
            entityId: (invoice._id as any)?.toString(),
            financialAmount: invoice.total,
            currency: 'AED',
            beforeState: { status: oldStatus },
            afterState: { status: invoice.status },
            metadata: {
              invoiceNumber: invoice.invoiceNumber,
            },
            userId: user._id.toString(),
          })
        }
      }
    } catch (logError) {
      logger.error('Error logging invoice activity:', logError)
      // Don't fail invoice update if logging fails
    }

    return NextResponse.json({ invoice: updatedInvoice })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    logger.error('Error updating invoice:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update invoice' },
      { status: 500 }
    )
  }
}


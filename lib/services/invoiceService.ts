import connectDB from '@/lib/db'
import Invoice from '@/lib/models/Invoice'
import Booking from '@/lib/models/Booking'
import Settings from '@/lib/models/Settings'
import { logger } from '@/lib/utils/performance'

/**
 * Generate a unique invoice number
 * Format: INV-YYYYMMDD-XXXX (e.g., INV-20240115-0001)
 */
async function generateInvoiceNumber(): Promise<string> {
  await connectDB()

  const today = new Date()
  const datePrefix = `INV-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`

  // Find the last invoice with this prefix
  const lastInvoice = await Invoice.findOne({
    invoiceNumber: { $regex: `^${datePrefix}` },
  })
    .sort({ invoiceNumber: -1 })
    .lean()

  let sequence = 1
  if (lastInvoice) {
    const lastSequence = parseInt(lastInvoice.invoiceNumber.split('-')[2] || '0', 10)
    sequence = lastSequence + 1
  }

  return `${datePrefix}-${String(sequence).padStart(4, '0')}`
}

/**
 * Create an invoice from a booking
 */
export async function createInvoiceFromBooking(bookingId: string): Promise<any> {
  try {
    await connectDB()

    // Check if invoice already exists for this booking
    const existingInvoice = await Invoice.findOne({ booking: bookingId })
    if (existingInvoice) {
      return existingInvoice
    }

    // Get booking details with vehicle rates
    const booking = await Booking.findById(bookingId)
      .populate('vehicle', 'plateNumber brand model dailyRate weeklyRate monthlyRate')
      .populate('customer')
      .lean()

    if (!booking) {
      throw new Error('Booking not found')
    }

    const vehicle = (booking as any).vehicle
    if (!vehicle) {
      throw new Error('Vehicle not found')
    }

    // Calculate number of days
    let numberOfDays = 1 // Default to 1 day if no end date
    if (booking.endDateTime) {
      const startDate = new Date(booking.startDateTime)
      const endDate = new Date(booking.endDateTime)
      const diffTime = endDate.getTime() - startDate.getTime()
      numberOfDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
    }

    // Get daily rate based on rental type
    let dailyRate = vehicle.dailyRate || 0
    if (booking.rentalType === 'WEEKLY' && vehicle.weeklyRate) {
      dailyRate = vehicle.weeklyRate / 7
    } else if (booking.rentalType === 'MONTHLY' && vehicle.monthlyRate) {
      dailyRate = vehicle.monthlyRate / 30
    }

    // Calculate line total: Daily Rate × Number of Days
    const lineTotal = dailyRate * numberOfDays

    // Calculate invoice items
    // Note: We use positive amounts and calculate subtotal separately to avoid validation issues
    const items = [
      {
        label: `Rental - ${vehicle.brand || ''} ${vehicle.model || ''} (${booking.rentalType}) - ${numberOfDays} day${numberOfDays !== 1 ? 's' : ''} @ ${dailyRate.toFixed(2)} AED/day`,
        amount: lineTotal,
      },
    ]

    // Add discount as a separate line item with negative amount
    // This is allowed in the schema but may need explicit handling
    if (booking.discounts > 0) {
      items.push({
        label: 'Discount',
        amount: -Math.abs(booking.discounts), // Ensure negative
      })
    }

    // Add deposit as a payment/credit line item (negative amount)
    // This shows the deposit was paid and reduces the amount due
    if (booking.depositAmount > 0) {
      items.push({
        label: 'Deposit Paid',
        amount: -Math.abs(booking.depositAmount), // Negative to show it reduces the total
      })
    }

    // Calculate taxable amount for VAT
    // VAT applies to: rental + fines + other charges - discounts
    // VAT does NOT apply to: deposits (which are payments/credits)
    // Separate items into taxable (rental, discounts) and non-taxable (deposits)
    const taxableItems = items.filter(item => {
      const label = item.label.toLowerCase()
      // Deposits are non-taxable (they're payments, not charges)
      return !label.includes('deposit')
    })
    const taxableSubtotal = taxableItems.reduce((sum, item) => sum + item.amount, 0)
    
    // VAT is calculated on the taxable subtotal (rental - discounts, excluding deposits)
    // Get VAT rate from settings (defaultTaxPercent) or use default 5%
    const settings = await Settings.findOne().lean()
    const vatRate = settings?.defaultTaxPercent || 5
    const taxAmount = Math.max(0, (taxableSubtotal * vatRate) / 100)
    
    // Calculate final subtotal including all items (rental - discount - deposit)
    const finalSubtotal = items.reduce((sum, item) => sum + item.amount, 0)
    
    // Total amount due = final subtotal (rental - discount - deposit) + VAT
    // This represents the amount the customer still owes after deposit
    const total = finalSubtotal + taxAmount

    // Calculate dates
    const issueDate = new Date()
    const dueDate = new Date(issueDate)
    dueDate.setDate(dueDate.getDate() + 30) // 30 days payment terms

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber()

    // Create invoice document
    const invoiceData = {
      booking: bookingId,
      invoiceNumber,
      issueDate,
      dueDate,
      items,
      subtotal: Math.max(0, finalSubtotal), // Final subtotal after deposit deduction
      taxAmount,
      total: Math.max(0, total), // Amount due after deposit (ensures non-negative)
      status: 'ISSUED' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // Use insertOne to bypass Mongoose validation that might block negative amounts
    const result = await Invoice.collection.insertOne(invoiceData)
    const invoice = await Invoice.findById(result.insertedId)
    
    if (!invoice) {
      throw new Error('Failed to create invoice')
    }

    return invoice
  } catch (error: any) {
    logger.error('Error creating invoice from booking:', error)
    // Re-throw with more context if it's a validation error
    if (error.name === 'ValidationError') {
      const errorMessage = error.message || 'Invoice validation failed'
      throw new Error(errorMessage)
    }
    throw error
  }
}

/**
 * Create a custom invoice manually
 */
export async function createCustomInvoice(data: {
  bookingId: string
  items: Array<{ label: string; amount: number }>
  issueDate?: Date
  dueDate?: Date
  taxPercent?: number
  createdBy?: string
}): Promise<any> {
  try {
    await connectDB()

    // Check if invoice already exists for this booking
    const existingInvoice = await Invoice.findOne({ booking: data.bookingId })
    if (existingInvoice) {
      throw new Error('Invoice already exists for this booking')
    }

    // Calculate subtotal from all items
    const subtotal = data.items.reduce((sum, item) => sum + item.amount, 0)
    
    // Calculate taxable amount for VAT (excluding deposits)
    const taxableItems = data.items.filter(item => {
      const label = item.label.toLowerCase()
      return !label.includes('deposit')
    })
    const taxableSubtotal = taxableItems.reduce((sum, item) => sum + item.amount, 0)
    
    // Get VAT rate from settings or use provided taxPercent
    const settings = await Settings.findOne().lean()
    const vatRate = data.taxPercent !== undefined ? data.taxPercent : (settings?.defaultTaxPercent || 5)
    const taxAmount = Math.max(0, (taxableSubtotal * vatRate) / 100)
    
    const total = subtotal + taxAmount

    // Calculate dates
    const issueDate = data.issueDate || new Date()
    const dueDate = data.dueDate || (() => {
      const d = new Date(issueDate)
      d.setDate(d.getDate() + 30)
      return d
    })()

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber()

    // Create invoice
    const invoice = new Invoice({
      booking: data.bookingId,
      invoiceNumber,
      issueDate,
      dueDate,
      items: data.items,
      subtotal,
      taxAmount,
      total,
      status: 'ISSUED',
    })

    await invoice.save()

    // Create expense records for fines
    const fineItems = data.items.filter(item => {
      const label = (item.label || '').toLowerCase()
      return item.amount > 0 && (
        label.includes('fine') || 
        label.includes('penalty') || 
        label.includes('government') ||
        label.includes('traffic')
      )
    })

    if (fineItems.length > 0 && data.createdBy) {
      try {
        const Expense = (await import('@/lib/models/Expense')).default
        const ExpenseCategory = (await import('@/lib/models/ExpenseCategory')).default
        const Booking = (await import('@/lib/models/Booking')).default
        
        // Ensure default categories exist
        await ExpenseCategory.ensureDefaultCategories()
        
        // Find or create FINES category
        let finesCategory = await ExpenseCategory.findOne({ code: 'FINES' }).lean()
        if (!finesCategory) {
          await ExpenseCategory.create({
            code: 'FINES',
            name: 'Fines & Government Fees',
            type: 'COGS',
            isActive: true,
          })
          finesCategory = await ExpenseCategory.findOne({ code: 'FINES' }).lean()
        }
        
        // Get booking details for branch
        const booking = await Booking.findById(data.bookingId)
          .select('pickupBranch')
          .lean()
        
        // Create expense for each fine
        if (finesCategory) {
          for (const fineItem of fineItems) {
            await Expense.create({
              category: finesCategory._id,
              description: `Fine - ${fineItem.label} - Invoice ${invoiceNumber}`,
              amount: fineItem.amount,
              currency: 'AED',
              dateIncurred: issueDate,
              branchId: booking?.pickupBranch,
              createdBy: data.createdBy,
            })
          }
        }
      } catch (expenseError: any) {
        // Log error but don't fail invoice creation
        logger.error('Error creating expense for fines:', expenseError)
      }
    }

    return invoice
  } catch (error) {
    logger.error('Error creating custom invoice:', error)
    throw error
  }
}


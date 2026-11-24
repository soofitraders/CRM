import connectDB from '@/lib/db'
import Invoice from '@/lib/models/Invoice'
import Booking from '@/lib/models/Booking'
import Settings from '@/lib/models/Settings'
import { logger } from '@/lib/utils/performance'
import mongoose from 'mongoose'
import {
  calculateBookingAmounts,
  bookingTaxPercent,
  formatRentalUnits,
  rentalUnitName,
} from '@/lib/utils/bookingPricing'

/**
 * Find the existing invoice for a booking (if any).
 *
 * Older invoices were saved with the booking reference as TEXT instead of an
 * ObjectId (raw insertOne skips Mongoose casting), and Mongoose casts query
 * values to ObjectId, so `Invoice.findOne({ booking: id })` never matched them.
 * Query the raw collection for BOTH representations so duplicates can't slip in.
 */
async function findInvoiceForBooking(bookingId: string): Promise<any | null> {
  const raw = await Invoice.collection.findOne(
    { booking: { $in: [new mongoose.Types.ObjectId(bookingId), String(bookingId)] } as any },
    { sort: { _id: 1 } }
  )
  return raw ? Invoice.findById(raw._id) : null
}

/**
 * A cancelled booking must not keep an open invoice (it would still count as sales
 * and as money the customer owes).
 *
 *  - ISSUED / DRAFT invoices are set to VOID.
 *  - A PAID invoice cannot be voided (money was received); the caller must stop the
 *    cancellation and ask for a refund to be handled first.
 */
export async function getPaidInvoiceForBooking(bookingId: string): Promise<any | null> {
  await connectDB()
  return Invoice.collection.findOne({
    booking: { $in: [new mongoose.Types.ObjectId(bookingId), String(bookingId)] } as any,
    status: 'PAID',
  })
}

export async function voidOpenInvoicesForBooking(bookingId: string): Promise<string[]> {
  await connectDB()
  const filter: any = {
    booking: { $in: [new mongoose.Types.ObjectId(bookingId), String(bookingId)] },
    status: { $in: ['ISSUED', 'DRAFT'] },
  }
  const open = await Invoice.collection.find(filter).toArray()
  if (open.length > 0) {
    await Invoice.collection.updateMany(filter, { $set: { status: 'VOID', updatedAt: new Date() } })
  }
  return open.map((i: any) => String(i.invoiceNumber))
}

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
    const existingInvoice = await findInvoiceForBooking(bookingId)
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

    // The booking is the single source of truth for the price. The invoice is
    // built from the same calculation the booking uses: base rate is the price
    // per rental unit (day / week / month), units come from the rental type and
    // the start/end dates.
    const taxPercent = bookingTaxPercent(booking as any)
    const amounts = calculateBookingAmounts({
      rentalType: booking.rentalType as any,
      baseRate: booking.baseRate || 0,
      discounts: booking.discounts || 0,
      taxPercent,
      startDateTime: booking.startDateTime,
      endDateTime: booking.endDateTime,
    })
    const lineTotal = amounts.rentalAmount

    // Calculate invoice items
    // Note: We use positive amounts and calculate subtotal separately to avoid validation issues
    const items = [
      {
        label: `Rental - ${vehicle.brand || ''} ${vehicle.model || ''} (${booking.rentalType}) - ${formatRentalUnits(booking.rentalType as any, amounts.units)} @ ${(booking.baseRate || 0).toFixed(2)} AED/${rentalUnitName(booking.rentalType as any)}`,
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
    // using the SAME tax percent the booking was priced with (so totals match).
    const taxAmount = Math.max(0, Math.round(((taxableSubtotal * taxPercent) / 100) * 100) / 100)
    
    // Calculate final subtotal including all items (rental - discount - deposit)
    const finalSubtotal = items.reduce((sum, item) => sum + item.amount, 0)
    
    // Total amount due = final subtotal (rental - discount - deposit) + VAT
    // This represents the amount the customer still owes after deposit
    const total = finalSubtotal + taxAmount

    // Calculate dates
    const issueDate = new Date()
    const dueDate = new Date(issueDate)
    dueDate.setDate(dueDate.getDate() + 30) // 30 days payment terms

    // Create invoice document
    // NOTE: booking MUST be an ObjectId (raw insertOne does not cast it).
    const invoiceData: any = {
      booking: new mongoose.Types.ObjectId(bookingId),
      invoiceNumber: '',
      issueDate,
      dueDate,
      transactionMethod: 'CASH' as const,
      items,
      subtotal: Math.max(0, finalSubtotal), // Final subtotal after deposit deduction
      taxAmount,
      total: Math.max(0, total), // Amount due after deposit (ensures non-negative)
      status: 'ISSUED' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // Use insertOne to bypass Mongoose validation that might block negative amounts.
    // Invoice numbers are "last + 1", so two simultaneous requests can pick the
    // same number: retry with a fresh number if the unique index rejects it.
    let insertedId: any = null
    for (let attempt = 0; attempt < 5; attempt++) {
      invoiceData.invoiceNumber = await generateInvoiceNumber()
      try {
        const result = await Invoice.collection.insertOne({ ...invoiceData })
        insertedId = result.insertedId
        break
      } catch (insertError: any) {
        const dupNumber = insertError?.code === 11000 && insertError?.keyPattern?.invoiceNumber
        if (!dupNumber || attempt === 4) throw insertError
      }
    }

    // Two simultaneous confirms can both pass the "already exists" check above.
    // The invoice with the lowest _id wins; any later one is removed again.
    const allForBooking = await Invoice.collection
      .find({ booking: { $in: [invoiceData.booking, String(bookingId)] } as any })
      .sort({ _id: 1 })
      .toArray()
    if (allForBooking.length > 1 && String(allForBooking[0]._id) !== String(insertedId)) {
      await Invoice.collection.deleteOne({ _id: insertedId })
      const winner = await Invoice.findById(allForBooking[0]._id)
      if (winner) return winner
    }

    const invoice = await Invoice.findById(insertedId)

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
  transactionMethod?: 'CASH' | 'BANK_TRANSFER'
  createdBy?: string
}): Promise<any> {
  try {
    await connectDB()

    // Check if invoice already exists for this booking
    const existingInvoice = await findInvoiceForBooking(data.bookingId)
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
      transactionMethod: data.transactionMethod || 'CASH',
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
        label.includes('traffic') ||
        label.includes('salik') ||
        label.includes('toll')
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
          .select('pickupBranch vehicle')
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
              vehicle: (booking as any)?.vehicle,
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


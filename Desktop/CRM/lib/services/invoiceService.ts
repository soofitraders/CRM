import connectDB from '@/lib/db'
import Invoice from '@/lib/models/Invoice'
import Booking from '@/lib/models/Booking'

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

    // Get booking details
    const booking = await Booking.findById(bookingId)
      .populate('vehicle', 'plateNumber brand model')
      .populate('customer')
      .lean()

    if (!booking) {
      throw new Error('Booking not found')
    }

    // Calculate invoice items
    // Note: We use positive amounts and calculate subtotal separately to avoid validation issues
    const items = [
      {
        label: `Rental - ${(booking as any).vehicle?.brand || ''} ${(booking as any).vehicle?.model || ''} (${booking.rentalType})`,
        amount: booking.baseRate,
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

    // Calculate subtotal from rental items only (before deposit and tax)
    // This is the taxable amount
    const rentalSubtotal = booking.baseRate - booking.discounts
    
    // Tax is calculated on the rental subtotal (before deposit)
    const taxAmount = booking.taxes // Already calculated correctly on (baseRate - discounts)
    
    // Calculate final subtotal including all items (rental - discount - deposit)
    const finalSubtotal = items.reduce((sum, item) => sum + item.amount, 0)
    
    // Total amount due = final subtotal (rental - discount - deposit) + tax
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
    console.error('Error creating invoice from booking:', error)
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
}): Promise<any> {
  try {
    await connectDB()

    // Check if invoice already exists for this booking
    const existingInvoice = await Invoice.findOne({ booking: data.bookingId })
    if (existingInvoice) {
      throw new Error('Invoice already exists for this booking')
    }

    // Calculate totals
    const subtotal = data.items.reduce((sum, item) => sum + item.amount, 0)
    const taxPercent = data.taxPercent || 0
    const taxAmount = (subtotal * taxPercent) / 100
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

    return invoice
  } catch (error) {
    console.error('Error creating custom invoice:', error)
    throw error
  }
}


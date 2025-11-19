import mongoose, { Schema, Document, Model } from 'mongoose'

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'VOID'

export interface InvoiceItem {
  label: string
  amount: number
}

export interface IInvoice extends Document {
  booking: mongoose.Types.ObjectId
  invoiceNumber: string
  issueDate: Date
  dueDate: Date
  items: InvoiceItem[]
  subtotal: number
  taxAmount: number
  total: number
  status: InvoiceStatus
  createdAt: Date
  updatedAt: Date
}

const InvoiceItemSchema = new Schema<InvoiceItem>(
  {
    label: {
      type: String,
      required: [true, 'Item label is required'],
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, 'Item amount is required'],
      // Allow negative amounts for discounts/adjustments - no min validation
      // Note: Negative values are allowed for discount items
    },
  },
  { _id: false }
)

const InvoiceSchema = new Schema<IInvoice>(
  {
    booking: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Booking is required'],
    },
    invoiceNumber: {
      type: String,
      required: [true, 'Invoice number is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    issueDate: {
      type: Date,
      required: [true, 'Issue date is required'],
      default: Date.now,
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
    },
    items: {
      type: [InvoiceItemSchema],
      required: [true, 'Invoice items are required'],
      validate: {
        validator: function(items: InvoiceItem[]) {
          return items.length > 0
        },
        message: 'Invoice must have at least one item',
      },
    },
    subtotal: {
      type: Number,
      required: [true, 'Subtotal is required'],
      min: [0, 'Subtotal cannot be negative'],
    },
    taxAmount: {
      type: Number,
      required: [true, 'Tax amount is required'],
      min: [0, 'Tax amount cannot be negative'],
    },
    total: {
      type: Number,
      required: [true, 'Total is required'],
      min: [0, 'Total cannot be negative'],
    },
    status: {
      type: String,
      enum: ['DRAFT', 'ISSUED', 'PAID', 'VOID'],
      required: true,
      default: 'DRAFT',
    },
  },
  {
    timestamps: true,
  }
)

// Create indexes
InvoiceSchema.index({ invoiceNumber: 1 }, { unique: true })
InvoiceSchema.index({ booking: 1 })
InvoiceSchema.index({ status: 1 })
InvoiceSchema.index({ issueDate: -1 })
InvoiceSchema.index({ dueDate: 1 })
InvoiceSchema.index({ booking: 1, status: 1 }) // Compound index for booking invoices with status

const Invoice: Model<IInvoice> = mongoose.models.Invoice || mongoose.model<IInvoice>('Invoice', InvoiceSchema)

export default Invoice


import mongoose, { Schema, Document, Model } from 'mongoose'

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CHECKED_OUT' | 'CHECKED_IN' | 'CANCELLED'
export type RentalType = 'DAILY' | 'WEEKLY' | 'MONTHLY'
export type DepositStatus = 'HELD' | 'RELEASED' | 'PARTIAL'
export type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID'

export interface IBooking extends Document {
  vehicle: mongoose.Types.ObjectId
  customer: mongoose.Types.ObjectId
  bookedBy: mongoose.Types.ObjectId
  startDateTime: Date
  endDateTime: Date
  pickupBranch: string
  dropoffBranch: string
  status: BookingStatus
  rentalType: RentalType
  baseRate: number
  discounts: number
  taxes: number
  totalAmount: number
  depositAmount: number
  depositStatus: DepositStatus
  paymentStatus: PaymentStatus
  mileageAtBooking?: number
  notes?: string
  createdAt: Date
  updatedAt: Date
}

const BookingSchema = new Schema<IBooking>(
  {
    vehicle: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: [true, 'Vehicle is required'],
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: 'CustomerProfile',
      required: [true, 'Customer is required'],
    },
    bookedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Booked by user is required'],
    },
    startDateTime: {
      type: Date,
      required: [true, 'Start date/time is required'],
    },
    endDateTime: {
      type: Date,
      required: false,
      validate: {
        validator: function(this: IBooking, value: Date) {
          if (!value) return true // End date is optional
          return value > this.startDateTime
        },
        message: 'End date/time must be after start date/time',
      },
    },
    pickupBranch: {
      type: String,
      required: [true, 'Pickup branch is required'],
      trim: true,
    },
    dropoffBranch: {
      type: String,
      required: [true, 'Dropoff branch is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'CHECKED_OUT', 'CHECKED_IN', 'CANCELLED'],
      required: true,
      default: 'PENDING',
    },
    rentalType: {
      type: String,
      enum: ['DAILY', 'WEEKLY', 'MONTHLY'],
      required: [true, 'Rental type is required'],
    },
    baseRate: {
      type: Number,
      required: [true, 'Base rate is required'],
      min: [0, 'Base rate cannot be negative'],
    },
    discounts: {
      type: Number,
      default: 0,
      min: [0, 'Discounts cannot be negative'],
    },
    taxes: {
      type: Number,
      required: [true, 'Taxes are required'],
      min: [0, 'Taxes cannot be negative'],
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0, 'Total amount cannot be negative'],
    },
    depositAmount: {
      type: Number,
      required: [true, 'Deposit amount is required'],
      min: [0, 'Deposit amount cannot be negative'],
    },
    depositStatus: {
      type: String,
      enum: ['HELD', 'RELEASED', 'PARTIAL'],
      required: true,
      default: 'HELD',
    },
    paymentStatus: {
      type: String,
      enum: ['UNPAID', 'PARTIALLY_PAID', 'PAID'],
      required: true,
      default: 'UNPAID',
    },
    mileageAtBooking: {
      type: Number,
      min: [0, 'Mileage cannot be negative'],
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
)

// Create indexes
BookingSchema.index({ vehicle: 1 })
BookingSchema.index({ customer: 1 })
BookingSchema.index({ bookedBy: 1 })
BookingSchema.index({ status: 1 })
BookingSchema.index({ startDateTime: 1 })
BookingSchema.index({ endDateTime: 1 })
BookingSchema.index({ paymentStatus: 1 })
BookingSchema.index({ createdAt: -1 })
BookingSchema.index({ customer: 1, status: 1 }) // Compound index for customer bookings with status
BookingSchema.index({ startDateTime: 1, endDateTime: 1 }) // Compound index for date range queries

const Booking: Model<IBooking> = mongoose.models.Booking || mongoose.model<IBooking>('Booking', BookingSchema)

export default Booking


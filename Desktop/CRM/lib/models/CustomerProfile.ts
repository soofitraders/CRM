import mongoose, { Schema, Document, Model } from 'mongoose'

export interface ICustomerProfile extends Document {
  user: mongoose.Types.ObjectId
  nationalId?: string
  passportNumber?: string
  drivingLicenseNumber: string
  drivingLicenseCountry: string
  drivingLicenseExpiry: Date
  phone: string
  alternatePhone?: string
  addressLine1: string
  city: string
  country: string
  emergencyContactName: string
  emergencyContactPhone: string
  documents: mongoose.Types.ObjectId[]
  createdAt: Date
  updatedAt: Date
}

const CustomerProfileSchema = new Schema<ICustomerProfile>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
      unique: true,
    },
    nationalId: {
      type: String,
      trim: true,
    },
    passportNumber: {
      type: String,
      trim: true,
      uppercase: true,
    },
    drivingLicenseNumber: {
      type: String,
      required: [true, 'Driving license number is required'],
      trim: true,
      uppercase: true,
    },
    drivingLicenseCountry: {
      type: String,
      required: [true, 'Driving license country is required'],
      trim: true,
    },
    drivingLicenseExpiry: {
      type: Date,
      required: [true, 'Driving license expiry is required'],
    },
    phone: {
      type: String,
      required: [true, 'Phone is required'],
      trim: true,
    },
    alternatePhone: {
      type: String,
      trim: true,
    },
    addressLine1: {
      type: String,
      required: [true, 'Address is required'],
      trim: true,
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
    },
    country: {
      type: String,
      required: [true, 'Country is required'],
      trim: true,
    },
    emergencyContactName: {
      type: String,
      required: [true, 'Emergency contact name is required'],
      trim: true,
    },
    emergencyContactPhone: {
      type: String,
      required: [true, 'Emergency contact phone is required'],
      trim: true,
    },
    documents: [{
      type: Schema.Types.ObjectId,
      ref: 'Document',
    }],
  },
  {
    timestamps: true,
  }
)

// Create indexes
CustomerProfileSchema.index({ user: 1 }, { unique: true })
CustomerProfileSchema.index({ drivingLicenseNumber: 1 })
CustomerProfileSchema.index({ nationalId: 1 })
CustomerProfileSchema.index({ passportNumber: 1 })
CustomerProfileSchema.index({ phone: 1 })

const CustomerProfile: Model<ICustomerProfile> = mongoose.models.CustomerProfile || mongoose.model<ICustomerProfile>('CustomerProfile', CustomerProfileSchema)

export default CustomerProfile


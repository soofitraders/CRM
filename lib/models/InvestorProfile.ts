import mongoose, { Schema, Document, Model } from 'mongoose'

export type InvestorType = 'INDIVIDUAL' | 'COMPANY'
export type PayoutFrequency = 'MONTHLY' | 'QUARTERLY'

export interface IInvestorProfile extends Document {
  user: mongoose.Types.ObjectId
  type: InvestorType
  companyName?: string
  tradeLicenseNumber?: string
  taxId: string
  bankAccountName: string
  bankName: string
  iban: string
  swift: string
  payoutFrequency: PayoutFrequency
  documents: mongoose.Types.ObjectId[]
  createdAt: Date
  updatedAt: Date
}

const InvestorProfileSchema = new Schema<IInvestorProfile>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
      unique: true,
    },
    type: {
      type: String,
      enum: ['INDIVIDUAL', 'COMPANY'],
      required: [true, 'Investor type is required'],
    },
    companyName: {
      type: String,
      required: function(this: IInvestorProfile) {
        return this.type === 'COMPANY'
      },
      trim: true,
    },
    tradeLicenseNumber: {
      type: String,
      trim: true,
    },
    taxId: {
      type: String,
      required: [true, 'Tax ID is required'],
      trim: true,
    },
    bankAccountName: {
      type: String,
      required: [true, 'Bank account name is required'],
      trim: true,
    },
    bankName: {
      type: String,
      required: [true, 'Bank name is required'],
      trim: true,
    },
    iban: {
      type: String,
      required: [true, 'IBAN is required'],
      trim: true,
      uppercase: true,
    },
    swift: {
      type: String,
      required: [true, 'SWIFT code is required'],
      trim: true,
      uppercase: true,
    },
    payoutFrequency: {
      type: String,
      enum: ['MONTHLY', 'QUARTERLY'],
      required: [true, 'Payout frequency is required'],
      default: 'MONTHLY',
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
InvestorProfileSchema.index({ user: 1 }, { unique: true })
InvestorProfileSchema.index({ type: 1 })
InvestorProfileSchema.index({ taxId: 1 })
InvestorProfileSchema.index({ iban: 1 })

const InvestorProfile: Model<IInvestorProfile> = mongoose.models.InvestorProfile || mongoose.model<IInvestorProfile>('InvestorProfile', InvestorProfileSchema)

export default InvestorProfile


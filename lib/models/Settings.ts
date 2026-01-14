import mongoose, { Schema, Document, Model } from 'mongoose'

export interface ISettings extends Document {
  companyName: string
  logoUrl?: string // URL or path to logo file
  defaultCurrency: string
  timezone: string
  defaultTaxPercent: number
  updatedAt: Date
}

const SettingsSchema = new Schema<ISettings>(
  {
    companyName: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
      default: 'MisterWheels',
    },
    logoUrl: {
      type: String,
      trim: true,
      default: '/logo.png', // Default to public logo.png
    },
    defaultCurrency: {
      type: String,
      required: [true, 'Default currency is required'],
      trim: true,
      default: 'AED',
      uppercase: true,
    },
    timezone: {
      type: String,
      required: [true, 'Timezone is required'],
      trim: true,
      default: 'Asia/Dubai',
    },
    defaultTaxPercent: {
      type: Number,
      required: [true, 'Default tax percent is required'],
      min: [0, 'Tax percent cannot be negative'],
      max: [100, 'Tax percent cannot exceed 100'],
      default: 5,
    },
  },
  {
    timestamps: true,
  }
)

// Ensure only one settings document exists
SettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne()
  if (!settings) {
    settings = await this.create({})
  }
  return settings
}

const Settings: Model<ISettings> =
  mongoose.models.Settings || mongoose.model<ISettings>('Settings', SettingsSchema)

export default Settings


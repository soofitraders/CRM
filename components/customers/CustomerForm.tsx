'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createCustomerSchema, CreateCustomerInput } from '@/lib/validation/customer'

interface CustomerFormProps {
  initialData?: Partial<CreateCustomerInput>
  onSubmit: (data: CreateCustomerInput) => Promise<void>
  onCancel?: () => void
  isLoading?: boolean
  isEdit?: boolean
}

export default function CustomerForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
  isEdit = false,
}: CustomerFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateCustomerInput>({
    resolver: zodResolver(createCustomerSchema),
    defaultValues: initialData,
  })

  const onFormSubmit = async (data: CreateCustomerInput) => {
    await onSubmit(data)
  }

  const formatDateForInput = (date: Date | string | undefined) => {
    if (!date) return ''
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toISOString().split('T')[0]
  }

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
      {/* Personal Information */}
      <div>
        <h3 className="text-lg font-semibold text-headingText mb-4">Personal Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-headingText mb-2">
              Name *
            </label>
            <input
              type="text"
              {...register('name')}
              placeholder="Full name"
              className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
            />
            {errors.name && (
              <p className="text-danger text-xs mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-headingText mb-2">
              Email *
            </label>
            <input
              type="email"
              {...register('email')}
              placeholder="email@example.com"
              disabled={isEdit}
              className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {errors.email && (
              <p className="text-danger text-xs mt-1">{errors.email.message}</p>
            )}
          </div>

          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-headingText mb-2">
                Password {!isEdit && '(optional)'}
              </label>
              <input
                type="password"
                {...register('password')}
                placeholder="Leave empty for default password"
                className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
              />
              {errors.password && (
                <p className="text-danger text-xs mt-1">{errors.password.message}</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-headingText mb-2">
              Phone *
            </label>
            <input
              type="tel"
              {...register('phone')}
              placeholder="+971 XX XXX XXXX"
              className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
            />
            {errors.phone && (
              <p className="text-danger text-xs mt-1">{errors.phone.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-headingText mb-2">
              Alternate Phone
            </label>
            <input
              type="tel"
              {...register('alternatePhone')}
              placeholder="+971 XX XXX XXXX"
              className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
            />
            {errors.alternatePhone && (
              <p className="text-danger text-xs mt-1">{errors.alternatePhone.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Identification */}
      <div>
        <h3 className="text-lg font-semibold text-headingText mb-4">Identification</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-headingText mb-2">
              National ID
            </label>
            <input
              type="text"
              {...register('nationalId')}
              placeholder="National ID number"
              className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
            />
            {errors.nationalId && (
              <p className="text-danger text-xs mt-1">{errors.nationalId.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-headingText mb-2">
              National ID Expiry Date
            </label>
            <input
              type="date"
              {...register('nationalIdExpiry')}
              defaultValue={formatDateForInput(initialData?.nationalIdExpiry)}
              className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
            />
            {errors.nationalIdExpiry && (
              <p className="text-danger text-xs mt-1">{errors.nationalIdExpiry.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-headingText mb-2">
              Passport Number
            </label>
            <input
              type="text"
              {...register('passportNumber')}
              placeholder="Passport number"
              className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50 uppercase"
            />
            {errors.passportNumber && (
              <p className="text-danger text-xs mt-1">{errors.passportNumber.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Driving License */}
      <div>
        <h3 className="text-lg font-semibold text-headingText mb-4">Driving License</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-headingText mb-2">
              License Number *
            </label>
            <input
              type="text"
              {...register('drivingLicenseNumber')}
              placeholder="License number"
              className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50 uppercase"
            />
            {errors.drivingLicenseNumber && (
              <p className="text-danger text-xs mt-1">{errors.drivingLicenseNumber.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-headingText mb-2">
              License Country *
            </label>
            <input
              type="text"
              {...register('drivingLicenseCountry')}
              placeholder="Country"
              className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
            />
            {errors.drivingLicenseCountry && (
              <p className="text-danger text-xs mt-1">{errors.drivingLicenseCountry.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-headingText mb-2">
              License Expiry *
            </label>
            <input
              type="date"
              {...register('drivingLicenseExpiry')}
              defaultValue={formatDateForInput(initialData?.drivingLicenseExpiry)}
              className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
            />
            {errors.drivingLicenseExpiry && (
              <p className="text-danger text-xs mt-1">{errors.drivingLicenseExpiry.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Address */}
      <div>
        <h3 className="text-lg font-semibold text-headingText mb-4">Address</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-headingText mb-2">
              Address Line 1 *
            </label>
            <input
              type="text"
              {...register('addressLine1')}
              placeholder="Street address"
              className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
            />
            {errors.addressLine1 && (
              <p className="text-danger text-xs mt-1">{errors.addressLine1.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-headingText mb-2">
              City *
            </label>
            <input
              type="text"
              {...register('city')}
              placeholder="City"
              className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
            />
            {errors.city && (
              <p className="text-danger text-xs mt-1">{errors.city.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-headingText mb-2">
              Country *
            </label>
            <input
              type="text"
              {...register('country')}
              placeholder="Country"
              className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
            />
            {errors.country && (
              <p className="text-danger text-xs mt-1">{errors.country.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Emergency Contact */}
      <div>
        <h3 className="text-lg font-semibold text-headingText mb-4">Emergency Contact</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-headingText mb-2">
              Contact Name *
            </label>
            <input
              type="text"
              {...register('emergencyContactName')}
              placeholder="Emergency contact name"
              className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
            />
            {errors.emergencyContactName && (
              <p className="text-danger text-xs mt-1">{errors.emergencyContactName.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-headingText mb-2">
              Contact Phone *
            </label>
            <input
              type="tel"
              {...register('emergencyContactPhone')}
              placeholder="+971 XX XXX XXXX"
              className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
            />
            {errors.emergencyContactPhone && (
              <p className="text-danger text-xs mt-1">{errors.emergencyContactPhone.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex items-center justify-end gap-4 pt-4 border-t border-borderSoft">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText font-medium hover:bg-borderSoft transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-2 bg-sidebarActiveBg text-white rounded-lg font-medium hover:bg-sidebarActiveBg/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Saving...' : isEdit ? 'Update Customer' : 'Create Customer'}
        </button>
      </div>
    </form>
  )
}


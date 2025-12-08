'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createVehicleSchema, CreateVehicleInput } from '@/lib/validation/vehicle'
import { logger } from '@/lib/utils/logger'

interface VehicleFormProps {
  initialData?: Partial<CreateVehicleInput>
  onSubmit: (data: CreateVehicleInput) => Promise<void>
  onCancel?: () => void
  isLoading?: boolean
}

interface Investor {
  _id: string
  user: {
    name: string
    email: string
  }
}

export default function VehicleForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}: VehicleFormProps) {
  const [investors, setInvestors] = useState<Investor[]>([])
  const [ownershipType, setOwnershipType] = useState<'COMPANY' | 'INVESTOR'>(
    (initialData?.ownershipType as 'COMPANY' | 'INVESTOR') || 'COMPANY'
  )

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    setValue,
  } = useForm<CreateVehicleInput>({
    resolver: zodResolver(createVehicleSchema) as any,
    defaultValues: initialData || {
      status: 'AVAILABLE',
      category: 'SEDAN',
      fuelType: 'PETROL',
      transmission: 'AUTOMATIC',
      ownershipType: 'COMPANY',
      mileage: 0,
      dailyRate: 0,
      weeklyRate: 0,
      monthlyRate: 0,
    },
  })

  // Watch ownership type
  const watchedOwnershipType = watch('ownershipType')

  useEffect(() => {
    setOwnershipType(watchedOwnershipType as 'COMPANY' | 'INVESTOR')
  }, [watchedOwnershipType])

  // Fetch investors
  useEffect(() => {
    if (ownershipType === 'INVESTOR') {
      const fetchInvestors = async () => {
        try {
          const response = await fetch('/api/investors')
          if (response.ok) {
            const data = await response.json()
            setInvestors(data.investors || [])
          }
        } catch (error) {
          logger.error('Error fetching investors:', error)
        }
      }
      fetchInvestors()
    }
  }, [ownershipType])

  const onFormSubmit = async (data: CreateVehicleInput) => {
    // Clear investor if ownership type is COMPANY
    if (data.ownershipType === 'COMPANY') {
      data.investor = undefined
    }
    await onSubmit(data)
  }

  const formatDateForInput = (date: Date | string | undefined) => {
    if (!date) return ''
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toISOString().split('T')[0]
  }

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Plate Number */}
        <div>
          <label className="block text-sm font-medium text-headingText mb-2">
            Plate Number *
          </label>
          <input
            type="text"
            {...register('plateNumber')}
            placeholder="ABC-1234"
            className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50 uppercase"
          />
          {errors.plateNumber && (
            <p className="text-danger text-xs mt-1">{errors.plateNumber.message}</p>
          )}
        </div>

        {/* Chassis Number */}
        <div>
          <label className="block text-sm font-medium text-headingText mb-2">
            Chassis Number *
          </label>
          <input
            type="text"
            {...register('vin')}
            placeholder="Chassis Number"
            className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50 uppercase"
          />
          {errors.vin && (
            <p className="text-danger text-xs mt-1">{errors.vin.message?.replace('VIN', 'Chassis Number')}</p>
          )}
        </div>

        {/* Brand */}
        <div>
          <label className="block text-sm font-medium text-headingText mb-2">
            Brand *
          </label>
          <input
            type="text"
            {...register('brand')}
            placeholder="Toyota"
            className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
          />
          {errors.brand && (
            <p className="text-danger text-xs mt-1">{errors.brand.message}</p>
          )}
        </div>

        {/* Model */}
        <div>
          <label className="block text-sm font-medium text-headingText mb-2">
            Model *
          </label>
          <input
            type="text"
            {...register('model')}
            placeholder="Camry"
            className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
          />
          {errors.model && (
            <p className="text-danger text-xs mt-1">{errors.model.message}</p>
          )}
        </div>

        {/* Year */}
        <div>
          <label className="block text-sm font-medium text-headingText mb-2">
            Year *
          </label>
          <input
            type="number"
            {...register('year', { valueAsNumber: true })}
            placeholder="2024"
            min="1900"
            max={new Date().getFullYear() + 1}
            className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
          />
          {errors.year && (
            <p className="text-danger text-xs mt-1">{errors.year.message}</p>
          )}
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-headingText mb-2">
            Category *
          </label>
          <select
            {...register('category')}
            className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
          >
            <option value="SUV">SUV</option>
            <option value="SEDAN">Sedan</option>
            <option value="HATCHBACK">Hatchback</option>
            <option value="COUPE">Coupe</option>
            <option value="CONVERTIBLE">Convertible</option>
            <option value="WAGON">Wagon</option>
            <option value="VAN">Van</option>
            <option value="TRUCK">Truck</option>
            <option value="CROSSOVER">Crossover</option>
            <option value="OTHER">Other</option>
          </select>
          {errors.category && (
            <p className="text-danger text-xs mt-1">{errors.category.message}</p>
          )}
        </div>

        {/* Ownership Type */}
        <div>
          <label className="block text-sm font-medium text-headingText mb-2">
            Ownership Type *
          </label>
          <select
            {...register('ownershipType')}
            className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
          >
            <option value="COMPANY">Company</option>
            <option value="INVESTOR">Investor</option>
          </select>
          {errors.ownershipType && (
            <p className="text-danger text-xs mt-1">{errors.ownershipType.message}</p>
          )}
        </div>

        {/* Investor (conditional) */}
        {ownershipType === 'INVESTOR' && (
          <div>
            <label className="block text-sm font-medium text-headingText mb-2">
              Investor *
            </label>
            <select
              {...register('investor')}
              className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
            >
              <option value="">Select investor</option>
              {investors.map((investor) => (
                <option key={investor._id} value={investor._id}>
                  {investor.user.name} ({investor.user.email})
                </option>
              ))}
            </select>
            {errors.investor && (
              <p className="text-danger text-xs mt-1">{errors.investor.message}</p>
            )}
          </div>
        )}

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-headingText mb-2">
            Status *
          </label>
          <select
            {...register('status')}
            className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
          >
            <option value="AVAILABLE">Available</option>
            <option value="BOOKED">Booked</option>
            <option value="IN_MAINTENANCE">In Maintenance</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          {errors.status && (
            <p className="text-danger text-xs mt-1">{errors.status.message}</p>
          )}
        </div>

        {/* Mileage */}
        <div>
          <label className="block text-sm font-medium text-headingText mb-2">
            Mileage *
          </label>
          <input
            type="number"
            {...register('mileage', { valueAsNumber: true })}
            placeholder="0"
            min="0"
            className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
          />
          {errors.mileage && (
            <p className="text-danger text-xs mt-1">{errors.mileage.message}</p>
          )}
        </div>

        {/* Fuel Type */}
        <div>
          <label className="block text-sm font-medium text-headingText mb-2">
            Fuel Type *
          </label>
          <select
            {...register('fuelType')}
            className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
          >
            <option value="PETROL">Petrol</option>
            <option value="DIESEL">Diesel</option>
            <option value="ELECTRIC">Electric</option>
            <option value="HYBRID">Hybrid</option>
            <option value="CNG">CNG</option>
          </select>
          {errors.fuelType && (
            <p className="text-danger text-xs mt-1">{errors.fuelType.message}</p>
          )}
        </div>

        {/* Transmission */}
        <div>
          <label className="block text-sm font-medium text-headingText mb-2">
            Transmission *
          </label>
          <select
            {...register('transmission')}
            className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
          >
            <option value="MANUAL">Manual</option>
            <option value="AUTOMATIC">Automatic</option>
            <option value="CVT">CVT</option>
          </select>
          {errors.transmission && (
            <p className="text-danger text-xs mt-1">{errors.transmission.message}</p>
          )}
        </div>

        {/* Registration Expiry */}
        <div>
          <label className="block text-sm font-medium text-headingText mb-2">
            Registration Expiry *
          </label>
          <input
            type="date"
            {...register('registrationExpiry')}
            defaultValue={formatDateForInput(initialData?.registrationExpiry)}
            className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
          />
          {errors.registrationExpiry && (
            <p className="text-danger text-xs mt-1">{errors.registrationExpiry.message}</p>
          )}
        </div>

        {/* Insurance Expiry */}
        <div>
          <label className="block text-sm font-medium text-headingText mb-2">
            Insurance Expiry *
          </label>
          <input
            type="date"
            {...register('insuranceExpiry')}
            defaultValue={formatDateForInput(initialData?.insuranceExpiry)}
            className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
          />
          {errors.insuranceExpiry && (
            <p className="text-danger text-xs mt-1">{errors.insuranceExpiry.message}</p>
          )}
        </div>

        {/* Daily Rate */}
        <div>
          <label className="block text-sm font-medium text-headingText mb-2">
            Daily Rate (AED) *
          </label>
          <input
            type="number"
            step="0.01"
            {...register('dailyRate', { valueAsNumber: true })}
            placeholder="0.00"
            min="0"
            className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
          />
          {errors.dailyRate && (
            <p className="text-danger text-xs mt-1">{errors.dailyRate.message}</p>
          )}
        </div>

        {/* Weekly Rate */}
        <div>
          <label className="block text-sm font-medium text-headingText mb-2">
            Weekly Rate (AED) *
          </label>
          <input
            type="number"
            step="0.01"
            {...register('weeklyRate', { valueAsNumber: true })}
            placeholder="0.00"
            min="0"
            className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
          />
          {errors.weeklyRate && (
            <p className="text-danger text-xs mt-1">{errors.weeklyRate.message}</p>
          )}
        </div>

        {/* Monthly Rate */}
        <div>
          <label className="block text-sm font-medium text-headingText mb-2">
            Monthly Rate (AED) *
          </label>
          <input
            type="number"
            step="0.01"
            {...register('monthlyRate', { valueAsNumber: true })}
            placeholder="0.00"
            min="0"
            className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
          />
          {errors.monthlyRate && (
            <p className="text-danger text-xs mt-1">{errors.monthlyRate.message}</p>
          )}
        </div>

        {/* Current Branch */}
        <div>
          <label className="block text-sm font-medium text-headingText mb-2">
            Current Branch *
          </label>
          <input
            type="text"
            {...register('currentBranch')}
            placeholder="Branch name"
            className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
          />
          {errors.currentBranch && (
            <p className="text-danger text-xs mt-1">{errors.currentBranch.message}</p>
          )}
        </div>

        {/* Color */}
        <div>
          <label className="block text-sm font-medium text-headingText mb-2">
            Color
          </label>
          <input
            type="text"
            {...register('color')}
            placeholder="Vehicle color"
            className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
          />
          {errors.color && (
            <p className="text-danger text-xs mt-1">{errors.color.message}</p>
          )}
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
          {isLoading ? 'Saving...' : 'Save Vehicle'}
        </button>
      </div>
    </form>
  )
}


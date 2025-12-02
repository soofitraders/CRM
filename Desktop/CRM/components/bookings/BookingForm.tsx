'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createBookingSchema, CreateBookingInput } from '@/lib/validation/booking'
import { Calendar, X } from 'lucide-react'

interface BookingFormProps {
  initialData?: Partial<CreateBookingInput>
  onSubmit: (data: CreateBookingInput) => Promise<void>
  onCancel?: () => void
  isLoading?: boolean
}

interface Vehicle {
  _id: string
  plateNumber: string
  brand: string
  model: string
  mileage?: number
}

interface Customer {
  _id: string
  user: {
    name: string
    email: string
  }
}

export default function BookingForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}: BookingFormProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [calculatedTotal, setCalculatedTotal] = useState(0)
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  const [currentMileage, setCurrentMileage] = useState<number | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    setValue,
  } = useForm<CreateBookingInput>({
    resolver: zodResolver(createBookingSchema),
    defaultValues: initialData || {
      discounts: 0,
      taxPercent: 5,
      depositAmount: 0,
    },
  })

  // Watch form values for calculations
  const baseRate = watch('baseRate') || 0
  const discounts = watch('discounts') || 0
  const taxPercent = watch('taxPercent') || 0
  const selectedVehicleId = watch('vehicle')

  // Calculate total whenever rates change
  useEffect(() => {
    const subtotal = baseRate - discounts
    const taxAmount = (subtotal * taxPercent) / 100
    const total = subtotal + taxAmount
    setCalculatedTotal(total)
  }, [baseRate, discounts, taxPercent])

  // Fetch vehicle details when vehicle is selected
  useEffect(() => {
    if (selectedVehicleId) {
      const vehicle = vehicles.find((v) => v._id === selectedVehicleId)
      if (vehicle) {
        setSelectedVehicle(vehicle)
        setCurrentMileage(vehicle.mileage || null)
      } else {
        // Fetch vehicle details if not in list
        fetch(`/api/vehicles/${selectedVehicleId}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.vehicle) {
              setSelectedVehicle(data.vehicle)
              setCurrentMileage(data.vehicle.mileage || null)
            }
          })
          .catch((err) => console.error('Error fetching vehicle:', err))
      }
    } else {
      setSelectedVehicle(null)
      setCurrentMileage(null)
    }
  }, [selectedVehicleId, vehicles])

  // Fetch vehicles and customers
  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch available vehicles
        const vehiclesRes = await fetch('/api/vehicles?status=AVAILABLE&limit=1000')
        if (vehiclesRes.ok) {
          const vehiclesData = await vehiclesRes.json()
          setVehicles(vehiclesData.vehicles || [])
        }

        // Fetch customers
        const customersRes = await fetch('/api/customers')
        if (customersRes.ok) {
          const customersData = await customersRes.json()
          setCustomers(customersData.customers || [])
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      }
    }
    fetchData()
  }, [])

  const onFormSubmit = async (data: CreateBookingInput) => {
    // Include mileage in the submission
    const formData = { ...data } as any
    const mileageInput = document.querySelector<HTMLInputElement>('input[type="number"][min]')
    if (mileageInput && mileageInput.value) {
      formData.mileageAtBooking = parseInt(mileageInput.value)
    }
    await onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Vehicle */}
        <div>
          <label className="block text-sm font-medium text-headingText mb-2">
            Vehicle *
          </label>
          <select
            {...register('vehicle')}
            className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
          >
            <option value="">Select vehicle</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle._id} value={vehicle._id}>
                {vehicle.plateNumber} - {vehicle.brand} {vehicle.model}
              </option>
            ))}
          </select>
          {errors.vehicle && (
            <p className="text-danger text-xs mt-1">{errors.vehicle.message}</p>
          )}
        </div>

        {/* Mileage at Booking */}
        {selectedVehicle && (
          <div>
            <label className="block text-sm font-medium text-headingText mb-2">
              Current Mileage (km)
            </label>
            <div className="space-y-2">
              <div className="text-xs text-sidebarMuted">
                Current: {currentMileage !== null ? `${currentMileage.toLocaleString()} km` : 'N/A'}
              </div>
              <input
                type="number"
                step="1"
                min={currentMileage || 0}
                placeholder={currentMileage?.toString() || 'Enter mileage'}
                onChange={(e) => {
                  const value = e.target.value ? parseInt(e.target.value) : null
                  if (value !== null) {
                    setValue('mileageAtBooking' as any, value)
                  }
                }}
                className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
              />
              <p className="text-xs text-sidebarMuted">
                Update vehicle mileage when creating this booking
              </p>
            </div>
          </div>
        )}

        {/* Customer */}
        <div>
          <label className="block text-sm font-medium text-headingText mb-2">
            Customer *
          </label>
          <select
            {...register('customer')}
            className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
          >
            <option value="">Select customer</option>
            {customers.map((customer) => (
              <option key={customer._id} value={customer._id}>
                {customer.user.name} ({customer.user.email})
              </option>
            ))}
          </select>
          {errors.customer && (
            <p className="text-danger text-xs mt-1">{errors.customer.message}</p>
          )}
        </div>

        {/* Rental Type */}
        <div>
          <label className="block text-sm font-medium text-headingText mb-2">
            Rental Type *
          </label>
          <select
            {...register('rentalType')}
            className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
          >
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
          </select>
          {errors.rentalType && (
            <p className="text-danger text-xs mt-1">{errors.rentalType.message}</p>
          )}
        </div>

        {/* Start Date/Time */}
        <div>
          <label className="block text-sm font-medium text-headingText mb-2">
            Start Date & Time *
          </label>
          <input
            type="datetime-local"
            {...register('startDateTime', {
              setValueAs: (value) => {
                if (!value) return value
                // Convert to ISO string for datetime-local format
                return new Date(value).toISOString().slice(0, 16)
              },
            })}
            className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
          />
          {errors.startDateTime && (
            <p className="text-danger text-xs mt-1">{errors.startDateTime.message}</p>
          )}
        </div>

        {/* End Date/Time */}
        <div>
          <label className="block text-sm font-medium text-headingText mb-2">
            End Date & Time *
          </label>
          <input
            type="datetime-local"
            {...register('endDateTime', {
              setValueAs: (value) => {
                if (!value) return value
                // Convert to ISO string for datetime-local format
                return new Date(value).toISOString().slice(0, 16)
              },
            })}
            className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
          />
          {errors.endDateTime && (
            <p className="text-danger text-xs mt-1">{errors.endDateTime.message}</p>
          )}
        </div>

        {/* Pickup Branch */}
        <div>
          <label className="block text-sm font-medium text-headingText mb-2">
            Pickup Branch *
          </label>
          <input
            type="text"
            {...register('pickupBranch')}
            placeholder="Enter pickup branch"
            className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
          />
          {errors.pickupBranch && (
            <p className="text-danger text-xs mt-1">{errors.pickupBranch.message}</p>
          )}
        </div>

        {/* Dropoff Branch */}
        <div>
          <label className="block text-sm font-medium text-headingText mb-2">
            Dropoff Branch *
          </label>
          <input
            type="text"
            {...register('dropoffBranch')}
            placeholder="Enter dropoff branch"
            className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
          />
          {errors.dropoffBranch && (
            <p className="text-danger text-xs mt-1">{errors.dropoffBranch.message}</p>
          )}
        </div>

        {/* Base Rate */}
        <div>
          <label className="block text-sm font-medium text-headingText mb-2">
            Base Rate (AED) *
          </label>
          <input
            type="number"
            step="0.01"
            {...register('baseRate', { valueAsNumber: true })}
            placeholder="0.00"
            className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
          />
          {errors.baseRate && (
            <p className="text-danger text-xs mt-1">{errors.baseRate.message}</p>
          )}
        </div>

        {/* Discounts */}
        <div>
          <label className="block text-sm font-medium text-headingText mb-2">
            Discounts (AED)
          </label>
          <input
            type="number"
            step="0.01"
            {...register('discounts', { valueAsNumber: true })}
            placeholder="0.00"
            className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
          />
          {errors.discounts && (
            <p className="text-danger text-xs mt-1">{errors.discounts.message}</p>
          )}
        </div>

        {/* Tax Percent */}
        <div>
          <label className="block text-sm font-medium text-headingText mb-2">
            Tax Percent (%)
          </label>
          <input
            type="number"
            step="0.01"
            {...register('taxPercent', { valueAsNumber: true })}
            placeholder="5"
            className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
          />
          {errors.taxPercent && (
            <p className="text-danger text-xs mt-1">{errors.taxPercent.message}</p>
          )}
        </div>

        {/* Deposit Amount */}
        <div>
          <label className="block text-sm font-medium text-headingText mb-2">
            Deposit Amount (AED) *
          </label>
          <input
            type="number"
            step="0.01"
            {...register('depositAmount', { valueAsNumber: true })}
            placeholder="0.00"
            className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
          />
          {errors.depositAmount && (
            <p className="text-danger text-xs mt-1">{errors.depositAmount.message}</p>
          )}
        </div>
      </div>

      {/* Total Amount Display */}
      <div className="bg-sidebarActiveBg/10 border border-sidebarActiveBg/20 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-headingText">Total Amount:</span>
          <span className="text-2xl font-bold text-sidebarActiveBg">
            AED {calculatedTotal.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-headingText mb-2">
          Notes
        </label>
        <textarea
          {...register('notes')}
          rows={4}
          placeholder="Additional notes..."
          className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50 resize-none"
        />
        {errors.notes && (
          <p className="text-danger text-xs mt-1">{errors.notes.message}</p>
        )}
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
          {isLoading ? 'Saving...' : 'Save Booking'}
        </button>
      </div>
    </form>
  )
}


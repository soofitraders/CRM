'use client'

import { useEffect, useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createBookingSchema, CreateBookingInput } from '@/lib/validation/booking'
import { Calendar, X, Search, ChevronDown } from 'lucide-react'
import { logger } from '@/lib/utils/logger'

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
  const [customerSearchTerm, setCustomerSearchTerm] = useState('')
  const [calculatedTotal, setCalculatedTotal] = useState(0)
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  const [currentMileage, setCurrentMileage] = useState<number | null>(null)
  const [vehicleSearchTerm, setVehicleSearchTerm] = useState('')
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false)
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const vehicleDropdownRef = useRef<HTMLDivElement>(null)
  const customerDropdownRef = useRef<HTMLDivElement>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    setValue,
  } = useForm<CreateBookingInput>({
    resolver: zodResolver(createBookingSchema) as any,
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
          .catch((err) => logger.error('Error fetching vehicle:', err))
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
        // Fetch available vehicles with cache busting to ensure fresh data
        const vehiclesRes = await fetch(`/api/vehicles?status=AVAILABLE&limit=1000&_t=${Date.now()}`)
        if (vehiclesRes.ok) {
          const vehiclesData = await vehiclesRes.json()
          setVehicles(vehiclesData.vehicles || [])
          logger.log(`[BookingForm] Loaded ${vehiclesData.vehicles?.length || 0} available vehicles`)
        }

        // Fetch customers with a higher limit so all customers show in the dropdown
        const customersRes = await fetch('/api/customers?limit=1000&page=1')
        if (customersRes.ok) {
          const customersData = await customersRes.json()
          setCustomers(customersData.customers || [])
        }
      } catch (error) {
        logger.error('Error fetching data:', error)
      }
    }
    fetchData()
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (vehicleDropdownRef.current && !vehicleDropdownRef.current.contains(target)) {
        setShowVehicleDropdown(false)
      }
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(target)) {
        setShowCustomerDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter vehicles based on search term
  const filteredVehicles = vehicles.filter((vehicle) => {
    const searchLower = vehicleSearchTerm.toLowerCase()
    const plateNumber = vehicle.plateNumber?.toLowerCase() || ''
    const brand = vehicle.brand?.toLowerCase() || ''
    const model = vehicle.model?.toLowerCase() || ''
    return plateNumber.includes(searchLower) || brand.includes(searchLower) || model.includes(searchLower)
  })

  const filteredCustomers = customers.filter((customer) => {
    const searchLower = customerSearchTerm.toLowerCase()
    const name = customer.user.name?.toLowerCase() || ''
    const email = customer.user.email?.toLowerCase() || ''
    return name.includes(searchLower) || email.includes(searchLower)
  })

  const selectedCustomerId = watch('customer')
  const selectedCustomer = customers.find((customer) => customer._id === selectedCustomerId)

  const handleVehicleSelect = (vehicleId: string) => {
    setValue('vehicle', vehicleId)
    setShowVehicleDropdown(false)
    setVehicleSearchTerm('')
  }

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
        <div className="relative" ref={vehicleDropdownRef}>
          <label className="block text-sm font-medium text-headingText mb-2">
            Vehicle *
          </label>
          <input type="hidden" {...register('vehicle')} />
          <button
            type="button"
            onClick={() => {
              setShowVehicleDropdown((prev) => !prev)
              setVehicleSearchTerm('')
            }}
            className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-left text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50 flex items-center justify-between"
          >
            <span className="truncate">
              {selectedVehicle
                ? `${selectedVehicle.plateNumber} - ${selectedVehicle.brand} ${selectedVehicle.model}`
                : 'Select vehicle'}
            </span>
            <ChevronDown className="w-4 h-4 text-bodyText ml-2" />
          </button>
          {showVehicleDropdown && (
            <div className="absolute z-50 w-full mt-1 bg-cardBg border border-borderSoft rounded-lg shadow-lg">
              <div className="p-2 border-b border-borderSoft">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-sidebarMuted" />
                  <input
                    type="text"
                    value={vehicleSearchTerm}
                    autoFocus
                    onChange={(e) => setVehicleSearchTerm(e.target.value)}
                    placeholder="Search plate, brand, or model..."
                    className="w-full pl-10 pr-3 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
                  />
                </div>
              </div>
              <div className="max-h-60 overflow-y-auto">
                {filteredVehicles.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-bodyText text-center">
                    {vehicleSearchTerm ? 'No vehicles found' : 'No vehicles available'}
                  </div>
                ) : (
                  filteredVehicles.map((vehicle) => (
                    <button
                      key={vehicle._id}
                      type="button"
                      onClick={() => handleVehicleSelect(vehicle._id)}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-pageBg transition-colors ${
                        selectedVehicleId === vehicle._id ? 'bg-sidebarActiveBg/10' : ''
                      }`}
                    >
                      <div className="font-medium text-headingText">
                        {vehicle.plateNumber} - {vehicle.brand} {vehicle.model}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
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
          <div className="relative" ref={customerDropdownRef}>
            <input type="hidden" {...register('customer')} />
            <button
              type="button"
              onClick={() => {
                setShowCustomerDropdown((prev) => !prev)
                setCustomerSearchTerm('')
              }}
              className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-left text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50 flex items-center justify-between"
            >
              <span className="truncate">
                {selectedCustomer ? `${selectedCustomer.user.name} (${selectedCustomer.user.email})` : 'Select customer'}
              </span>
              <ChevronDown className="w-4 h-4 text-bodyText ml-2" />
            </button>
            {showCustomerDropdown && (
              <div className="absolute z-50 w-full mt-1 bg-cardBg border border-borderSoft rounded-lg shadow-lg">
                <div className="p-2 border-b border-borderSoft">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sidebarMuted" />
                    <input
                      type="text"
                      value={customerSearchTerm}
                      autoFocus
                      onChange={(e) => setCustomerSearchTerm(e.target.value)}
                      placeholder="Search name or email..."
                      className="w-full pl-10 pr-3 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
                    />
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {filteredCustomers.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-bodyText text-center">No customers found</div>
                  ) : (
                    filteredCustomers.map((customer) => (
                      <button
                        key={customer._id}
                        type="button"
                        onClick={() => {
                          setValue('customer', customer._id)
                          setShowCustomerDropdown(false)
                          setCustomerSearchTerm('')
                        }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-pageBg transition-colors ${
                          selectedCustomerId === customer._id ? 'bg-sidebarActiveBg/10' : ''
                        }`}
                      >
                        <div className="font-medium text-headingText">
                          {customer.user.name}
                        </div>
                        <div className="text-xs text-sidebarMuted">{customer.user.email}</div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
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
            End Date & Time
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
          <p className="text-xs text-sidebarMuted mt-1">Leave empty for open bookings</p>
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


'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import VehicleForm from '@/components/units/VehicleForm'
import SectionCard from '@/components/ui/SectionCard'
import StatusChip from '@/components/ui/StatusChip'
import MileageTracker from '@/components/vehicles/MileageTracker'
import { CreateVehicleInput, UpdateVehicleInput } from '@/lib/validation/vehicle'

interface Vehicle {
  _id: string
  plateNumber: string
  vin: string
  brand: string
  model: string
  year: number
  category: string
  ownershipType: 'COMPANY' | 'INVESTOR'
  investor?: {
    _id: string
  }
  status: string
  mileage: number
  fuelType: string
  transmission: string
  registrationExpiry: string
  insuranceExpiry: string
  dailyRate: number
  weeklyRate: number
  monthlyRate: number
  currentBranch: string
}

export default function EditVehiclePage() {
  const router = useRouter()
  const params = useParams()
  const vehicleId = params.id as string
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [userRole, setUserRole] = useState<string>('')

  useEffect(() => {
    fetchVehicle()
    fetchUserRole()
  }, [vehicleId])

  const fetchVehicle = async () => {
    try {
      const response = await fetch(`/api/vehicles/${vehicleId}`)
      if (response.ok) {
        const data = await response.json()
        setVehicle(data.vehicle)
      } else {
        alert('Failed to load vehicle')
        router.push('/units')
      }
    } catch (error) {
      console.error('Error fetching vehicle:', error)
      alert('Failed to load vehicle')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchUserRole = async () => {
    try {
      const response = await fetch('/api/auth/session')
      if (response.ok) {
        const session = await response.json()
        setUserRole(session.user?.role || '')
      }
    } catch (error) {
      console.error('Error fetching user role:', error)
    }
  }

  const handleUpdate = async (data: UpdateVehicleInput) => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/vehicles/${vehicleId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        router.push('/units')
        router.refresh()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to update vehicle')
      }
    } catch (error) {
      console.error('Error updating vehicle:', error)
      alert('Failed to update vehicle')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="text-center py-8 text-bodyText">Loading vehicle...</div>
    )
  }

  if (!vehicle) {
    return null
  }

  const canEdit = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(userRole)

  const initialFormData: Partial<CreateVehicleInput> = {
    plateNumber: vehicle.plateNumber,
    vin: vehicle.vin,
    brand: vehicle.brand,
    model: vehicle.model,
    year: vehicle.year,
    category: vehicle.category as any,
    ownershipType: vehicle.ownershipType,
    investor: vehicle.investor?._id,
    status: vehicle.status as any,
    mileage: vehicle.mileage,
    fuelType: vehicle.fuelType as any,
    transmission: vehicle.transmission as any,
    registrationExpiry: new Date(vehicle.registrationExpiry).toISOString().split('T')[0],
    insuranceExpiry: new Date(vehicle.insuranceExpiry).toISOString().split('T')[0],
    dailyRate: vehicle.dailyRate,
    weeklyRate: vehicle.weeklyRate,
    monthlyRate: vehicle.monthlyRate,
    currentBranch: vehicle.currentBranch,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-headingText">Edit Vehicle</h1>
        <p className="text-bodyText mt-2">
          {vehicle.plateNumber} - {vehicle.brand} {vehicle.model}
        </p>
      </div>

      {/* Status Display */}
      <SectionCard title="Vehicle Status">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-headingText mb-2">
              Current Status
            </label>
            <StatusChip status={vehicle.status.replace('_', ' ')} />
          </div>
        </div>
      </SectionCard>

      {/* Mileage Tracker */}
      <MileageTracker
        vehicleId={vehicleId}
        currentMileage={vehicle.mileage}
        onMileageUpdate={(newMileage) => {
          setVehicle({ ...vehicle, mileage: newMileage })
        }}
      />

      {/* Vehicle Details Form */}
      {canEdit ? (
        <SectionCard title="Vehicle Details">
          <VehicleForm
            initialData={initialFormData}
            onSubmit={handleUpdate as any}
            isLoading={isSaving}
            onCancel={() => router.push('/units')}
          />
        </SectionCard>
      ) : (
        <SectionCard title="Vehicle Details">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-headingText mb-1">
                Plate Number
              </label>
              <p className="text-bodyText">{vehicle.plateNumber}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-headingText mb-1">
                VIN
              </label>
              <p className="text-bodyText">{vehicle.vin}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-headingText mb-1">
                Brand/Model
              </label>
              <p className="text-bodyText">
                {vehicle.brand} {vehicle.model} ({vehicle.year})
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-headingText mb-1">
                Daily Rate
              </label>
              <p className="text-bodyText font-semibold">
                AED {vehicle.dailyRate.toFixed(2)}
              </p>
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  )
}


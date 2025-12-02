'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import VehicleForm from '@/components/units/VehicleForm'
import SectionCard from '@/components/ui/SectionCard'
import { CreateVehicleInput } from '@/lib/validation/vehicle'

export default function NewVehiclePage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (data: CreateVehicleInput) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/vehicles', {
        method: 'POST',
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
        alert(error.error || 'Failed to create vehicle')
      }
    } catch (error) {
      console.error('Error creating vehicle:', error)
      alert('Failed to create vehicle')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-headingText">New Vehicle</h1>
        <p className="text-bodyText mt-2">Add a new vehicle to the fleet</p>
      </div>

      <SectionCard title="Vehicle Details">
        <VehicleForm onSubmit={handleSubmit} isLoading={isLoading} />
      </SectionCard>
    </div>
  )
}


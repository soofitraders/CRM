'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import CustomerForm from '@/components/customers/CustomerForm'
import SectionCard from '@/components/ui/SectionCard'
import { CreateCustomerInput } from '@/lib/validation/customer'

export default function NewClientPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (data: CreateCustomerInput) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        router.push('/clients')
        router.refresh()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to create customer')
      }
    } catch (error) {
      console.error('Error creating customer:', error)
      alert('Failed to create customer')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-headingText">New Client</h1>
        <p className="text-bodyText mt-2">Create a new customer profile</p>
      </div>

      <SectionCard title="Customer Information">
        <CustomerForm onSubmit={handleSubmit} isLoading={isLoading} />
      </SectionCard>
    </div>
  )
}


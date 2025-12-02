'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import SectionCard from '@/components/ui/SectionCard'
import Table, { TableRow, TableCell } from '@/components/ui/Table'
import { Edit, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react'

interface MileageHistory {
  _id: string
  mileage: number
  recordedAt: string
  recordedBy: {
    name: string
    email: string
  }
  source: 'BOOKING' | 'INVOICE' | 'MANUAL' | 'MAINTENANCE'
  booking?: {
    startDateTime: string
    endDateTime: string
  }
  invoice?: {
    invoiceNumber: string
    issueDate: string
  }
  notes?: string
}

interface MileageTrackerProps {
  vehicleId: string
  currentMileage: number
  onMileageUpdate?: (newMileage: number) => void
}

const MILEAGE_CAP = 10000
const MILEAGE_WARNING_THRESHOLD = 9500

export default function MileageTracker({
  vehicleId,
  currentMileage,
  onMileageUpdate,
}: MileageTrackerProps) {
  const [history, setHistory] = useState<MileageHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [newMileage, setNewMileage] = useState(currentMileage.toString())
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    fetchHistory()
  }, [vehicleId])

  const fetchHistory = async () => {
    try {
      const response = await fetch(`/api/vehicles/${vehicleId}/mileage`)
      if (response.ok) {
        const data = await response.json()
        setHistory(data.history || [])
      }
    } catch (err) {
      console.error('Error fetching mileage history:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateMileage = async () => {
    const mileage = parseInt(newMileage)
    if (isNaN(mileage) || mileage < currentMileage) {
      alert('New mileage must be greater than or equal to current mileage')
      return
    }

    setUpdating(true)
    try {
      const response = await fetch(`/api/vehicles/${vehicleId}/mileage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mileage,
          source: 'MANUAL',
          notes: 'Manual mileage update',
        }),
      })

      if (response.ok) {
        const result = await response.json()
        setEditing(false)
        setNewMileage(mileage.toString())
        if (onMileageUpdate) {
          onMileageUpdate(mileage)
        }
        fetchHistory()

        // Show warning if applicable
        if (result.warning) {
          alert(result.warning.message)
        }
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to update mileage')
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update mileage')
    } finally {
      setUpdating(false)
    }
  }

  const remainingKm = MILEAGE_CAP - currentMileage
  const isNearThreshold = currentMileage >= MILEAGE_WARNING_THRESHOLD
  const isAtCap = currentMileage >= MILEAGE_CAP

  return (
    <SectionCard>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-headingText mb-2">Mileage Tracker</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-bodyText">Current Mileage</p>
            <p className="text-2xl font-bold text-headingText">
              {currentMileage.toLocaleString()} km
            </p>
            {!isAtCap && (
              <p className="text-xs text-sidebarMuted mt-1">
                {remainingKm > 0 ? `${remainingKm.toLocaleString()} km until maintenance` : 'Maintenance required'}
              </p>
            )}
          </div>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-2 bg-sidebarActiveBg text-white rounded-lg hover:bg-sidebarActiveBg/90 flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              Update Mileage
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={newMileage}
                onChange={(e) => setNewMileage(e.target.value)}
                min={currentMileage}
                className="w-32 px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
                disabled={updating}
              />
              <button
                onClick={handleUpdateMileage}
                disabled={updating}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
              </button>
              <button
                onClick={() => {
                  setEditing(false)
                  setNewMileage(currentMileage.toString())
                }}
                className="px-4 py-2 bg-cardBg border border-borderSoft rounded text-bodyText hover:bg-borderSoft"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Maintenance Alerts */}
      {isAtCap && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <div>
              <p className="font-semibold text-red-800">Maintenance Required</p>
              <p className="text-sm text-red-700">
                Vehicle has reached {MILEAGE_CAP.toLocaleString()} km. Maintenance is required immediately.
              </p>
            </div>
          </div>
        </div>
      )}

      {isNearThreshold && !isAtCap && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <div>
              <p className="font-semibold text-yellow-800">Maintenance Approaching</p>
              <p className="text-sm text-yellow-700">
                Vehicle is approaching maintenance threshold. {remainingKm.toLocaleString()} km remaining until {MILEAGE_CAP.toLocaleString()} km.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mileage History */}
      <div className="mt-6">
        <h4 className="text-md font-semibold text-headingText mb-3">Mileage History</h4>
        {loading ? (
          <div className="text-center py-4">
            <Loader2 className="w-6 h-6 animate-spin text-sidebarActiveBg mx-auto" />
          </div>
        ) : history.length === 0 ? (
          <p className="text-center text-sidebarMuted py-4">No mileage history available</p>
        ) : (
          <Table headers={['Date', 'Mileage', 'Source', 'Recorded By', 'Notes']}>
            {history.map((entry) => (
              <TableRow key={entry._id}>
                <TableCell>{format(new Date(entry.recordedAt), 'MMM dd, yyyy HH:mm')}</TableCell>
                <TableCell className="font-semibold">
                  {entry.mileage.toLocaleString()} km
                </TableCell>
                <TableCell>
                  <span className="px-2 py-1 bg-sidebarMuted/20 rounded text-xs">
                    {entry.source}
                  </span>
                </TableCell>
                <TableCell>{entry.recordedBy.name}</TableCell>
                <TableCell className="text-sm text-sidebarMuted">
                  {entry.notes || '—'}
                </TableCell>
              </TableRow>
            ))}
          </Table>
        )}
      </div>
    </SectionCard>
  )
}


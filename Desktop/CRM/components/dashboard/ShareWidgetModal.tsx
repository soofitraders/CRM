'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

interface ShareWidgetModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (isShared: boolean, sharedWithRoles: string[]) => void
  existingWidget?: {
    isShared: boolean
    sharedWithRoles: string[]
  }
}

const roles = ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'MANAGER', 'SALES_AGENT']

export default function ShareWidgetModal({ isOpen, onClose, onSave, existingWidget }: ShareWidgetModalProps) {
  const [isShared, setIsShared] = useState(existingWidget?.isShared || false)
  const [selectedRoles, setSelectedRoles] = useState<string[]>(existingWidget?.sharedWithRoles || [])

  if (!isOpen) return null

  const handleToggleRole = (role: string) => {
    if (selectedRoles.includes(role)) {
      setSelectedRoles(selectedRoles.filter((r) => r !== role))
    } else {
      setSelectedRoles([...selectedRoles, role])
    }
  }

  const handleSave = () => {
    onSave(isShared, isShared ? selectedRoles : [])
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-cardBg rounded-lg shadow-lg w-full max-w-md m-4">
        <div className="p-6 border-b border-borderSoft flex items-center justify-between">
          <h2 className="text-xl font-semibold text-headingText">Share Widget</h2>
          <button
            onClick={onClose}
            className="text-bodyText hover:text-headingText transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isShared}
                onChange={(e) => setIsShared(e.target.checked)}
                className="w-4 h-4 text-sidebarActiveBg rounded"
              />
              <span className="text-sm font-medium text-bodyText">Share with other users</span>
            </label>
            <p className="text-xs text-sidebarMuted mt-1 ml-6">
              When enabled, this widget will be visible to selected roles
            </p>
          </div>

          {isShared && (
            <div>
              <label className="block text-sm font-medium text-bodyText mb-3">
                Share with Roles
              </label>
              <div className="space-y-2">
                {roles.map((role) => (
                  <label key={role} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(role)}
                      onChange={() => handleToggleRole(role)}
                      className="w-4 h-4 text-sidebarActiveBg rounded"
                    />
                    <span className="text-sm text-bodyText">{role.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
              {selectedRoles.length === 0 && (
                <p className="text-xs text-sidebarMuted mt-2">
                  If no roles are selected, widget will be shared with all users
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-4 pt-4 border-t border-borderSoft">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-cardBg border border-borderSoft rounded-lg text-bodyText hover:bg-sidebarMuted/10"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-sidebarActiveBg text-white rounded-lg hover:opacity-90"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


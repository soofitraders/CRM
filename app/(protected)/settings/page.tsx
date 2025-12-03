'use client'

import { useState, useEffect } from 'react'
import SectionCard from '@/components/ui/SectionCard'
import { getCurrentUser, hasRole } from '@/lib/auth'

interface Settings {
  _id?: string
  companyName: string
  defaultCurrency: string
  timezone: string
  defaultTaxPercent: number
}

interface NotificationPreferences {
  emailNotifications: boolean
  smsNotifications: boolean
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    companyName: 'MisterWheels',
    defaultCurrency: 'AED',
    timezone: 'Asia/Dubai',
    defaultTaxPercent: 5,
  })
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    emailNotifications: true,
    smsNotifications: false,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [isSavingPreferences, setIsSavingPreferences] = useState(false)
  const [userRole, setUserRole] = useState<string>('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetchSettings()
    fetchPreferences()
    fetchUserRole()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings')
      if (response.ok) {
        const data = await response.json()
        setSettings(data.settings)
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchPreferences = async () => {
    try {
      const response = await fetch('/api/users/me/preferences')
      if (response.ok) {
        const data = await response.json()
        setPreferences({
          emailNotifications: data.emailNotifications ?? true,
          smsNotifications: data.smsNotifications ?? false,
        })
      }
    } catch (error) {
      console.error('Error fetching preferences:', error)
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

  const canEditSettings = ['SUPER_ADMIN', 'ADMIN'].includes(userRole)

  const handleSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingSettings(true)
    setMessage(null)

    try {
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'Settings saved successfully' })
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.error || 'Failed to save settings' })
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to save settings' })
    } finally {
      setIsSavingSettings(false)
    }
  }

  const handlePreferencesChange = async (key: keyof NotificationPreferences, value: boolean) => {
    const newPreferences = { ...preferences, [key]: value }
    setPreferences(newPreferences)
    setIsSavingPreferences(true)

    try {
      const response = await fetch('/api/users/me/preferences', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newPreferences),
      })

      if (!response.ok) {
        // Revert on error
        setPreferences(preferences)
        const error = await response.json()
        alert(error.error || 'Failed to update preferences')
      }
    } catch (error: any) {
      // Revert on error
      setPreferences(preferences)
      alert(error.message || 'Failed to update preferences')
    } finally {
      setIsSavingPreferences(false)
    }
  }

  if (isLoading) {
    return <div className="text-center py-8 text-bodyText">Loading settings...</div>
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-headingText">Settings</h1>
        <p className="text-bodyText mt-2">Manage system settings and preferences</p>
      </div>

      {/* Company Settings */}
      <SectionCard title="Company Settings">
        {!canEditSettings && (
          <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-500 text-sm">
            You don&apos;t have permission to edit company settings. Only Administrators can modify these settings.
          </div>
        )}
        <form onSubmit={handleSettingsSubmit} className="space-y-6">
          {message && (
            <div
              className={`p-4 rounded-lg text-sm ${
                message.type === 'success'
                  ? 'bg-green-500/10 border border-green-500/20 text-green-500'
                  : 'bg-red-500/10 border border-red-500/20 text-red-500'
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-headingText mb-2">
                Company Name *
              </label>
              <input
                type="text"
                value={settings.companyName}
                onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                disabled={!canEditSettings}
                required
                className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-headingText mb-2">
                Default Currency *
              </label>
              <input
                type="text"
                value={settings.defaultCurrency}
                onChange={(e) =>
                  setSettings({ ...settings, defaultCurrency: e.target.value.toUpperCase() })
                }
                disabled={!canEditSettings}
                required
                maxLength={3}
                className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-sidebarMuted mt-1">e.g., AED, USD, EUR</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-headingText mb-2">
                Timezone *
              </label>
              <select
                value={settings.timezone}
                onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                disabled={!canEditSettings}
                required
                className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="Asia/Dubai">Asia/Dubai (GMT+4)</option>
                <option value="UTC">UTC (GMT+0)</option>
                <option value="America/New_York">America/New_York (GMT-5)</option>
                <option value="Europe/London">Europe/London (GMT+0)</option>
                <option value="Asia/Singapore">Asia/Singapore (GMT+8)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-headingText mb-2">
                Default Tax Percent *
              </label>
              <input
                type="number"
                value={settings.defaultTaxPercent}
                onChange={(e) =>
                  setSettings({ ...settings, defaultTaxPercent: parseFloat(e.target.value) || 0 })
                }
                disabled={!canEditSettings}
                required
                min={0}
                max={100}
                step={0.1}
                className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-sidebarMuted mt-1">Percentage (0-100)</p>
            </div>
          </div>

          {canEditSettings && (
            <div className="flex justify-end pt-4 border-t border-borderSoft">
              <button
                type="submit"
                disabled={isSavingSettings}
                className="px-4 py-2 bg-sidebarActiveBg text-white rounded-lg font-medium hover:bg-sidebarActiveBg/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingSettings ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          )}
        </form>
      </SectionCard>

      {/* Notification Preferences */}
      <SectionCard title="Notification Preferences">
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-pageBg border border-borderSoft rounded-lg">
            <div>
              <h3 className="font-medium text-headingText">Email Notifications</h3>
              <p className="text-sm text-sidebarMuted">
                Receive email notifications for important system events
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.emailNotifications}
                onChange={(e) =>
                  handlePreferencesChange('emailNotifications', e.target.checked)
                }
                disabled={isSavingPreferences}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-borderSoft peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-sidebarActiveBg/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sidebarActiveBg"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 bg-pageBg border border-borderSoft rounded-lg">
            <div>
              <h3 className="font-medium text-headingText">SMS Notifications</h3>
              <p className="text-sm text-sidebarMuted">
                Receive SMS notifications for urgent updates
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.smsNotifications}
                onChange={(e) => handlePreferencesChange('smsNotifications', e.target.checked)}
                disabled={isSavingPreferences}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-borderSoft peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-sidebarActiveBg/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sidebarActiveBg"></div>
            </label>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}


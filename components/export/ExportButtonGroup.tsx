'use client'

import { useState, useRef, useEffect } from 'react'
import { Download, FileText, FileSpreadsheet, File, ChevronDown } from 'lucide-react'
import { logger } from '@/lib/utils/logger'

export type ExportModule = 'BOOKINGS' | 'INVOICES' | 'CLIENTS' | 'VEHICLES' | 'EXPENSES' | 'PAYMENTS'

interface ExportButtonGroupProps {
  module: ExportModule
  filters: Record<string, any>
}

export default function ExportButtonGroup({ module, filters }: ExportButtonGroupProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    setIsExporting(true)
    setExportError(null)
    setIsOpen(false)

    try {
      // Build query string from filters
      const params = new URLSearchParams({
        format,
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => 
            value !== null && value !== undefined && value !== ''
          )
        ),
      })

      // Determine API endpoint based on module
      const endpoint = `/api/export/${module.toLowerCase()}`
      const url = `${endpoint}?${params.toString()}`

      logger.log('Initiating export:', format)
      logger.log('Export URL:', url)

      // Fetch the export file
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      logger.log('Export response status:', response.status)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `Export failed with status ${response.status}`)
      }

      // Check content type
      const contentType = response.headers.get('content-type')
      logger.log('Response content-type:', contentType)

      const blob = await response.blob()
      logger.log('Blob size:', blob.size, 'bytes')

      if (blob.size === 0) {
        throw new Error('Received empty file')
      }

      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = `export-${Date.now()}.${format === 'excel' ? 'xlsx' : format}`

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i)
        if (filenameMatch) {
          filename = filenameMatch[1]
        }
      }

      // Download file
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()

      // Cleanup
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(a)

      logger.log('Export completed successfully:', filename)
    } catch (error: any) {
      logger.error('Export error:', error)
      logger.error('Error details:', {
        message: error.message,
        stack: error.stack,
      })
      setExportError(error.message || 'Failed to export data')
      alert(`Export failed: ${error.message || 'Unknown error'}`)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex items-center gap-2" ref={dropdownRef}>
      {exportError && (
        <div className="text-red-500 text-sm mr-2">{exportError}</div>
      )}
      <div className="relative">
        <button
          type="button"
          disabled={isExporting}
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-4 py-2 bg-sidebarActiveBg text-white rounded-lg hover:bg-sidebarActiveBg/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>{isExporting ? 'Exporting...' : 'Export'}</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        
        {/* Dropdown menu - Responsive */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-48 max-w-[calc(100vw-24px)] bg-pageBg border border-borderSoft rounded-lg shadow-lg z-50">
            <div className="py-1">
              <button
                type="button"
                onClick={() => handleExport('csv')}
                disabled={isExporting}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-bodyText hover:bg-borderSoft disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <FileText className="w-4 h-4" />
                Export CSV
              </button>
              <button
                type="button"
                onClick={() => handleExport('excel')}
                disabled={isExporting}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-bodyText hover:bg-borderSoft disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Export Excel
              </button>
              <button
                type="button"
                onClick={() => handleExport('pdf')}
                disabled={isExporting}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-bodyText hover:bg-borderSoft disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <File className="w-4 h-4" />
                Export PDF
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


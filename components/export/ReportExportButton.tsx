'use client'

import { useState } from 'react'
import { Download, FileText, FileSpreadsheet, File } from 'lucide-react'
import { logger } from '@/lib/utils/logger'

interface ReportExportButtonProps {
  module: 'revenue' | 'ar' | 'investors' | 'utilization' | 'pnl'
  filters: Record<string, any>
}

export default function ReportExportButton({ module, filters }: ReportExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    setIsExporting(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        format,
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== null && value !== undefined && value !== '')
        ),
      })

      const response = await fetch(`/api/export/reports/${module}?${params.toString()}`)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Export failed' }))
        throw new Error(errorData.error || `Export failed: ${response.statusText}`)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url

      const contentDisposition = response.headers.get('content-disposition')
      let filename = `${module}-report.${format === 'excel' ? 'xlsx' : format}`
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i)
        if (filenameMatch) {
          filename = filenameMatch[1]
        }
      }

      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err: any) {
      logger.error('Export error:', err)
      setError(err.message || 'Export failed. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="relative min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => handleExport('csv')}
          disabled={isExporting}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-cardBg border border-borderSoft rounded-lg text-bodyText hover:bg-sidebarMuted/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          title="Export as CSV"
        >
          <FileText className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm sm:text-base whitespace-nowrap">{isExporting ? 'Exporting...' : 'CSV'}</span>
        </button>
        <button
          onClick={() => handleExport('excel')}
          disabled={isExporting}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-cardBg border border-borderSoft rounded-lg text-bodyText hover:bg-sidebarMuted/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          title="Export as Excel"
        >
          <FileSpreadsheet className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm sm:text-base whitespace-nowrap">{isExporting ? 'Exporting...' : 'Excel'}</span>
        </button>
        <button
          onClick={() => handleExport('pdf')}
          disabled={isExporting}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-cardBg border border-borderSoft rounded-lg text-bodyText hover:bg-sidebarMuted/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          title="Export as PDF"
        >
          <File className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm sm:text-base whitespace-nowrap">{isExporting ? 'Exporting...' : 'PDF'}</span>
        </button>
      </div>
      {error && (
        <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
          {error}
        </div>
      )}
    </div>
  )
}


'use client'

import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  className?: string
}

/**
 * Responsive page header component
 * - Mobile: Title and actions stack vertically
 * - Desktop: Title and actions align horizontally
 */
export default function PageHeader({ title, subtitle, actions, className = '' }: PageHeaderProps) {
  return (
    <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 ${className}`}>
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-headingText break-words">{title}</h1>
        {subtitle && (
          <p className="text-sm sm:text-base text-bodyText mt-1 sm:mt-2 break-words">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 flex-shrink-0">
          {actions}
        </div>
      )}
    </div>
  )
}

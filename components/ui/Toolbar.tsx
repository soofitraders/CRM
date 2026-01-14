'use client'

import { ReactNode } from 'react'

interface ToolbarProps {
  children: ReactNode
  className?: string
}

/**
 * Responsive toolbar component for search/filter/status controls
 * - Mobile: Controls stack vertically, inputs full-width
 * - Desktop: Controls align horizontally, inputs auto-width
 */
export default function Toolbar({ children, className = '' }: ToolbarProps) {
  return (
    <div className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2 w-full sm:w-auto ${className}`}>
      {children}
    </div>
  )
}

interface ToolbarGroupProps {
  children: ReactNode
  className?: string
}

/**
 * Group within toolbar - wraps items that should stay together
 */
export function ToolbarGroup({ children, className = '' }: ToolbarGroupProps) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {children}
    </div>
  )
}

interface ToolbarInputProps {
  children: ReactNode
  className?: string
}

/**
 * Input wrapper in toolbar - ensures proper sizing
 */
export function ToolbarInput({ children, className = '' }: ToolbarInputProps) {
  return (
    <div className={`flex-1 sm:flex-initial min-w-0 ${className}`}>
      {children}
    </div>
  )
}

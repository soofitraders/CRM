import { ReactNode } from 'react'

interface SectionCardProps {
  title?: string
  children: ReactNode
  actions?: ReactNode
  className?: string
}

export default function SectionCard({ title, children, actions, className = '' }: SectionCardProps) {
  return (
    <div className={`bg-cardBg rounded-xl shadow-sm border border-borderSoft min-w-0 ${className}`}>
      {/* Header - Responsive */}
      {(title || actions) && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 px-4 sm:px-6 pt-4 sm:pt-6 pb-4 border-b border-borderSoft/50">
          {title && (
            <h2 className="text-base sm:text-lg font-semibold text-headingText w-full sm:w-auto sm:flex-1" style={{ wordBreak: 'normal', overflowWrap: 'normal', minWidth: 'fit-content' }}>
              {title}
            </h2>
          )}
          {actions && (
            <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2 flex-shrink-0">
              {actions}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className={`${title || actions ? 'p-4 sm:p-6' : 'p-4 sm:p-6'} min-w-0`}>{children}</div>
    </div>
  )
}


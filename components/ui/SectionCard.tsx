import { ReactNode } from 'react'

interface SectionCardProps {
  title?: string
  children: ReactNode
  actions?: ReactNode
  className?: string
}

export default function SectionCard({ title, children, actions, className = '' }: SectionCardProps) {
  return (
    <div className={`bg-cardBg rounded-xl shadow-sm border border-borderSoft ${className}`}>
      {/* Header */}
      {(title || actions) && (
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-borderSoft/50">
          {title && <h2 className="text-lg font-semibold text-headingText">{title}</h2>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}

      {/* Content */}
      <div className={title || actions ? 'p-6' : 'p-6'}>{children}</div>
    </div>
  )
}


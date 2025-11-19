import { ReactNode } from 'react'

interface SectionCardProps {
  title: string
  children: ReactNode
  actions?: ReactNode
}

export default function SectionCard({ title, children, actions }: SectionCardProps) {
  return (
    <div className="bg-cardBg rounded-card shadow-card border border-borderSoft p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-headingText">{title}</h2>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {/* Content */}
      <div>{children}</div>
    </div>
  )
}


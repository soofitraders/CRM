import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  icon: LucideIcon
  value: string | number
  label: string
  subtext?: string
}

export default function StatCard({ icon: Icon, value, label, subtext }: StatCardProps) {
  const display = typeof value === 'number' ? value.toLocaleString() : value
  // Long amounts (e.g. "AED 400,372.77") get a smaller font so they stay inside the card
  const sizeClass =
    display.length > 18 ? 'text-xl' : display.length > 12 ? 'text-2xl' : 'text-3xl'

  return (
    <div className="bg-cardBg rounded-xl shadow-sm border border-borderSoft p-6 hover:shadow-md transition-shadow duration-200 overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-bodyText mb-2">{label}</div>
          <div className={`${sizeClass} font-bold text-headingText mb-1 break-words`}>
            {display}
          </div>
          {subtext && (
            <div className="text-xs text-sidebarMuted mt-2">{subtext}</div>
          )}
        </div>
        
        {/* Icon with yellow background */}
        <div className="w-12 h-12 bg-sidebarActiveBg/10 rounded-xl flex items-center justify-center flex-shrink-0">
          <Icon className="w-6 h-6 text-sidebarActiveBg" />
        </div>
      </div>
    </div>
  )
}


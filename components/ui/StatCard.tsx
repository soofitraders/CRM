import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  icon: LucideIcon
  value: string | number
  label: string
  subtext?: string
}

export default function StatCard({ icon: Icon, value, label, subtext }: StatCardProps) {
  return (
    <div className="bg-cardBg rounded-xl shadow-sm border border-borderSoft p-6 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between">
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-bodyText mb-2">{label}</div>
          <div className="text-3xl font-bold text-headingText mb-1">
            {typeof value === 'number' ? value.toLocaleString() : value}
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


import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  icon: LucideIcon
  value: string | number
  label: string
  subtext?: string
}

export default function StatCard({ icon: Icon, value, label, subtext }: StatCardProps) {
  return (
    <div className="bg-cardBg rounded-card shadow-card border border-borderSoft p-6 flex items-center gap-4">
      {/* Icon with yellow background */}
      <div className="w-14 h-14 bg-sidebarActiveBg rounded-full flex items-center justify-center flex-shrink-0">
        <Icon className="w-7 h-7 text-white" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="text-2xl font-bold text-headingText mb-1">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        <div className="text-sm font-medium text-bodyText">{label}</div>
        {subtext && (
          <div className="text-xs text-sidebarMuted mt-1">{subtext}</div>
        )}
      </div>
    </div>
  )
}


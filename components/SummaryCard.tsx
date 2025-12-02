import { LucideIcon } from 'lucide-react'

interface SummaryCardProps {
  icon: LucideIcon
  value: string | number
  label: string
  trend: string
  iconColor?: string
}

export default function SummaryCard({ icon: Icon, value, label, trend, iconColor = 'text-yellow-500' }: SummaryCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
            <Icon className="w-6 h-6 text-yellow-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{value}</div>
          <div className="text-sm text-gray-600 mb-2">{label}</div>
          <div className="text-xs text-green-600 font-medium">{trend}</div>
        </div>
      </div>
    </div>
  )
}


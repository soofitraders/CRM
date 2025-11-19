interface StatusChipProps {
  status: string
  variant?: 'default' | 'yellow' | 'green' | 'red'
}

export default function StatusChip({ status, variant = 'default' }: StatusChipProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'yellow':
        return 'bg-warning/10 text-warning border-warning/20'
      case 'green':
        return 'bg-success/10 text-success border-success/20'
      case 'red':
        return 'bg-danger/10 text-danger border-danger/20'
      default:
        return 'bg-sidebarMuted/10 text-bodyText border-borderSoft'
    }
  }

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getVariantStyles()}`}
    >
      {status}
    </span>
  )
}


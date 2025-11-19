/**
 * Check if a date is expiring soon based on threshold days
 * @param date - The expiry date to check
 * @param thresholdDays - Number of days before expiry to consider "soon" (default: 30)
 * @returns true if the date expires within the threshold
 */
export function isExpiringSoon(date: Date | string | null | undefined, thresholdDays: number = 30): boolean {
  if (!date) return false
  
  const expiryDate = typeof date === 'string' ? new Date(date) : date
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const diffTime = expiryDate.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  return diffDays >= 0 && diffDays <= thresholdDays
}

/**
 * Calculate the number of days left until a date
 * @param date - The target date
 * @returns Number of days left (negative if past, 0 if today, positive if future)
 */
export function daysLeft(date: Date | string | null | undefined): number {
  if (!date) return 0
  
  const targetDate = typeof date === 'string' ? new Date(date) : date
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  targetDate.setHours(0, 0, 0, 0)
  
  const diffTime = targetDate.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  return diffDays
}

/**
 * Format days left as a human-readable string
 * @param days - Number of days
 * @returns Formatted string (e.g., "5 days", "Today", "Expired")
 */
export function formatDaysLeft(days: number): string {
  if (days < 0) return 'Expired'
  if (days === 0) return 'Today'
  if (days === 1) return '1 day'
  return `${days} days`
}


import { format, isValid, parseISO } from 'date-fns'

/**
 * Safely format a date, handling invalid dates gracefully
 */
export function safeFormatDate(
  date: string | Date | null | undefined,
  formatString: string,
  fallback: string = 'N/A'
): string {
  if (!date) {
    return fallback
  }

  try {
    let dateObj: Date

    if (typeof date === 'string') {
      // Try parsing ISO string first
      dateObj = parseISO(date)
      // If that fails, try regular Date constructor
      if (!isValid(dateObj)) {
        dateObj = new Date(date)
      }
    } else {
      dateObj = date
    }

    // Check if date is valid
    if (!isValid(dateObj) || isNaN(dateObj.getTime())) {
      return fallback
    }

    return format(dateObj, formatString)
  } catch (error) {
    console.warn('Error formatting date:', error, date)
    return fallback
  }
}

/**
 * Safely create a Date object
 */
export function safeDate(date: string | Date | null | undefined): Date | null {
  if (!date) {
    return null
  }

  try {
    let dateObj: Date

    if (typeof date === 'string') {
      dateObj = parseISO(date)
      if (!isValid(dateObj)) {
        dateObj = new Date(date)
      }
    } else {
      dateObj = date
    }

    if (!isValid(dateObj) || isNaN(dateObj.getTime())) {
      return null
    }

    return dateObj
  } catch (error) {
    console.warn('Error creating date:', error, date)
    return null
  }
}


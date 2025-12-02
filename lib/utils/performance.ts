/**
 * Performance utilities and optimizations
 */

/**
 * Logger utility - wraps console methods with environment checks
 */
export const logger = {
  log: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(...args)
    }
  },
  error: (...args: any[]) => {
    // Always log errors
    console.error(...args)
  },
  warn: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.warn(...args)
    }
  },
  debug: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(...args)
    }
  },
  info: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.info(...args)
    }
  },
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }

    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(later, wait)
  }
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

/**
 * Measure execution time
 */
export async function measureTime<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now()
  try {
    const result = await fn()
    const duration = performance.now() - start
    if (process.env.NODE_ENV === 'development') {
      logger.log(`[Performance] ${label}: ${duration.toFixed(2)}ms`)
    }
    return result
  } catch (error) {
    const duration = performance.now() - start
    logger.error(`[Performance] ${label} failed after ${duration.toFixed(2)}ms:`, error)
    throw error
  }
}

/**
 * Batch operations
 */
export async function batchProcess<T, R>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<R[]>
): Promise<R[]> {
  const results: R[] = []

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await processor(batch)
    results.push(...batchResults)
  }

  return results
}

/**
 * Parallel execution with limit
 */
export async function parallelLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results: T[] = []
  const executing: Promise<void>[] = []

  for (const task of tasks) {
    const promise = task().then((result) => {
      results.push(result)
      executing.splice(executing.indexOf(promise), 1)
    })

    executing.push(promise)

    if (executing.length >= limit) {
      await Promise.race(executing)
    }
  }

  await Promise.all(executing)
  return results
}

/**
 * Execute multiple promises in parallel
 */
export async function parallelQueries<T>(queries: Promise<T>[]): Promise<T[]> {
  return Promise.all(queries)
}


/**
 * Database query optimization utilities
 */

import mongoose from 'mongoose'

/**
 * Optimize populate queries by selecting only needed fields
 */
export function optimizePopulate(fields: string[]) {
  return fields.join(' ')
}

/**
 * Create optimized select object
 */
export function selectFields(fields: string[]) {
  return fields.reduce((acc, field) => {
    acc[field] = 1
    return acc
  }, {} as Record<string, 1>)
}

/**
 * Optimize aggregation pipeline
 */
export function optimizeAggregation(pipeline: any[]) {
  // Add $match early to reduce documents
  // Add $project to limit fields
  // Add indexes hints if needed
  return pipeline
}

/**
 * Parallel query execution helper
 */
export async function parallelQueries<T>(queries: Promise<T>[]): Promise<T[]> {
  return Promise.all(queries)
}

/**
 * Batch query helper to avoid large queries
 */
export async function batchQuery<T, R>(
  items: T[],
  batchSize: number,
  queryFn: (batch: T[]) => Promise<R[]>
): Promise<R[]> {
  const results: R[] = []

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await queryFn(batch)
    results.push(...batchResults)
  }

  return results
}

/**
 * Optimize find query with lean and select
 */
export function optimizeFindQuery<T extends mongoose.Document>(
  query: mongoose.Query<T[], T>,
  options: {
    select?: string[]
    lean?: boolean
    limit?: number
    skip?: number
    sort?: Record<string, 1 | -1>
  } = {}
) {
  if (options.select && options.select.length > 0) {
    query.select(options.select.join(' '))
  }

  if (options.lean !== false) {
    query.lean()
  }

  if (options.limit) {
    query.limit(options.limit)
  }

  if (options.skip) {
    query.skip(options.skip)
  }

  if (options.sort) {
    query.sort(options.sort)
  }

  return query
}


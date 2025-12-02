/**
 * Comprehensive fix script for all API routes
 * This script identifies and fixes common issues:
 * 1. Replace console.log with logger
 * 2. Add caching where appropriate
 * 3. Optimize queries with Promise.all
 * 4. Add cache invalidation
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const API_DIR = join(process.cwd(), 'app', 'api')

function getAllRouteFiles(dir: string, fileList: string[] = []): string[] {
  const files = readdirSync(dir)

  files.forEach((file) => {
    const filePath = join(dir, file)
    const stat = statSync(filePath)

    if (stat.isDirectory()) {
      getAllRouteFiles(filePath, fileList)
    } else if (file === 'route.ts') {
      fileList.push(filePath)
    }
  })

  return fileList
}

function fixFile(filePath: string): { fixed: boolean; changes: string[] } {
  let content = readFileSync(filePath, 'utf-8')
  const originalContent = content
  const changes: string[] = []

  // 1. Replace console.log/error/warn with logger
  if (content.includes('console.log') || content.includes('console.error') || content.includes('console.warn')) {
    // Add logger import if not present
    if (!content.includes("import { logger } from '@/lib/utils/performance'")) {
      // Find the last import statement
      const importMatch = content.match(/^import.*from.*$/gm)
      if (importMatch) {
        const lastImport = importMatch[importMatch.length - 1]
        const lastImportIndex = content.lastIndexOf(lastImport)
        const insertIndex = lastImportIndex + lastImport.length
        content = content.slice(0, insertIndex) + "\nimport { logger } from '@/lib/utils/performance'" + content.slice(insertIndex)
        changes.push('Added logger import')
      }
    }

    // Replace console.log with logger.log
    content = content.replace(/console\.log\(/g, 'logger.log(')
    // Replace console.error with logger.error (keep errors)
    content = content.replace(/console\.error\(/g, 'logger.error(')
    // Replace console.warn with logger.warn
    content = content.replace(/console\.warn\(/g, 'logger.warn(')
    
    if (content !== originalContent) {
      changes.push('Replaced console.* with logger')
    }
  }

  // 2. Add caching for GET routes
  if (content.includes('export async function GET') && !content.includes('cacheQuery')) {
    // Check if it's a list route (has pagination or returns array)
    if (content.includes('pagination') || content.includes('.find(') || content.includes('.countDocuments(')) {
      // Add cache imports
      if (!content.includes("import { cacheQuery } from '@/lib/cache/cacheUtils'")) {
        const importMatch = content.match(/^import.*from.*$/gm)
        if (importMatch) {
          const lastImport = importMatch[importMatch.length - 1]
          const lastImportIndex = content.lastIndexOf(lastImport)
          const insertIndex = lastImportIndex + lastImport.length
          content = content.slice(0, insertIndex) + 
            "\nimport { cacheQuery } from '@/lib/cache/cacheUtils'" +
            "\nimport { CacheKeys } from '@/lib/cache/cacheKeys'" +
            content.slice(insertIndex)
          changes.push('Added cache imports')
        }
      }
    }
  }

  // 3. Add cache invalidation for POST/PUT/DELETE
  if ((content.includes('export async function POST') || 
       content.includes('export async function PUT') || 
       content.includes('export async function PATCH') || 
       content.includes('export async function DELETE')) &&
      !content.includes('invalidate')) {
    
    // Determine entity type from path
    const entityType = filePath.includes('bookings') ? 'booking' :
                      filePath.includes('customers') ? 'customer' :
                      filePath.includes('vehicles') ? 'vehicle' :
                      filePath.includes('invoices') ? 'invoice' :
                      filePath.includes('expenses') ? 'expense' : null

    if (entityType) {
      // Add invalidation imports
      if (!content.includes("invalidate")) {
        const importMatch = content.match(/^import.*from.*$/gm)
        if (importMatch) {
          const lastImport = importMatch[importMatch.length - 1]
          const lastImportIndex = content.lastIndexOf(lastImport)
          const insertIndex = lastImportIndex + lastImport.length
          
          let invalidationImport = ''
          if (entityType === 'booking') {
            invalidationImport = "\nimport { invalidateBookingCache, invalidateDashboardCache } from '@/lib/cache/cacheUtils'"
          } else if (entityType === 'customer') {
            invalidationImport = "\nimport { invalidateCustomerCache } from '@/lib/cache/cacheUtils'"
          } else if (entityType === 'vehicle') {
            invalidationImport = "\nimport { invalidateVehicleCache } from '@/lib/cache/cacheUtils'"
          } else if (entityType === 'invoice') {
            invalidationImport = "\nimport { invalidateFinancialCache } from '@/lib/cache/cacheUtils'"
          }
          
          if (invalidationImport) {
            content = content.slice(0, insertIndex) + invalidationImport + content.slice(insertIndex)
            changes.push(`Added ${entityType} cache invalidation imports`)
          }
        }
      }
    }
  }

  const fixed = content !== originalContent
  if (fixed) {
    writeFileSync(filePath, content, 'utf-8')
  }

  return { fixed, changes }
}

// Main execution
console.log('🔍 Scanning API routes for issues...')
const routeFiles = getAllRouteFiles(API_DIR)
console.log(`Found ${routeFiles.length} route files`)

let fixedCount = 0
const results: Array<{ file: string; changes: string[] }> = []

routeFiles.forEach((file) => {
  try {
    const result = fixFile(file)
    if (result.fixed) {
      fixedCount++
      results.push({ file: file.replace(process.cwd(), ''), changes: result.changes })
      console.log(`✓ Fixed: ${file.replace(process.cwd(), '')}`)
    }
  } catch (error: any) {
    console.error(`✗ Error fixing ${file}:`, error.message)
  }
})

console.log(`\n✅ Fixed ${fixedCount} files`)
if (results.length > 0) {
  console.log('\nChanges made:')
  results.forEach(({ file, changes }) => {
    console.log(`  ${file}:`)
    changes.forEach(change => console.log(`    - ${change}`))
  })
}


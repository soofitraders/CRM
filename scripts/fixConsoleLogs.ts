/**
 * Script to replace all console.log/error/warn with logger utility
 * Run with: npx tsx scripts/fixConsoleLogs.ts
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const API_DIR = join(process.cwd(), 'app', 'api')
const COMPONENTS_DIR = join(process.cwd(), 'components')
const LIB_DIR = join(process.cwd(), 'lib')

function getAllFiles(dir: string, extensions: string[] = ['.ts', '.tsx'], fileList: string[] = []): string[] {
  if (!require('fs').existsSync(dir)) {
    return fileList
  }

  const files = readdirSync(dir)

  files.forEach((file) => {
    const filePath = join(dir, file)
    const stat = statSync(filePath)

    if (stat.isDirectory() && !filePath.includes('node_modules') && !filePath.includes('.next')) {
      getAllFiles(filePath, extensions, fileList)
    } else if (extensions.some(ext => file.endsWith(ext))) {
      fileList.push(filePath)
    }
  })

  return fileList
}

function fixFile(filePath: string): { fixed: boolean; changes: string[] } {
  let content = readFileSync(filePath, 'utf-8')
  const originalContent = content
  const changes: string[] = []

  // Check if file uses console.*
  if (!content.includes('console.log') && 
      !content.includes('console.error') && 
      !content.includes('console.warn')) {
    return { fixed: false, changes: [] }
  }

  // Add logger import if not present
  if (!content.includes("import { logger } from '@/lib/utils/performance'") &&
      !content.includes("import { logger } from '../lib/utils/performance'") &&
      !content.includes("import { logger } from '../../lib/utils/performance'")) {
    
    // Calculate relative path to lib/utils/performance
    const relativePath = filePath.includes('app/api') 
      ? '@/lib/utils/performance'
      : filePath.includes('components')
      ? '@/lib/utils/performance'
      : '../utils/performance'

    // Find the last import statement
    const importLines = content.match(/^import.*from.*$/gm)
    if (importLines && importLines.length > 0) {
      const lastImport = importLines[importLines.length - 1]
      const lastImportIndex = content.lastIndexOf(lastImport)
      const insertIndex = lastImportIndex + lastImport.length
      content = content.slice(0, insertIndex) + `\nimport { logger } from '${relativePath}'` + content.slice(insertIndex)
      changes.push('Added logger import')
    }
  }

  // Replace console.log with logger.log
  if (content.includes('console.log')) {
    content = content.replace(/console\.log\(/g, 'logger.log(')
    changes.push('Replaced console.log with logger.log')
  }

  // Replace console.error with logger.error (keep errors)
  if (content.includes('console.error')) {
    content = content.replace(/console\.error\(/g, 'logger.error(')
    changes.push('Replaced console.error with logger.error')
  }

  // Replace console.warn with logger.warn
  if (content.includes('console.warn')) {
    content = content.replace(/console\.warn\(/g, 'logger.warn(')
    changes.push('Replaced console.warn with logger.warn')
  }

  const fixed = content !== originalContent
  if (fixed) {
    writeFileSync(filePath, content, 'utf-8')
  }

  return { fixed, changes }
}

// Main execution
console.log('🔍 Scanning files for console.* usage...')

const apiFiles = getAllFiles(API_DIR)
const componentFiles = getAllFiles(COMPONENTS_DIR)
const libFiles = getAllFiles(LIB_DIR, ['.ts'])

const allFiles = [...apiFiles, ...componentFiles, ...libFiles]
console.log(`Found ${allFiles.length} files to check`)

let fixedCount = 0
const results: Array<{ file: string; changes: string[] }> = []

allFiles.forEach((file) => {
  try {
    const result = fixFile(file)
    if (result.fixed) {
      fixedCount++
      results.push({ file: file.replace(process.cwd(), ''), changes: result.changes })
    }
  } catch (error: any) {
    console.error(`✗ Error fixing ${file}:`, error.message)
  }
})

console.log(`\n✅ Fixed ${fixedCount} files`)
if (results.length > 0) {
  console.log('\nSummary:')
  results.slice(0, 20).forEach(({ file, changes }) => {
    console.log(`  ${file}: ${changes.join(', ')}`)
  })
  if (results.length > 20) {
    console.log(`  ... and ${results.length - 20} more files`)
  }
}


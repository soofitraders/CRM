/**
 * Fix logger imports in client components
 * Run with: npx tsx scripts/fixClientLoggerImports.ts
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const COMPONENTS_DIR = join(process.cwd(), 'components')

function getAllFiles(dir: string, fileList: string[] = []): string[] {
  if (!require('fs').existsSync(dir)) {
    return fileList
  }

  const files = readdirSync(dir)

  files.forEach((file) => {
    const filePath = join(dir, file)
    const stat = statSync(filePath)

    if (stat.isDirectory() && !filePath.includes('node_modules') && !filePath.includes('.next')) {
      getAllFiles(filePath, fileList)
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      fileList.push(filePath)
    }
  })

  return fileList
}

function fixFile(filePath: string): boolean {
  let content = readFileSync(filePath, 'utf-8')
  const originalContent = content

  // Check if it's a client component
  if (!content.includes("'use client'") && !content.includes('"use client"')) {
    return false
  }

  // Replace logger import from performance to logger
  content = content.replace(
    /from ['"]@\/lib\/utils\/performance['"]/g,
    "from '@/lib/utils/logger'"
  )

  const fixed = content !== originalContent
  if (fixed) {
    writeFileSync(filePath, content, 'utf-8')
  }

  return fixed
}

// Main execution
console.log('🔍 Fixing logger imports in client components...')

const componentFiles = getAllFiles(COMPONENTS_DIR)
console.log(`Found ${componentFiles.length} files to check`)

let fixedCount = 0

componentFiles.forEach((file) => {
  try {
    if (fixFile(file)) {
      fixedCount++
      console.log(`✓ Fixed: ${file.replace(process.cwd(), '')}`)
    }
  } catch (error: any) {
    console.error(`✗ Error fixing ${file}:`, error.message)
  }
})

console.log(`\n✅ Fixed ${fixedCount} files`)


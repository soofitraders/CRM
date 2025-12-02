/**
 * Fix logger import paths in lib directory
 * Run with: npx tsx scripts/fixLibLoggerImports.ts
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const LIB_DIR = join(process.cwd(), 'lib')

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
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      fileList.push(filePath)
    }
  })

  return fileList
}

function fixFile(filePath: string): boolean {
  let content = readFileSync(filePath, 'utf-8')
  const originalContent = content

  // Replace incorrect relative imports with absolute imports
  content = content.replace(
    /from ['"]\.\.\/utils\/performance['"]/g,
    "from '@/lib/utils/performance'"
  )

  const fixed = content !== originalContent
  if (fixed) {
    writeFileSync(filePath, content, 'utf-8')
  }

  return fixed
}

// Main execution
console.log('🔍 Fixing logger import paths in lib directory...')

const libFiles = getAllFiles(LIB_DIR)
console.log(`Found ${libFiles.length} files to check`)

let fixedCount = 0

libFiles.forEach((file) => {
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


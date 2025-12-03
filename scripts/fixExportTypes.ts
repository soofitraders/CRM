import { readFileSync, writeFileSync } from 'fs'
import { glob } from 'glob'

const files = glob.sync('app/api/export/**/*.ts')

files.forEach((file) => {
  let content = readFileSync(file, 'utf-8')
  let modified = false

  // Fix exportToCSV
  if (content.includes('exportToCSV(exportData, columns)')) {
    content = content.replace(/exportToCSV\(exportData,\s*columns\)/g, 'exportToCSV(exportData as any, columns as any)')
    modified = true
  }

  // Fix exportToExcel
  if (content.includes('exportToExcel(exportData, columns)')) {
    content = content.replace(/exportToExcel\(exportData,\s*columns\)/g, 'exportToExcel(exportData as any, columns as any)')
    modified = true
  }

  // Fix exportToPDF
  const pdfRegex = /exportToPDF\(([^,]+),\s*exportData,\s*columns\)/g
  if (pdfRegex.test(content)) {
    content = content.replace(pdfRegex, 'exportToPDF($1, exportData as any, columns as any)')
    modified = true
  }

  if (modified) {
    writeFileSync(file, content, 'utf-8')
    console.log(`Fixed: ${file}`)
  }
})

console.log('Done!')


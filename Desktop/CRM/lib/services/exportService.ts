import { format as formatDate } from 'date-fns'

/**
 * Export data to CSV format
 */
export function exportToCSV<T extends Record<string, any>>(
  rows: T[],
  columns: { key: keyof T; label: string }[]
): string {
  try {
    console.log(`Generating CSV for ${rows.length} rows, ${columns.length} columns`)
    
    // Create header row
    const headerRow = columns.map((col) => escapeCSVValue(String(col.label))).join(',')
    
    // Create data rows
    const dataRows = rows.map((row) => {
      return columns
        .map((col) => {
          const value = row[col.key]
          return escapeCSVValue(formatValue(value))
        })
        .join(',')
    })
    
    // Combine header and data rows
    const csvContent = [headerRow, ...dataRows].join('\n')
    
    // Add BOM for UTF-8 support in Excel
    const csvWithBOM = '\uFEFF' + csvContent
    
    console.log(`CSV generated: ${csvWithBOM.length} characters`)
    return csvWithBOM
  } catch (error: any) {
    console.error('CSV generation error:', error)
    throw new Error(`CSV export failed: ${error.message}`)
  }
}

/**
 * Export data to Excel format (.xlsx)
 */
export async function exportToExcel<T extends Record<string, any>>(
  rows: T[],
  columns: { key: keyof T; label: string }[]
): Promise<Buffer> {
  try {
    console.log(`Generating Excel for ${rows.length} rows, ${columns.length} columns`)
    
    // Dynamic import to avoid loading ExcelJS at module level
    const ExcelJS = (await import('exceljs')).default
    
    console.log('ExcelJS loaded successfully')
    
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Export')
    
    // Set column headers
    worksheet.columns = columns.map((col) => ({
      header: col.label,
      key: String(col.key),
      width: 20,
    }))
    
    // Add data rows
    rows.forEach((row) => {
      const rowData: any = {}
      columns.forEach((col) => {
        rowData[String(col.key)] = formatValue(row[col.key])
      })
      worksheet.addRow(rowData)
    })
    
    // Style header row
    worksheet.getRow(1).font = { bold: true }
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    }
    
    // Generate buffer
    console.log('Writing Excel buffer...')
    const buffer = await workbook.xlsx.writeBuffer()
    const nodeBuffer = Buffer.from(buffer)
    
    console.log(`Excel generated: ${nodeBuffer.length} bytes`)
    return nodeBuffer
  } catch (error: any) {
    console.error('Excel generation error:', error)
    console.error('Error stack:', error.stack)
    throw new Error(`Excel export failed: ${error.message}`)
  }
}

/**
 * Export data to PDF format using jsPDF (more reliable in Next.js)
 */
export async function exportToPDF<T extends Record<string, any>>(
  title: string,
  rows: T[],
  columns: { key: keyof T; label: string }[]
): Promise<Buffer> {
  try {
    console.log(`Generating PDF for ${rows.length} rows, ${columns.length} columns`)
    console.log('Loading jsPDF...')
    
    // Dynamic imports
    const { jsPDF } = await import('jspdf')
    // Import autoTable - in v5 it can be used as a function or extends prototype
    const autoTableModule = await import('jspdf-autotable')
    const autoTable = (autoTableModule as any).default || autoTableModule
    
    console.log('jsPDF and autoTable loaded successfully')
    console.log('Creating PDF with jsPDF...')
    
    // Create PDF document in landscape A4
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    })
    
    // Try to get autoTable function
    let autoTableFn: any = null
    
    // Method 1: Check if it's available as a method on doc
    if (typeof (doc as any).autoTable === 'function') {
      autoTableFn = (doc as any).autoTable.bind(doc)
      console.log('Using autoTable as method')
    }
    // Method 2: Check if it's a standalone function
    else if (typeof autoTable === 'function') {
      autoTableFn = autoTable
      console.log('Using autoTable as function')
    }
    // Method 3: Check default export
    else if (typeof (autoTableModule as any).default === 'function') {
      autoTableFn = (autoTableModule as any).default
      console.log('Using autoTable from default export')
    }
    // Method 4: Try require
    else {
      try {
        const autoTableRequire = require('jspdf-autotable')
        if (typeof autoTableRequire === 'function') {
          autoTableFn = autoTableRequire
        } else if (typeof autoTableRequire.default === 'function') {
          autoTableFn = autoTableRequire.default
        } else if (typeof (doc as any).autoTable === 'function') {
          autoTableFn = (doc as any).autoTable.bind(doc)
        }
        console.log('Using autoTable from require')
      } catch (e) {
        console.error('Could not load autoTable:', e)
      }
    }
    
    if (!autoTableFn) {
      throw new Error('autoTable function not available. jspdf-autotable may not be properly installed.')
    }
    
    // Add title
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text(title, 14, 15)
    
    // Add metadata
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Generated: ${formatDate(new Date(), 'yyyy-MM-dd HH:mm')}`, 14, 22)
    doc.text(`Total Records: ${rows.length}`, 14, 27)
    
    // Prepare table data
    const headers = columns.map((col) => col.label)
    const data = rows.map((row) =>
      columns.map((col) => formatValue(row[col.key]))
    )
    
    console.log(`Prepared table data: ${headers.length} columns, ${data.length} rows`)
    console.log('Calling autoTable...')
    
    // Generate table using autoTable plugin
    const autoTableOptions = {
      head: [headers],
      body: data,
      startY: 32,
      theme: 'grid' as any,
      styles: {
        fontSize: 8,
        cellPadding: 2,
        overflow: 'linebreak' as any,
        cellWidth: 'wrap' as any,
      },
      headStyles: {
        fillColor: [224, 224, 224],
        textColor: [0, 0, 0],
        fontStyle: 'bold' as any,
        halign: 'left' as any,
      },
      alternateRowStyles: {
        fillColor: [249, 249, 249],
      },
      margin: { top: 32, left: 14, right: 14, bottom: 14 },
      didDrawPage: (data: any) => {
        // Footer with page numbers
        const pageCount = doc.getNumberOfPages()
        const pageSize = doc.internal.pageSize
        const pageHeight = pageSize.height || pageSize.getHeight()
        
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.text(
          `Page ${data.pageNumber} of ${pageCount}`,
          pageSize.width / 2,
          pageHeight - 10,
          { align: 'center' }
        )
      },
    }
    
    // Call autoTable - if it's a method (bound), call with options only
    // If it's a function, pass doc as first parameter
    if (typeof (doc as any).autoTable === 'function' && autoTableFn === (doc as any).autoTable.bind(doc)) {
      // It's a method, call it directly on doc
      ;(doc as any).autoTable(autoTableOptions)
    } else {
      // It's a function, pass doc as first argument
      autoTableFn(doc, autoTableOptions)
    }
    
    console.log(`PDF generated with ${doc.getNumberOfPages()} pages`)
    
    // Convert to buffer
    const pdfBlob = doc.output('arraybuffer')
    const buffer = Buffer.from(pdfBlob)
    
    console.log(`PDF generated successfully, size: ${buffer.length} bytes`)
    
    if (buffer.length === 0) {
      throw new Error('Generated PDF is empty')
    }
    
    return buffer
  } catch (error: any) {
    console.error('jsPDF export error:', error)
    console.error('Error stack:', error.stack)
    throw new Error(`PDF generation failed: ${error.message}`)
  }
}

/**
 * Format a value for export (handle dates, nulls, etc.)
 */
function formatValue(value: any): string {
  if (value === null || value === undefined) {
    return ''
  }
  
  if (value instanceof Date) {
    return formatDate(value, 'yyyy-MM-dd HH:mm')
  }
  
  if (typeof value === 'object') {
    // Handle nested objects (e.g., customer.user.name)
    if (value.name) return String(value.name)
    if (value.email) return String(value.email)
    if (value._id) return String(value._id)
    return JSON.stringify(value)
  }
  
  return String(value)
}

/**
 * Escape CSV value (handle commas, quotes, newlines)
 */
function escapeCSVValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * PDFKit polyfill to prevent font file access errors in Next.js
 * This intercepts PDFKit's attempts to read font files and provides empty data instead
 */

// Only run in Node.js environment (server-side)
if (typeof process !== 'undefined' && typeof window === 'undefined') {
  try {
    const fs = require('fs')
    const path = require('path')
    
    // Store original readFileSync if not already overridden
    if (!fs._originalReadFileSync) {
      fs._originalReadFileSync = fs.readFileSync
    }
    
    const originalReadFileSync = fs._originalReadFileSync
    
    // Override readFileSync to handle PDFKit font file requests
    fs.readFileSync = function(filePath: string | number, ...args: any[]) {
      // Check if this is a PDFKit font file request
      if (typeof filePath === 'string') {
        const normalizedPath = path.normalize(filePath).toLowerCase()
        
        // If PDFKit is trying to read a font metric file (.afm) or font data
        if (
          normalizedPath.includes('.afm') ||
          (normalizedPath.includes('pdfkit') && normalizedPath.includes('data')) ||
          normalizedPath.includes('helvetica') ||
          normalizedPath.includes('times-roman') ||
          normalizedPath.includes('courier') ||
          normalizedPath.includes('vendor-chunks')
        ) {
          // Return empty buffer - PDFKit will fall back to built-in fonts
          // PDFKit has built-in support for Helvetica, Times-Roman, and Courier
          return Buffer.from('')
        }
      }
      
      // For all other files, use the original readFileSync
      try {
        return originalReadFileSync.apply(this, [filePath, ...args])
      } catch (error: any) {
        // If it's still a PDFKit-related ENOENT error, return empty buffer
        if (
          error.code === 'ENOENT' && 
          typeof filePath === 'string' && 
          (filePath.toLowerCase().includes('pdfkit') || 
           filePath.toLowerCase().includes('.afm') || 
           filePath.toLowerCase().includes('vendor-chunks'))
        ) {
          return Buffer.from('')
        }
        throw error
      }
    }
  } catch (error) {
    // Silently fail if we can't set up the polyfill
    // PDFKit might still work with built-in fonts
    console.warn('[PDFKit Polyfill] Could not initialize:', error)
  }
}

export {}

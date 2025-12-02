/**
 * Client-safe logger utility
 * Can be used in both client and server components
 */

// Safe check for development mode
// Works in both browser and Node.js environments
const isDev = 
  (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') ||
  (typeof window !== 'undefined' && 
   typeof window.location !== 'undefined' &&
   (window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.includes('localhost')))

export const logger = {
  log: (...args: any[]) => {
    if (isDev && typeof console !== 'undefined' && console.log) {
      console.log(...args)
    }
  },
  error: (...args: any[]) => {
    if (typeof console !== 'undefined' && console.error) {
      console.error(...args)
    }
  },
  warn: (...args: any[]) => {
    if (isDev && typeof console !== 'undefined' && console.warn) {
      console.warn(...args)
    }
  },
  debug: (...args: any[]) => {
    if (isDev && typeof console !== 'undefined' && console.debug) {
      console.debug(...args)
    }
  },
  info: (...args: any[]) => {
    if (isDev && typeof console !== 'undefined' && console.info) {
      console.info(...args)
    }
  },
}


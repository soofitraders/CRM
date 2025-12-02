/**
 * Start script for Render - uses Next.js standalone build
 * This ensures the standalone server binds to the correct port and hostname
 */

const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

const standalonePath = path.join(__dirname, '.next', 'standalone')
const serverPath = path.join(standalonePath, 'server.js')

// Check if standalone build exists
if (!fs.existsSync(serverPath)) {
  console.error('Error: Standalone build not found.')
  console.error('Expected path:', serverPath)
  console.error('Please ensure "npm run build" completed successfully.')
  process.exit(1)
}

// Get PORT from environment (Render provides this automatically)
const port = process.env.PORT || 3000

// Ensure PORT is set in environment
process.env.PORT = port.toString()
process.env.HOSTNAME = '0.0.0.0'

console.log('='.repeat(60))
console.log('Starting Next.js Standalone Server for Render')
console.log('='.repeat(60))
console.log(`PORT: ${port}`)
console.log(`HOSTNAME: 0.0.0.0`)
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'production'}`)
console.log(`Standalone path: ${standalonePath}`)
console.log('='.repeat(60))

// Change to standalone directory
process.chdir(standalonePath)

// Start the standalone server
// Next.js standalone server automatically uses PORT env variable
const server = spawn('node', ['server.js'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: port.toString(),
    HOSTNAME: '0.0.0.0',
    NODE_ENV: process.env.NODE_ENV || 'production',
  },
  cwd: standalonePath,
})

server.on('error', (err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})

server.on('exit', (code, signal) => {
  if (code !== null) {
    console.log(`Server exited with code ${code}`)
  }
  if (signal !== null) {
    console.log(`Server exited with signal ${signal}`)
  }
  process.exit(code || 0)
})

// Handle termination signals
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...')
  server.kill('SIGTERM')
})

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...')
  server.kill('SIGINT')
})

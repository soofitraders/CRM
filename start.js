/**
 * Start script for Render - uses Next.js standalone build
 * This is the recommended approach for production deployments
 */

const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

const standalonePath = path.join(__dirname, '.next', 'standalone')
const serverPath = path.join(standalonePath, 'server.js')

// Check if standalone build exists
if (!fs.existsSync(serverPath)) {
  console.error('Error: Standalone build not found. Please run "npm run build" first.')
  console.error('Expected path:', serverPath)
  process.exit(1)
}

// Get PORT from environment (Render provides this)
const port = process.env.PORT || 3000
process.env.PORT = port.toString()

console.log('='.repeat(60))
console.log('Starting Next.js Standalone Server')
console.log('='.repeat(60))
console.log(`PORT: ${port}`)
console.log(`Standalone path: ${standalonePath}`)
console.log('='.repeat(60))

// Change to standalone directory
process.chdir(standalonePath)

// Start the server
const server = spawn('node', ['server.js'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: port.toString(),
    NODE_ENV: 'production',
  },
})

server.on('error', (err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})

server.on('exit', (code) => {
  process.exit(code || 0)
})


/**
 * Custom server for Render - ensures proper port binding
 * This server explicitly binds to 0.0.0.0 and the PORT env variable
 */

const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')

// Get port - Render provides this via environment variable
const port = parseInt(process.env.PORT || '3000', 10)
const hostname = '0.0.0.0' // Must bind to 0.0.0.0 for Render

console.log('='.repeat(50))
console.log('[Server] Initializing...')
console.log(`[Server] PORT: ${port}`)
console.log(`[Server] HOSTNAME: ${hostname}`)
console.log(`[Server] NODE_ENV: ${process.env.NODE_ENV || 'production'}`)
console.log('='.repeat(50))

// Initialize Next.js in production mode
const app = next({
  dev: false,
  hostname,
  port,
  dir: __dirname,
})

const handle = app.getRequestHandler()

// Prepare and start server
app
  .prepare()
  .then(() => {
    console.log('[Server] Next.js prepared successfully')
    
    const server = createServer((req, res) => {
      const parsedUrl = parse(req.url, true)
      handle(req, res, parsedUrl).catch((err) => {
        console.error('[Server] Request error:', err)
        res.statusCode = 500
        res.end('Internal Server Error')
      })
    })

    // Bind to port and hostname
    server.listen(port, hostname, () => {
      console.log('='.repeat(50))
      console.log(`[Server] ✓ SERVER STARTED SUCCESSFULLY`)
      console.log(`[Server] ✓ Listening on http://${hostname}:${port}`)
      console.log(`[Server] ✓ Port ${port} is OPEN and ready for connections`)
      console.log('='.repeat(50))
    })

    // Error handling
    server.on('error', (err) => {
      console.error('[Server] ✗ Server error:', err)
      if (err.code === 'EADDRINUSE') {
        console.error(`[Server] ✗ Port ${port} is already in use`)
      }
      process.exit(1)
    })

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('[Server] SIGTERM received, shutting down...')
      server.close(() => {
        console.log('[Server] Server closed')
        process.exit(0)
      })
    })
  })
  .catch((err) => {
    console.error('[Server] ✗ Failed to prepare Next.js:', err)
    console.error('[Server] Error details:', err.stack)
    process.exit(1)
  })

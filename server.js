/**
 * Server entry point for Render deployment
 * Explicitly binds to PORT environment variable on 0.0.0.0
 */

const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')

// Get port from environment (Render provides this)
const port = parseInt(process.env.PORT, 10) || 3000
const hostname = '0.0.0.0' // Bind to all interfaces

console.log(`[Server] Initializing Next.js application...`)
console.log(`[Server] Port: ${port}`)
console.log(`[Server] Hostname: ${hostname}`)
console.log(`[Server] NODE_ENV: ${process.env.NODE_ENV || 'development'}`)

const app = next({
  dev: process.env.NODE_ENV !== 'production',
  hostname,
  port,
})

const handle = app.getRequestHandler()

// Start the server
app.prepare()
  .then(() => {
    console.log(`[Server] Next.js app prepared successfully`)
    
    const server = createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true)
        await handle(req, res, parsedUrl)
      } catch (err) {
        console.error('[Server] Error handling request:', err)
        res.statusCode = 500
        res.end('internal server error')
      }
    })

    // Listen on the port
    server.listen(port, hostname, () => {
      console.log(`[Server] ✓ Server is ready`)
      console.log(`[Server] ✓ Listening on http://${hostname}:${port}`)
      console.log(`[Server] ✓ Port ${port} is now open and accessible`)
    })

    // Handle server errors
    server.on('error', (err) => {
      console.error('[Server] ✗ Server error:', err)
      if (err.code === 'EADDRINUSE') {
        console.error(`[Server] ✗ Port ${port} is already in use`)
      }
      process.exit(1)
    })

    // Handle process termination
    process.on('SIGTERM', () => {
      console.log('[Server] SIGTERM received, shutting down gracefully')
      server.close(() => {
        console.log('[Server] Server closed')
        process.exit(0)
      })
    })
  })
  .catch((err) => {
    console.error('[Server] ✗ Failed to prepare Next.js app:', err)
    process.exit(1)
  })

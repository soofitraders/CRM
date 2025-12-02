/**
 * Server entry point for Render deployment
 * Uses Next.js production server with explicit port binding
 */

// Ensure PORT is set (Render provides this)
const port = process.env.PORT || 3000
const hostname = '0.0.0.0'

// Set NODE_ENV to production if not set (Render should set this, but ensure it)
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production'
}

console.log(`[Server] Starting Next.js server...`)
console.log(`[Server] PORT: ${port}`)
console.log(`[Server] HOSTNAME: ${hostname}`)
console.log(`[Server] NODE_ENV: ${process.env.NODE_ENV}`)

// Use Next.js built-in production server
// This is more reliable than custom server for Render
const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')

const app = next({
  dev: false, // Always use production mode on Render
  hostname,
  port: parseInt(port, 10),
})

const handle = app.getRequestHandler()

app.prepare()
  .then(() => {
    console.log(`[Server] Next.js app prepared`)
    
    const server = createServer((req, res) => {
      const parsedUrl = parse(req.url, true)
      handle(req, res, parsedUrl)
    })

    server.listen(parseInt(port, 10), hostname, (err) => {
      if (err) {
        console.error('[Server] Failed to start:', err)
        process.exit(1)
      }
      console.log(`[Server] ✓ Server started successfully`)
      console.log(`[Server] ✓ Listening on http://${hostname}:${port}`)
      console.log(`[Server] ✓ Ready to accept connections`)
    })

    server.on('error', (err) => {
      console.error('[Server] Server error:', err)
      process.exit(1)
    })
  })
  .catch((err) => {
    console.error('[Server] Failed to prepare app:', err)
    process.exit(1)
  })

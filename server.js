/**
 * Custom server for Render deployment
 * Handles both standalone and regular Next.js builds
 * Ensures proper PORT binding for Render
 */

const port = process.env.PORT || 3000
const hostname = '0.0.0.0'

// Check if we're using standalone build
const fs = require('fs')
const path = require('path')
const standalonePath = path.join(__dirname, '.next/standalone')
const serverPath = path.join(standalonePath, 'server.js')

if (fs.existsSync(serverPath)) {
  // Use standalone server - change directory and set PORT
  process.chdir(standalonePath)
  process.env.PORT = port
  require('./server.js')
} else {
  // Use regular Next.js server
  const { createServer } = require('http')
  const { parse } = require('url')
  const next = require('next')

  const dev = process.env.NODE_ENV !== 'production'
  const app = next({ dev, hostname, port })
  const handle = app.getRequestHandler()

  app.prepare().then(() => {
    createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true)
        await handle(req, res, parsedUrl)
      } catch (err) {
        console.error('Error occurred handling', req.url, err)
        res.statusCode = 500
        res.end('internal server error')
      }
    }).listen(port, hostname, (err) => {
      if (err) throw err
      console.log(`> Ready on http://${hostname}:${port}`)
    })
  })
}

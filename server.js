/**
 * Server entry point for Render deployment
 * Works with Next.js standalone builds
 */

const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')

const port = parseInt(process.env.PORT || '3000', 10)
const hostname = '0.0.0.0'

console.log(`Starting server on ${hostname}:${port}`)

const app = next({
  dev: false,
  hostname,
  port,
})

const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  server.listen(port, hostname, () => {
    console.log(`> Server ready on http://${hostname}:${port}`)
    console.log(`> Environment: ${process.env.NODE_ENV || 'development'}`)
  })

  server.on('error', (err) => {
    console.error('Server error:', err)
    process.exit(1)
  })
})

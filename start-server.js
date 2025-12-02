/**
 * Simple server wrapper that ensures PORT is used correctly
 * This file ensures the server binds to the correct port for Render
 */

// Set PORT explicitly before requiring next
const port = process.env.PORT || 3000
process.env.PORT = port.toString()

// Use Next.js built-in start command
// This is the most reliable way for Render
require('next/dist/server/next-server.js')


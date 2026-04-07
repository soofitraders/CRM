/**
 * Server-only checks: logs clear messages for developers when required env vars are missing.
 * Does not print secret values — only verifies presence.
 */
const MONGO_KEYS = ['MONGODB_URI', 'DATABASE_URL', 'MONGODB_URL'] as const

const REQUIRED_FOR_AUTH = [
  { key: 'NEXTAUTH_SECRET', hint: 'Generate a value (e.g. openssl rand -base64 32) and set NEXTAUTH_SECRET in .env.local' },
  { key: 'NEXTAUTH_URL', hint: 'Set NEXTAUTH_URL in .env.local (e.g. http://localhost:3000 for local dev)' },
] as const

let loggedOnce = false

export function logRequiredServerEnv(): void {
  if (typeof window !== 'undefined') return
  if (loggedOnce) return
  loggedOnce = true

  for (const { key, hint } of REQUIRED_FOR_AUTH) {
    if (!process.env[key]?.trim()) {
      console.error(`[ENV] Missing ${key}. ${hint}`)
    }
  }

  const hasMongoUri = MONGO_KEYS.some((k) => process.env[k]?.trim())
  if (!hasMongoUri) {
    console.error(
      '[ENV] MongoDB URI not found. Set MONGODB_URI in .env.local (or DATABASE_URL / MONGODB_URL as fallback).'
    )
  }
}

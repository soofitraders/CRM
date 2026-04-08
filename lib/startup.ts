import { cache } from '@/lib/cache'

let purgeInterval: ReturnType<typeof setInterval> | null = null

export function startAutoPurge() {
  if (purgeInterval) return

  purgeInterval = setInterval(() => {
    const purged = cache.purgeExpired()
    if (purged > 0) console.log(`[CACHE AUTO-PURGE] Removed ${purged} expired entries`)
  }, 5 * 60 * 1000)

  console.log('[CACHE] Auto-purge started — runs every 5 minutes')
}

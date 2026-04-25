import { Request, Response, NextFunction } from 'express'

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()
const WINDOW_MS = 60 * 1000
const MAX_REQUESTS = 100

setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) {
      store.delete(key)
    }
  }
}, WINDOW_MS)

export const rateLimitMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const key = (req.headers['x-api-key'] as string) || req.ip || 'unknown'
  const now = Date.now()

  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return next()
  }

  if (entry.count >= MAX_REQUESTS) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    res.setHeader('Retry-After', retryAfter)
    return res.status(429).json({
      message: 'Too Many Requests',
      statusCode: 429,
      retryAfter,
    })
  }

  entry.count++
  next()
}
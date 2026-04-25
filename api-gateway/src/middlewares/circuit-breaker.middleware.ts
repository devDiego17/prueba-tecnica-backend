import { Request, Response, NextFunction } from 'express'

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

let state: CircuitState = 'CLOSED'
let failureCount = 0
let openedAt: number | null = null
let halfOpenProbeInFlight = false

const FAILURE_THRESHOLD = 5
const RESET_TIMEOUT = 30000

export const recordSuccess = () => {
  failureCount = 0
  state = 'CLOSED'
  halfOpenProbeInFlight = false
}

export const recordFailure = () => {
  failureCount++
  if (state === 'HALF_OPEN') {
    state = 'OPEN'
    openedAt = Date.now()
    halfOpenProbeInFlight = false
  } else if (failureCount >= FAILURE_THRESHOLD) {
    state = 'OPEN'
    openedAt = Date.now()
  }
}

export const circuitBreakerMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (state === 'CLOSED') {
    return next()
  }

  if (state === 'OPEN') {
    const now = Date.now()
    if (openedAt && now - openedAt >= RESET_TIMEOUT) {
      state = 'HALF_OPEN'
    } else {
      return res.status(503).json({ message: 'Servicio temporalmente no disponible', statusCode: 503 })
    }
  }

  if (state === 'HALF_OPEN') {
    if (halfOpenProbeInFlight) {
      return res.status(503).json({ message: 'Servicio temporalmente no disponible', statusCode: 503 })
    }
    halfOpenProbeInFlight = true
    return next()
  }
}

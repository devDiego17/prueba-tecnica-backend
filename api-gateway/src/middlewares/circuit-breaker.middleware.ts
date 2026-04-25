import { Response } from 'express'

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

interface CircuitBreaker {
  state: CircuitState
  failureCount: number
  openedAt: number | null
  halfOpenProbeInFlight: boolean
}

const FAILURE_THRESHOLD = 5
const RESET_TIMEOUT = 30_000

const breakers = new Map<string, CircuitBreaker>()

function getBreaker(target: string): CircuitBreaker {
  if (!breakers.has(target)) {
    breakers.set(target, { state: 'CLOSED', failureCount: 0, openedAt: null, halfOpenProbeInFlight: false })
  }
  return breakers.get(target)!
}

export function recordSuccess(target: string) {
  const cb = getBreaker(target)
  if (cb.state !== 'CLOSED') {
    console.info(`[circuit-breaker] ${target} → CLOSED`)
  }
  cb.state = 'CLOSED'
  cb.failureCount = 0
  cb.halfOpenProbeInFlight = false
}

export function recordFailure(target: string) {
  const cb = getBreaker(target)
  cb.failureCount++

  if (cb.state === 'HALF_OPEN') {
    cb.state = 'OPEN'
    cb.openedAt = Date.now()
    cb.halfOpenProbeInFlight = false
    console.warn(`[circuit-breaker] ${target} → OPEN (probe fallida)`)
  } else if (cb.failureCount >= FAILURE_THRESHOLD) {
    cb.state = 'OPEN'
    cb.openedAt = Date.now()
    console.warn(`[circuit-breaker] ${target} → OPEN (${cb.failureCount} fallos consecutivos)`)
  }
}

export function checkBreaker(target: string, res: Response): boolean {
  const cb = getBreaker(target)

  if (cb.state === 'CLOSED') return true

  if (cb.state === 'OPEN') {
    if (cb.openedAt && Date.now() - cb.openedAt >= RESET_TIMEOUT) {
      cb.state = 'HALF_OPEN'
      console.info(`[circuit-breaker] ${target} → HALF_OPEN`)
    } else {
      res.status(503).json({ message: 'Servicio temporalmente no disponible', statusCode: 503 })
      return false
    }
  }

  if (cb.state === 'HALF_OPEN') {
    if (cb.halfOpenProbeInFlight) {
      res.status(503).json({ message: 'Servicio temporalmente no disponible', statusCode: 503 })
      return false
    }
    cb.halfOpenProbeInFlight = true
    return true
  }

  return true
}

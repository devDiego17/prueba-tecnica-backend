import express, { Request, Response } from 'express'
import axios from 'axios'
import { loggerMiddleware } from './middlewares/logger.middleware'
import { authMiddleware } from './middlewares/auth.middleware'
import { rateLimitMiddleware } from './middlewares/rate-limit.middleware'
import { checkBreaker, recordSuccess, recordFailure } from './middlewares/circuit-breaker.middleware'

const app = express()
const PORT = process.env.PORT || 3000
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3001'
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3002'

const ALLOWED_HEADERS = ['content-type', 'x-api-key', 'authorization']

app.use(express.json())
app.use(loggerMiddleware)

app.get('/api/v1/health', async (_req: Request, res: Response) => {
  const [paymentResult, notificationResult] = await Promise.allSettled([
    axios.get(`${PAYMENT_SERVICE_URL}/health`, { timeout: 3000 }),
    axios.get(`${NOTIFICATION_SERVICE_URL}/health`, { timeout: 3000 }),
  ])

  const extract = (result: PromiseSettledResult<any>, name: string) => {
    if (result.status === 'fulfilled') {
      const { status, database, uptime } = result.value.data
      return { status, database, uptime }
    }
    console.warn(`[health] ${name} no responde: ${result.reason?.message ?? 'timeout'}`)
    return { status: 'error', database: 'unknown', uptime: 0 }
  }

  const payment = extract(paymentResult, 'payment-service')
  const notification = extract(notificationResult, 'notification-service')
  const allOk = payment.status === 'ok' && notification.status === 'ok'

  res.json({
    status: allOk ? 'ok' : 'degraded',
    services: {
      'payment-service': payment,
      'notification-service': notification,
    },
    timestamp: new Date().toISOString(),
  })
})

app.use(rateLimitMiddleware)
app.use(authMiddleware)

const proxy = async (req: Request, res: Response, targetBaseUrl: string) => {
  if (!checkBreaker(targetBaseUrl, res)) return

  const forwardedHeaders: Record<string, string> = {}
  for (const header of ALLOWED_HEADERS) {
    const value = req.headers[header]
    if (value) forwardedHeaders[header] = value as string
  }

  try {
    const response = await axios({
      method: req.method,
      url: `${targetBaseUrl}${req.path}`,
      data: req.body,
      headers: forwardedHeaders,
      params: req.query,
      timeout: 5000,
      validateStatus: () => true,
    })

    if (response.status >= 500) {
      recordFailure(targetBaseUrl)
    } else {
      recordSuccess(targetBaseUrl)
    }

    res.status(response.status).json(response.data)
  } catch (error: any) {
    recordFailure(targetBaseUrl)
    res.status(502).json({ message: 'Servicio no disponible', statusCode: 502 })
  }
}

app.all('/api/v1/notifications/*path', (req: Request, res: Response) => {
  proxy(req, res, NOTIFICATION_SERVICE_URL)
})

app.all('/api/v1/*path', (req: Request, res: Response) => {
  proxy(req, res, PAYMENT_SERVICE_URL)
})

app.use((req: Request, res: Response) => {
  res.status(404).json({ message: `Ruta no encontrada: ${req.method} ${req.url}`, statusCode: 404 })
})

app.listen(PORT, () => {
  console.log(`API Gateway corriendo en puerto ${PORT}`)
})

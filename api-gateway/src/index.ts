import express, { Request, Response } from 'express'
import axios from 'axios'
import { loggerMiddleware } from './middlewares/logger.middleware'
import { authMiddleware } from './middlewares/auth.middleware'
import { rateLimitMiddleware } from './middlewares/rate-limit.middleware'
import { circuitBreakerMiddleware, recordSuccess, recordFailure } from './middlewares/circuit-breaker.middleware'

const app = express()
const PORT = process.env.PORT || 3000
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3001'

app.use((req, _res, next) => {
  console.log(`[RAW] ${req.method} ${req.url}`)
  next()
})

app.use(express.json())
app.use(loggerMiddleware)
app.use(rateLimitMiddleware)
app.use(authMiddleware)
app.use(circuitBreakerMiddleware)

app.all('/api/v1/*path', async (req: Request, res: Response) => {
  const targetPath = '/' + req.params['path']
  const url = `${PAYMENT_SERVICE_URL}${targetPath}`

  try {
    const response = await axios({
      method: req.method,
      url,
      data: req.body,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': req.headers['x-api-key'] || '',
        'authorization': req.headers['authorization'] || '',
      },
      params: req.query,
      timeout: 5000,
      validateStatus: () => true,
    })

    if (response.status >= 500) {
      recordFailure()
    } else {
      recordSuccess()
    }

    res.status(response.status).json(response.data)
  } catch (error: any) {
    recordFailure()
    res.status(502).json({ message: 'Servicio no disponible', statusCode: 502 })
  }
})

app.use((req: Request, res: Response) => {
  res.status(404).json({ message: `Ruta no encontrada: ${req.method} ${req.url}`, statusCode: 404 })
})

app.listen(PORT, () => {
  console.log(`API Gateway corriendo en puerto ${PORT}`)
})
import express, { Request, Response } from 'express'
import axios from 'axios'
import { loggerMiddleware } from './middlewares/logger.middleware'
import { authMiddleware } from './middlewares/auth.middleware'
import { rateLimitMiddleware } from './middlewares/rate-limit.middleware'

const app = express()
const PORT = process.env.PORT || 3000
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3001'

app.use(express.json())
app.use(loggerMiddleware)
app.use(rateLimitMiddleware)
app.use(authMiddleware)

const proxyRequest = async (req: Request, res: Response) => {
  try {
    const url = `${PAYMENT_SERVICE_URL}${req.path}`
    console.log(`Proxying to: ${url}`)
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
    })
    res.status(response.status).json(response.data)
  } catch (error: any) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data)
    } else {
      console.error('Proxy error:', error.message)
      res.status(502).json({ message: 'Servicio no disponible', statusCode: 502 })
    }
  }
}

app.use('/api/v1', (req: Request, res: Response) => proxyRequest(req, res))

app.listen(PORT, () => {
  console.log(`API Gateway corriendo en puerto ${PORT}`)
})
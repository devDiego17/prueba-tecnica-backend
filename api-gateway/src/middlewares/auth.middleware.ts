import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'PRUEBA_TECNICA_SECRET_KEY'

// Los API keys son UUID v4 generados al crear el merchant
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization']
  const apiKey = req.headers['x-api-key'] as string | undefined

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1]
    try {
      const payload = jwt.verify(token, JWT_SECRET)
      ;(req as any).user = payload
      return next()
    } catch (err) {
      console.warn('[auth] Token invalido:', err instanceof Error ? err.message : String(err))
      return res.status(401).json({ message: 'Token invalido', statusCode: 401 })
    }
  }

  if (apiKey) {
    if (!UUID_REGEX.test(apiKey)) {
      return res.status(401).json({ message: 'API key invalida', statusCode: 401 })
    }
    return next()
  }

  return res.status(401).json({ message: 'Autenticacion requerida', statusCode: 401 })
}

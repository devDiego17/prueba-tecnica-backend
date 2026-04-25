import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

const JWT_SECRET = 'PRUEBA_TECNICA_SECRET_KEY'

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization']
  const apiKey = req.headers['x-api-key']

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1]
    try {
      const payload = jwt.verify(token, JWT_SECRET)
      ;(req as any).user = payload
      return next()
    } catch {
      return res.status(401).json({ message: 'Token invalido', statusCode: 401 })
    }
  }

  if (apiKey) {
    return next()
  }

  return res.status(401).json({ message: 'Autenticacion requerida', statusCode: 401 })
}
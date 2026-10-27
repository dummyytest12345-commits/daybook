import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { unauthorized } from '../utils/httpError.js'

export const signToken = (userId) => jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: env.jwtExpiresIn })

/** Returns the user id inside a valid token, or throws 401. */
export function verifyToken(token) {
  try {
    return jwt.verify(token, env.jwtSecret).sub
  } catch {
    throw unauthorized('Invalid or expired token')
  }
}

/** Requires `Authorization: Bearer <token>`; sets req.userId. */
export function requireAuth(req, _res, next) {
  const header = req.headers.authorization || ''
  const [scheme, token] = header.split(' ')
  if (scheme !== 'Bearer' || !token) throw unauthorized()
  req.userId = verifyToken(token)
  next()
}

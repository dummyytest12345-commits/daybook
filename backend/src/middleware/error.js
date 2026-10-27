import { env } from '../config/env.js'
import { HttpError } from '../utils/httpError.js'

export const notFoundHandler = (req, _res, next) => next(new HttpError(404, `Route ${req.method} ${req.originalUrl} not found`))

/** One JSON error shape for everything: { error: { message, details? } }. */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let status = err.status || 500
  let message = err.message || 'Server error'
  let details = err.details

  if (err.name === 'ValidationError' && err.errors) {
    status = 400
    message = 'Validation failed'
    details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }))
  } else if (err.name === 'CastError') {
    status = 400
    message = `Invalid ${err.path}`
  } else if (err.code === 11000) {
    status = 409
    message = `Duplicate value: ${Object.keys(err.keyPattern || {}).join(', ') || 'unique field'} already exists`
  } else if (err.type === 'entity.parse.failed') {
    status = 400
    message = 'Request body is not valid JSON'
  } else if (err.type === 'entity.too.large') {
    status = 413
    message = 'Request body is too large'
  }

  if (status >= 500) {
    console.error(`[${req.method} ${req.originalUrl}]`, err)
    if (env.isProd) message = 'Server error'
  }
  res.status(status).json({ error: { message, ...(details ? { details } : {}) } })
}

import { badRequest } from '../utils/httpError.js'

/**
 * Validate req.body / req.query / req.params with zod schemas, replacing them with the parsed values.
 *   router.post('/', validate({ body: schema }), handler)
 */
export const validate = (schemas) => (req, _res, next) => {
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue
    const res = schemas[part].safeParse(req[part] ?? {})
    if (!res.success) {
      throw badRequest('Validation failed', res.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })))
    }
    // Express 5 makes req.query read-only, so keep parsed values in req.valid
    req.valid = { ...(req.valid || {}), [part]: res.data }
    if (part === 'body') req.body = res.data
  }
  next()
}

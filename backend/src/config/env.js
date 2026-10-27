import 'dotenv/config'

const isTest = process.env.NODE_ENV === 'test'

const required = (name) => {
  const v = process.env[name]
  if (!v) throw new Error(`Missing environment variable ${name}. Copy .env.example to .env and fill it in.`)
  return v
}

/** Validated configuration. Secrets come only from the environment, never from source code. */
export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  isTest,
  port: Number(process.env.PORT) || 4000,
  mongoUri: isTest ? process.env.MONGODB_URI || '' : required('MONGODB_URI'),
  jwtSecret: isTest ? process.env.JWT_SECRET || 'test-secret-test-secret-test-secret' : required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  appUrl: (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, ''),
  mailFrom: process.env.MAIL_FROM || 'Daybook <no-reply@daybook.app>',
  smtp: { host: process.env.SMTP_HOST || '', port: Number(process.env.SMTP_PORT) || 587, user: process.env.SMTP_USER || '', pass: process.env.SMTP_PASS || '' },
  clientOrigins: (process.env.CLIENT_ORIGINS || 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean),
}

if (!isTest && env.jwtSecret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters long.')
if (!isTest && /localhost|127\.0\.0\.1/.test(env.mongoUri)) {
  throw new Error('MONGODB_URI points at a local database. Use your MongoDB Atlas connection string.')
}

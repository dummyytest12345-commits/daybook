import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import nodemailer from 'nodemailer'
import { env } from '../config/env.js'

const OUTBOX_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../outbox')

/** Emails "sent" while no SMTP server is configured (also used by tests). */
export const outbox = []

let transport = null
const smtpConfigured = () => !!env.smtp.host
const getTransport = () =>
  (transport ||= nodemailer.createTransport({
    host: env.smtp.host, port: env.smtp.port, secure: env.smtp.port === 465,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
  }))

/**
 * Send an email. With SMTP_HOST set it goes through that server; otherwise it is written to
 * backend/outbox/ as .html and .txt so you can open it in a browser (and kept in `outbox` for tests).
 * Never throws: the API call that triggered it must not fail because mail is down.
 * Returns { sent: boolean, mode: 'smtp' | 'outbox', error?: string }.
 */
export async function sendMail({ to, subject, html, text }) {
  const message = { from: env.mailFrom, to, subject, html, text }
  if (smtpConfigured()) {
    try {
      await getTransport().sendMail(message)
      return { sent: true, mode: 'smtp' }
    } catch (err) {
      console.error('Email failed:', err.message)
      return { sent: false, mode: 'smtp', error: err.message }
    }
  }
  outbox.push({ ...message, at: new Date() })
  if (outbox.length > 200) outbox.shift()
  if (!env.isTest) {
    try {
      fs.mkdirSync(OUTBOX_DIR, { recursive: true })
      const base = `${Date.now()}-${to.replace(/[^a-z0-9]+/gi, '_')}`
      fs.writeFileSync(path.join(OUTBOX_DIR, `${base}.html`), html)
      fs.writeFileSync(path.join(OUTBOX_DIR, `${base}.txt`), `To: ${to}\nSubject: ${subject}\n\n${text}`)
      console.log(`[email] SMTP not configured. Saved "${subject}" for ${to} in backend/outbox/${base}.html`)
    } catch (err) {
      return { sent: false, mode: 'outbox', error: err.message }
    }
  }
  return { sent: true, mode: 'outbox' }
}

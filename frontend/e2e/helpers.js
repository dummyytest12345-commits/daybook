import { expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

export const API = 'http://localhost:4100'
export const OUTBOX = path.resolve(import.meta.dirname, '../../backend/outbox')

export async function signUp(page, name = 'Test User', email = `t${Date.now()}${Math.floor(Math.random() * 1e4)}@example.com`, password = 'Passw0rd!x') {
  await page.goto('/register')
  await page.getByLabel('Full name').fill(name)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Confirm password').fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('heading', { name: /good (morning|afternoon|evening)/i })).toBeVisible()
  return { email, password, name }
}

/** Newest email written to backend/outbox for an address (the API runs without SMTP in e2e). */
export async function latestMailTo(email, { timeout = 8000 } = {}) {
  const key = email.replace(/[^a-z0-9]+/gi, '_')
  const end = Date.now() + timeout
  while (Date.now() < end) {
    const files = fs.existsSync(OUTBOX) ? fs.readdirSync(OUTBOX).filter((f) => f.includes(key) && f.endsWith('.html')).sort() : []
    if (files.length) {
      const base = files.at(-1).replace(/\.html$/, '')
      return { html: fs.readFileSync(path.join(OUTBOX, `${base}.html`), 'utf8'), text: fs.readFileSync(path.join(OUTBOX, `${base}.txt`), 'utf8') }
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`no email for ${email}`)
}

export async function apiRegister(request, name, email, password = 'Passw0rd!x') {
  const r = await request.post(`${API}/api/auth/register`, { data: { name, email, password } })
  expect(r.status()).toBe(201)
  return r.json()
}

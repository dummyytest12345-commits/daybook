import { expect, test } from '@playwright/test'
import { API, signUp } from './helpers.js'

const cloudToken = (page) =>
  page.evaluate(() => {
    const k = Object.keys(localStorage).find((x) => x.startsWith('daybook:cloud:'))
    return k ? JSON.parse(localStorage.getItem(k)).token : null
  })

const serverTasks = async (request, token) => {
  const r = await request.get(`${API}/api/sync/summary`, { headers: { Authorization: `Bearer ${token}` } })
  expect(r.ok()).toBeTruthy()
  return (await r.json()).taskIds
}

test('offline: banner, edits kept on the device, uploaded after reconnecting', async ({ page, context, request }) => {
  await signUp(page, 'Offline Olive')
  await page.goto('/')
  await page.goto('/today')
  const token = await cloudToken(page)
  expect(token).toBeTruthy()

  await context.setOffline(true)
  await page.evaluate(() => window.dispatchEvent(new Event('offline')))
  await expect(page.getByText('You’re offline.')).toBeVisible()

  await page.getByLabel('Quick add task').fill('Written while offline')
  await page.keyboard.press('Enter')
  await expect(page.getByText('Written while offline').first()).toBeVisible()

  await context.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect(page.getByText('You’re back online.')).toBeVisible()
  await expect.poll(async () => (await serverTasks(request, token)).length, { timeout: 20000 }).toBeGreaterThanOrEqual(1)
})

test('expired session on reconnect: signed out and sent to the landing page', async ({ page }) => {
  await signUp(page, 'Expired Eve')
  await page.goto('/today')
  await page.evaluate(() => {
    const k = Object.keys(localStorage).find((x) => x.startsWith('daybook:cloud:'))
    const v = JSON.parse(localStorage.getItem(k))
    localStorage.setItem(k, JSON.stringify({ ...v, token: 'invalid.token.value' }))
  })
  await page.reload() // the engine verifies the session on start and finds it rejected
  await expect(page).toHaveURL(/\/$/, { timeout: 20000 })
})

import { expect, test } from '@playwright/test'
import { signUp } from './helpers.js'

test('add task -> change status -> persists -> export csv -> pages render', async ({ page }) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  await signUp(page)

  // quick add with parsing
  await page.getByLabel('Quick add task').fill('Fix login bug 2h #consent !high')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByText('Fix login bug').first()).toBeVisible()

  // change status inline
  await page.getByRole('button', { name: /^Status: Pending/ }).first().click()
  await page.getByRole('menuitem', { name: 'Completed' }).click()
  await expect(page.getByRole('button', { name: /^Status: Completed/ }).first()).toBeVisible()

  // survives a refresh
  await page.waitForTimeout(600)
  await page.reload()
  await expect(page.getByText('Fix login bug').first()).toBeVisible()
  await expect(page.getByRole('button', { name: /^Status: Completed/ }).first()).toBeVisible()

  // all views
  for (const v of ['week', 'month', 'board', 'table', 'day']) {
    await page.goto(`/log/${v}`)
    await expect(page.getByRole('tab', { name: new RegExp(v, 'i') })).toHaveAttribute('aria-selected', 'true')
  }
  await page.goto('/log/table')
  await expect(page.getByText('Fix login bug').first()).toBeVisible()

  // analytics + settings + data render
  await page.goto('/analytics')
  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible()
  await expect(page.getByText('Status split')).toBeVisible()
  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await page.goto('/data')
  await expect(page.getByText('Import tasks')).toBeVisible()

  // CSV export
  await page.goto('/reports?range=today')
  await page.getByLabel('Format').selectOption('csv')
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download', exact: true }).click()])
  expect(dl.suggestedFilename()).toMatch(/daybook_.*\.csv/)

  expect(errors, errors.join('\n')).toHaveLength(0)
})

test('excel and pdf exports download and are valid files', async ({ page }) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await signUp(page)
  await page.getByLabel('Quick add task').fill('Write report 1h')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await page.waitForTimeout(600)
  await page.goto('/reports?range=thisWeek')
  for (const [fmt, ext, magic] of [['xlsx', 'xlsx', 'PK'], ['pdf', 'pdf', '%PDF']]) {
    await page.getByLabel('Format').selectOption(fmt)
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.getByRole('button', { name: 'Download', exact: true }).click()])
    expect(dl.suggestedFilename().endsWith('.' + ext)).toBe(true)
    const path = await dl.path()
    const head = (await import('node:fs')).readFileSync(path).subarray(0, 4).toString('latin1')
    expect(head.startsWith(magic)).toBe(true)
  }
  expect(errors, errors.join('\n')).toHaveLength(0)
})

test('auth guard, per-user data separation, sign out / in, SEO meta', async ({ page }) => {
  // signed out: private pages redirect to login; login page is indexable
  await page.goto('/analytics')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page).toHaveTitle(/Sign in/)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /^index/)
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /Daybook/)

  const alice = await signUp(page, 'Alice Tester')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  await page.getByLabel('Quick add task').fill('Alice private task')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByText('Alice private task').first()).toBeVisible()
  await page.waitForTimeout(500)

  // sign out -> guard again
  await page.getByRole('button', { name: /Account menu/ }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.goto('/')
  await expect(page).toHaveURL(/localhost:4173\/$/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('work diary') // signed-out home is the landing page

  // a second user sees none of Alice's data
  await signUp(page, 'Bob Tester')
  await expect(page.getByText('Alice private task')).toHaveCount(0)
  await page.goto('/log/table')
  await expect(page.getByText('Alice private task')).toHaveCount(0)
  await page.getByRole('button', { name: /Account menu/ }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()

  // wrong password rejected, right password restores Alice's own data
  await page.getByLabel('Email').fill(alice.email)
  await page.getByLabel('Password', { exact: true }).fill('wrong-Pass1')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toContainText('Incorrect email or password')
  await page.getByLabel('Password', { exact: true }).fill(alice.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText('Alice private task').first()).toBeVisible()
})

test('projects: create, add tasks, move between projects, WIP limit, archive, delete keeps tasks', async ({ page }) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await signUp(page, 'Proj Tester')

  // a task logged before any project exists stays valid
  await page.getByLabel('Quick add task').fill('Personal task')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByText('Personal task').first()).toBeVisible()

  // create a project
  await page.goto('/projects')
  await expect(page.getByRole('heading', { name: 'No projects yet' })).toBeVisible()
  await page.getByRole('button', { name: 'Create your first project' }).click()
  await page.getByLabel('Name *').fill('Website Redesign')
  await expect(page.getByLabel('Key *')).toHaveValue('WR')
  await page.getByRole('button', { name: 'Create project' }).click()
  await expect(page.getByRole('heading', { name: /Website Redesign/ })).toBeVisible()

  // add tasks inside the project -> WR-1, WR-2
  await page.getByRole('tab', { name: /^List/ }).click()
  await page.getByLabel('Quick add task').fill('Design hero section 2h')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await page.getByLabel('Quick add task').fill('Build footer')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByText('WR-1').first()).toBeVisible()
  await expect(page.getByText('WR-2').first()).toBeVisible()

  // board with a WIP limit
  await page.getByRole('tab', { name: 'Board' }).click()
  await page.getByRole('button', { name: 'Set WIP limit for Pending' }).click()
  await page.getByRole('spinbutton', { name: /WIP limit for Pending/ }).fill('1')
  await page.keyboard.press('Enter')
  await expect(page.getByText('Over limit')).toBeVisible()

  // move the personal task into the project from the Log table with bulk move
  await page.goto('/log/table')
  await page.getByRole('button', { name: 'By task' }).click()
  await page.goto('/log/day')
  await page.getByLabel('Select Personal task').check()
  await page.getByRole('button', { name: 'Move to project…' }).click()
  await page.getByRole('radio', { name: /Website Redesign/ }).click()
  await page.getByRole('button', { name: 'Move', exact: true }).click()
  await expect(page.getByText('WR-3').first()).toBeVisible()

  // filter by project in the URL
  await page.goto('/log/day?project=none')
  await expect(page.getByText('Personal task')).toHaveCount(0)

  // archive hides from list, restore brings back
  await page.goto('/projects')
  await page.getByRole('button', { name: 'Actions for Website Redesign' }).click()
  await page.getByRole('menuitem', { name: 'Archive' }).click()
  await expect(page.getByRole('heading', { name: 'Website Redesign' })).toHaveCount(0)
  await page.getByLabel(/Show archived/).check()
  await expect(page.getByRole('link', { name: 'Website Redesign' })).toBeVisible()

  // delete project but keep tasks
  await page.getByRole('button', { name: 'Actions for Website Redesign' }).click()
  await page.getByRole('menuitem', { name: 'Delete…' }).click()
  await page.getByRole('button', { name: 'Delete project' }).click()
  await page.goto('/log/day')
  await expect(page.getByText('Personal task').first()).toBeVisible()
  expect(errors, errors.join('\n')).toHaveLength(0)
})

test('landing page: SEO, structured data, 3D canvas, CTAs; signed-in home is Today', async ({ page }) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page).toHaveTitle(/Daybook/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('work diary')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /^index/)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/$/)
  // FAQ + SoftwareApplication structured data are injected and parse as JSON
  const types = await page.$$eval('script[type="application/ld+json"][data-seo="page"]', (els) => els.map((e) => JSON.parse(e.textContent)['@type']))
  expect(types).toEqual(expect.arrayContaining(['FAQPage', 'SoftwareApplication', 'WebSite']))
  // one h1, sections have headings, 3D scene present (canvas) or fallback
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  await expect(page.locator('#features h2')).toBeVisible()
  await expect(page.locator('[role="img"][aria-label*="3D"]').first()).toBeVisible()
  // FAQ opens
  await page.locator('#faq summary').first().click()
  await expect(page.locator('#faq details[open]')).toHaveCount(1)
  // CTA goes to register; signed-in "/" becomes the app
  await page.getByRole('link', { name: 'Start logging free' }).click()
  await expect(page).toHaveURL(/\/register$/)
  await signUp(page, 'Landing Tester')
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /good (morning|afternoon|evening)/i })).toBeVisible()
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  expect(errors, errors.join('\n')).toHaveLength(0)
})

test('reduced motion: landing renders a still frame without errors', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.locator('#features h2')).toBeVisible()
  expect(errors).toHaveLength(0)
  await ctx.close()
})

test('carry forward: auto-forward as a thread, update, complete later (earlier days resolved), remove, finish on another day', async ({ page }) => {
  const day = new Date().getDay()
  test.skip(day === 0 || day === 6, 'carry forward only runs on working days')
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await signUp(page, 'Thread Tester')

  // three tasks logged "yesterday" and never completed
  const y = new Date(Date.now() - 864e5)
  const yISO = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`
  await page.goto(`/log/day?d=${yISO}`)
  for (const t of ['Wire up API', 'Forgot to tick', 'Finished it earlier']) {
    await page.getByLabel('Quick add task').fill(t)
    await page.keyboard.press('Enter')
  }
  await page.waitForTimeout(600)

  // reopening the app carries them to today
  await page.goto('/')
  const carried = page.getByRole('region', { name: /Carried forward/ }).or(page.getByText(/Carried forward \(3\)/))
  await expect(carried.first()).toBeVisible()
  await expect(page.getByText('Wire up API').first()).toBeVisible()
  // idempotent: another reload does not duplicate
  await page.reload()
  await expect(page.getByText(/Carried forward \(3\)/)).toBeVisible()

  // open the thread, add an update
  await page.getByRole('button', { name: /Open thread/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Thread' })).toBeVisible()
  await expect(page.getByText('Carried forward automatically')).toBeVisible()
  await page.getByLabel('Thread update').fill('Waiting on the design review')
  await page.getByRole('button', { name: 'Send update' }).click()
  await expect(page.getByText('Waiting on the design review')).toBeVisible()
  await page.keyboard.press('Escape')

  // complete today's copy -> yesterday is marked completed too
  await page.getByRole('button', { name: 'Done' }).first().click()
  await expect(page.getByText(/1 earlier day marked completed/)).toBeVisible()

  // remove one from today -> it never comes back
  await page.getByRole('button', { name: 'Remove from today' }).first().click()
  await page.waitForTimeout(500)
  await page.reload()
  await expect(page.getByText(/Carried forward \(1\)/)).toBeVisible()

  // "finished earlier" completes the remaining thread on yesterday and drops today's copy
  await page.getByRole('button', { name: 'Finished earlier…' }).click()
  await expect(page.getByRole('heading', { name: 'When was this finished?' })).toBeVisible()
  await page.getByRole('group', { name: 'Quick dates' }).getByRole('button').first().click()
  await page.getByRole('button', { name: 'Mark completed' }).click()
  await expect(page.getByText(/Carried forward/)).toHaveCount(0)
  expect(errors, errors.join('\n')).toHaveLength(0)
})

test('login shows the Lottie loader instead of text', async ({ page }) => {
  const { email, password } = await signUp(page, 'Loader Tester')
  await page.getByRole('button', { name: /Account menu/ }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  // while the login is being checked an animated SVG (not text) is on screen
  const loader = page.locator('[data-lottie="loader"] svg').first()
  await expect(loader).toBeVisible()
  await expect(page.getByText('Please wait')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: /good (morning|afternoon|evening)/i })).toBeVisible()
})

test('signed-out visitors go straight to login with no loading screen; signed-in reload shows the loader', async ({ page }) => {
  // record whether the Lottie loading screen is ever rendered
  await page.addInitScript(() => {
    window.__sawLoader = false
    new MutationObserver(() => {
      if (document.querySelector('[data-lottie="loader"]')) window.__sawLoader = true
    }).observe(document, { childList: true, subtree: true })
  })
  await page.goto('/analytics')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Sign in to your work diary' })).toBeVisible()
  expect(await page.evaluate(() => window.__sawLoader)).toBe(false)

  await signUp(page, 'Boot Tester')
  await page.waitForTimeout(500)
  await page.reload()
  // signed in: the branded loading screen is shown while the session and data are opened
  await expect(page.locator('[data-lottie="loader"] svg').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: /good (morning|afternoon|evening)/i })).toBeVisible()
  expect(await page.evaluate(() => window.__sawLoader)).toBe(true)
})

test('dark mode is one device-wide theme: landing, sign-in and app agree and it persists', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  await page.getByRole('button', { name: /Theme:/ }).click()
  await page.getByRole('menuitem', { name: /Dark/ }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  // survives a reload before first paint and carries to the sign-in and register pages
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.goto('/login')
  await expect(page.locator('html')).toHaveClass(/dark/)
  await signUp(page, 'Theme Tester')
  await expect(page.locator('html')).toHaveClass(/dark/)
  // the in-app toggle switches back and it sticks
  await page.getByRole('button', { name: /Theme:/ }).click()
  await page.getByRole('menuitem', { name: /Light/ }).click()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  await page.reload()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
})

test('theme follows the system when set to system', async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: 'dark' })
  const page = await ctx.newPage()
  await page.goto('/')
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  await ctx.close()
})

test('quick add: keeps text as typed, splits on commas, suggests earlier #modules and ~projects', async ({ page }) => {
  await signUp(page, 'Quick Tester')
  const box = page.getByLabel('Quick add task')
  // first, create history to suggest from
  await box.fill('Seed task #Consent')
  await page.keyboard.press('Enter')
  await expect(page.getByText('Seed task').first()).toBeVisible()
  // typing # offers the module used before; Enter accepts instead of submitting
  await box.fill('Review copy #Con')
  const opt = page.getByRole('option', { name: /Consent/ })
  await expect(opt).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(box).toHaveValue('Review copy #Consent ')
  // ! offers priorities
  await box.pressSequentially('!h')
  await expect(page.getByRole('option', { name: /high/ })).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(box).toHaveValue('Review copy #Consent !high ')
  // comma separated entries become separate tasks, words like "tomorrow 2h" stay in the title
  await box.fill('Fix login tomorrow 2h, Write docs; Plan sprint #Consent')
  await expect(page.getByRole('button', { name: 'Add 3' })).toBeVisible()
  await page.getByRole('button', { name: 'Add 3' }).click()
  await expect(page.getByText('Fix login tomorrow 2h').first()).toBeVisible()
  await expect(page.getByText('Write docs').first()).toBeVisible()
  await expect(page.getByText('Plan sprint').first()).toBeVisible()
})

test('progress: starts at 0% when In Progress, slider updates it, 100% completes, analytics show the average', async ({ page }) => {
  await signUp(page, 'Progress Tester')
  await page.getByLabel('Quick add task').fill('Write the report')
  await page.keyboard.press('Enter')
  // moving to In Progress starts at 0%
  await page.getByRole('button', { name: /^Status: Pending/ }).first().click()
  await page.getByRole('menuitem', { name: 'In Progress' }).click()
  const slider = page.getByLabel('Progress for Write the report')
  await expect(slider).toHaveValue('0')
  // the user updates it in the drawer (chips)
  await page.getByRole('button', { name: 'Task actions' }).first().click()
  await page.getByRole('menuitem', { name: 'Open details' }).click()
  await page.getByRole('button', { name: '50%', exact: true }).click()
  await expect(page.getByRole('progressbar').or(page.getByText('Over halfway')).first()).toBeVisible()
  await expect(page.getByText('Over halfway')).toBeVisible()
  // 100% completes the task
  await page.getByRole('button', { name: '100%', exact: true }).click()
  await expect(page.getByText('Done', { exact: true }).first()).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: /^Status: Completed/ }).first()).toBeVisible()
  // analytics has the new KPI and chart
  await page.goto('/analytics')
  await expect(page.getByText('Avg progress').first()).toBeVisible()
  await expect(page.getByText('Progress of open tasks')).toBeVisible()
})
